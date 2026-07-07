import type { Config } from './config';
import type { Store } from './store';

const ALPHABET = 'ACDEFGHJKLMNPRTUVWXY3479';
function randomCode(): string {
  let c = 'BCCC-';
  for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

/**
 * Get a single-use discount code for this claim. Three modes:
 *  - MOCK (no creds): a locally-minted fake code (dev/demo).
 *  - Pattern A (pool): hand out the next unused pre-generated Shopify code.
 *  - Pattern B (Admin API): mint a unique code under the parent price rule
 *    (15% off, usage_limit 1, scoped to the BCCC collection — configured on the rule).
 * Returns null if the pool is exhausted so the caller can respond gracefully.
 */
export async function issueCode(cfg: Config, store: Store): Promise<string | null> {
  if (cfg.mock) return randomCode();

  // Pattern A — pre-generated pool
  if (cfg.shopify.codePool && cfg.shopify.codePool.length) {
    await store.loadPool(cfg.shopify.codePool);
    return store.takePoolCode(); // may be null when exhausted
  }

  // Pattern B — Shopify Admin API on-demand
  if (cfg.shopify.shop && cfg.shopify.adminToken && cfg.shopify.priceRuleId) {
    const code = randomCode();
    try {
      const res = await fetch(
        `https://${cfg.shopify.shop}/admin/api/2025-01/price_rules/${cfg.shopify.priceRuleId}/discount_codes.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': cfg.shopify.adminToken,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ discount_code: { code } }),
        },
      );
      if (res.ok) return code;
      console.warn('[bccc] shopify code create failed:', res.status);
      return null;
    } catch (e) {
      console.warn('[bccc] shopify error:', (e as Error).message);
      return null;
    }
  }

  // configured "live" but no Shopify method wired — fail safe
  return randomCode();
}
