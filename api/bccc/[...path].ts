// ---------- config ----------
interface Config {
  mock: boolean;
  perk: string;
  code: string;
  rateLimitPerMin: number;
  klaviyo: { apiKey?: string; listId?: string; revision: string };
  shopify: { codePool?: string[]; shop?: string; adminToken?: string; priceRuleId?: string };
}

function loadConfig(): Config {
  const env = process.env;
  const klaviyoApiKey = env.KLAVIYO_API_KEY;
  const shopifyPool = env.SHOPIFY_CODE_POOL
    ? env.SHOPIFY_CODE_POOL.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const shopifyAdmin = env.SHOPIFY_ADMIN_TOKEN;
  const live = Boolean(klaviyoApiKey || shopifyPool || shopifyAdmin);
  return {
    mock: !live,
    perk: env.BCCC_PERK ?? 'Early Access + Free Gift with Purchase',
    code: env.BCCC_CODE ?? 'FREESTROKES',
    rateLimitPerMin: Number(env.BCCC_RATE_LIMIT_PER_MIN ?? 5),
    klaviyo: {
      apiKey: klaviyoApiKey,
      listId: env.KLAVIYO_LIST_ID,
      revision: env.KLAVIYO_API_REVISION ?? '2024-10-15',
    },
    shopify: {
      codePool: shopifyPool,
      shop: env.SHOPIFY_SHOP,
      adminToken: shopifyAdmin,
      priceRuleId: env.SHOPIFY_PRICE_RULE_ID,
    },
  };
}

// ---------- store (in-memory; resets per cold start) ----------
interface Member { nm: string; sc: number; you?: boolean; }
interface Store {
  getCodeForEmail(email: string): Promise<string | null>;
  setCodeForEmail(email: string, code: string): Promise<void>;
  takePoolCode(): Promise<string | null>;
  loadPool(codes: string[]): Promise<void>;
  hitRateLimit(ip: string, perMin: number): Promise<boolean>;
  addScore(m: Member): Promise<void>;
  topScores(limit: number): Promise<Member[]>;
}

function createMemoryStore(): Store {
  const emailToCode = new Map<string, string>();
  const pool: string[] = [];
  let poolLoaded = false;
  const ipHits = new Map<string, number[]>();
  const scores: Member[] = [];
  return {
    async getCodeForEmail(email) { return emailToCode.get(email.toLowerCase()) ?? null; },
    async setCodeForEmail(email, code) { emailToCode.set(email.toLowerCase(), code); },
    async loadPool(codes) { if (poolLoaded) return; pool.push(...codes); poolLoaded = true; },
    async takePoolCode() { return pool.shift() ?? null; },
    async hitRateLimit(ip, perMin) {
      const now = Date.now();
      const win = now - 60_000;
      const hits = (ipHits.get(ip) ?? []).filter((t) => t > win);
      hits.push(now);
      ipHits.set(ip, hits);
      return hits.length > perMin;
    },
    async addScore(m) {
      scores.push({ nm: m.nm, sc: m.sc });
      scores.sort((a, b) => b.sc - a.sc);
      if (scores.length > 500) scores.length = 500;
    },
    async topScores(limit) { return scores.slice(0, limit); },
  };
}

// ---------- klaviyo ----------
async function upsertAndSubscribe(
  cfg: Config,
  email: string,
  props: { bestDrive: number; member: boolean; refBy?: string },
): Promise<void> {
  if (cfg.mock || !cfg.klaviyo.apiKey) return;
  const { apiKey, listId, revision } = cfg.klaviyo;
  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  const attributes = {
    email,
    properties: {
      bccc_best_drive: props.bestDrive,
      bccc_member: props.member,
      ...(props.refBy ? { bccc_referred_by: props.refBy } : {}),
      source: 'bccc-driving-range',
    },
  };
  try {
    let profileId: string | undefined;
    const create = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: { type: 'profile', attributes } }),
    });
    if (create.status === 201) {
      profileId = (await create.json())?.data?.id;
    } else if (create.status === 409) {
      profileId = (await create.json())?.errors?.[0]?.meta?.duplicate_profile_id;
      if (profileId) {
        await fetch(`https://a.klaviyo.com/api/profiles/${profileId}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ data: { type: 'profile', id: profileId, attributes } }),
        });
      }
    }
    if (profileId && listId) {
      await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
      });
    }
  } catch (e) {
    console.warn('[bccc] klaviyo upsert failed (non-blocking):', (e as Error).message);
  }
}

// ---------- shopify ----------
const ALPHABET = 'ACDEFGHJKLMNPRTUVWXY3479';
function randomCode(): string {
  let c = 'BCCC-';
  for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

async function issueCode(cfg: Config, store: Store): Promise<string | null> {
  if (cfg.mock) return cfg.code;
  if (cfg.shopify.codePool && cfg.shopify.codePool.length) {
    await store.loadPool(cfg.shopify.codePool);
    return store.takePoolCode();
  }
  if (cfg.shopify.shop && cfg.shopify.adminToken && cfg.shopify.priceRuleId) {
    const code = randomCode();
    try {
      const res = await fetch(
        `https://${cfg.shopify.shop}/admin/api/2025-01/price_rules/${cfg.shopify.priceRuleId}/discount_codes.json`,
        {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': cfg.shopify.adminToken, 'content-type': 'application/json' },
          body: JSON.stringify({ discount_code: { code } }),
        },
      );
      if (res.ok) return code;
      return null;
    } catch {
      return null;
    }
  }
  return randomCode();
}

// ---------- api handler ----------
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (s: unknown, max: number): string => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

const config = loadConfig();
const store = createMemoryStore();

async function handle(method: string, path: string, body: unknown, ip: string) {
  const p = path.split('?')[0];

  if (method === 'POST' && p.endsWith('/claim')) {
    const b = (body ?? {}) as Record<string, unknown>;
    const email = clean(b.email, 254).toLowerCase();
    const bestDrive = Math.round(Number(b.bestDrive));
    if (!EMAIL_RE.test(email)) return { status: 422, json: { ok: false, error: 'invalid_email' } };
    if (!Number.isFinite(bestDrive) || bestDrive < 1 || bestDrive > 700) {
      return { status: 422, json: { ok: false, error: 'implausible_score' } };
    }
    if (await store.hitRateLimit(ip, config.rateLimitPerMin)) {
      return { status: 429, json: { ok: false, error: 'rate_limited' } };
    }
    const existing = await store.getCodeForEmail(email);
    if (existing) {
      return { status: 200, json: { ok: true, code: existing, perk: config.perk, alreadyClaimed: true } };
    }
    const refBy = clean(b.refBy, 40) || undefined;
    await upsertAndSubscribe(config, email, { bestDrive, member: true, refBy });
    const code = await issueCode(config, store);
    if (!code) return { status: 503, json: { ok: false, error: 'out_of_codes' } };
    await store.setCodeForEmail(email, code);
    return { status: 200, json: { ok: true, code, perk: config.perk } };
  }

  if (method === 'POST' && p.endsWith('/score')) {
    const b = (body ?? {}) as Record<string, unknown>;
    const nm = clean(b.name, 20) || 'Anonymous';
    const sc = Math.round(Number(b.bestDrive));
    if (!Number.isFinite(sc) || sc < 1 || sc > 700) return { status: 422, json: { ok: false, error: 'implausible_score' } };
    if (await store.hitRateLimit(ip, config.rateLimitPerMin)) return { status: 429, json: { ok: false, error: 'rate_limited' } };
    await store.addScore({ nm, sc });
    return { status: 200, json: { ok: true } };
  }

  if (method === 'GET' && p.endsWith('/leaderboard')) {
    const limit = Math.min(50, Math.max(1, Number(new URLSearchParams(path.split('?')[1] ?? '').get('limit')) || 10));
    const entries = await store.topScores(limit);
    return { status: 200, json: { entries } };
  }

  return { status: 404, json: { ok: false, error: 'not_found' } };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.BCCC_CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  const result = await handle(req.method, req.url, req.body, ip);
  res.status(result.status).json(result.json);
}
