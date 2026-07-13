/**
 * Backend config, all from env. With no creds set, the handler runs in MOCK mode
 * (mints fake codes, no external calls) so the flow is testable locally and in CI.
 * Set these in production (see .env.example) to go live.
 */
export interface Config {
  mock: boolean;
  perk: string;
  code: string; // universal membership code (shared by everyone)
  rateLimitPerMin: number;
  klaviyo: { apiKey?: string; listId?: string; revision: string };
  shopify: {
    // Pattern A (recommended for a drop): a pre-generated pool of single-use codes
    codePool?: string[];
    // Pattern B: mint on demand via Admin API under a parent price rule
    shop?: string; // e.g. blue-collar.myshopify.com
    adminToken?: string;
    priceRuleId?: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const klaviyoApiKey = env.KLAVIYO_API_KEY;
  const shopifyPool = env.SHOPIFY_CODE_POOL
    ? env.SHOPIFY_CODE_POOL.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const shopifyAdmin = env.SHOPIFY_ADMIN_TOKEN;
  const live = Boolean(klaviyoApiKey || shopifyPool || shopifyAdmin);
  return {
    mock: !live,
    perk: env.BCCC_PERK ?? 'Early Access + Free Gift with Purchase',
    // Universal membership code — one shared code for everyone (matches the client's
    // MEMBERSHIP_CODE). Configure a matching single Shopify discount for the live drop.
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
