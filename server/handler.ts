import { loadConfig, type Config } from './config';
import { createMemoryStore, type Store, type Member } from './store';
import { upsertAndSubscribe } from './klaviyo';
import { issueCode } from './shopify';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (s: unknown, max: number): string => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

export interface ApiResult {
  status: number;
  json: unknown;
}

/**
 * Framework-agnostic BCCC API. Implements bccc-backend-spec.md §1-3:
 *   POST /api/bccc/claim       email -> Klaviyo upsert -> single-use code (deduped, rate-limited)
 *   POST /api/bccc/score       submit a best drive to the standings
 *   GET  /api/bccc/leaderboard top scores
 * Thin adapters (Node server, Vercel/Netlify fn, Vite dev middleware) just call handle().
 */
export function createApi(opts: { config?: Config; store?: Store } = {}) {
  const config = opts.config ?? loadConfig();
  const store = opts.store ?? createMemoryStore();

  async function handle(method: string, path: string, body: unknown, ip: string): Promise<ApiResult> {
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

      // one code per email
      const existing = await store.getCodeForEmail(email);
      if (existing) {
        return { status: 200, json: { ok: true, code: existing, perk: config.perk, alreadyClaimed: true } };
      }

      // capture lead (best-effort) then issue the code
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
      const entries: Member[] = await store.topScores(limit);
      return { status: 200, json: { entries } };
    }

    return { status: 404, json: { ok: false, error: 'not_found' } };
  }

  return { config, store, handle };
}

export type Api = ReturnType<typeof createApi>;
