import type { Config } from './config';
import type { Store } from './store';

const ALPHABET = 'ACDEFGHJKLMNPRTUVWXY3479';
function randomCode(): string {
  let c = 'BCCC-';
  for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

/**
 * Get the membership discount code for this claim.
 *
 * NOTE (2026-07): the drop switched to a UNIVERSAL code — one shared code
 * (`cfg.code`, default FREESTROKES) sent to everyone, matching the client's
 * MEMBERSHIP_CODE. Mock mode returns it, and that's the intended live behavior
 * too: configure ONE Shopify discount of that value (Free Gift w/ Purchase) and
 * return `cfg.code`. The per-user Pattern A (pool) / Pattern B (mint) paths below
 * are the LEGACY single-use model, kept for reference — remove them if you don't
 * revert to per-user codes. `randomCode()` stays only for those legacy paths.
 */
export async function issueCode(cfg: Config, store: Store): Promise<string | null> {
  if (cfg.mock) return cfg.code;

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
