# BCCC backend

Implements `bccc-backend-spec.md`: the membership **claim** (email → Klaviyo →
single-use Shopify code), plus optional **score**/**leaderboard** endpoints. The
handler is framework-agnostic; thin adapters run it in three places.

## Endpoints
- `POST /api/bccc/claim` — `{ email, bestDrive, source, ts }` → `{ ok, code, perk, alreadyClaimed? }`. Validates email, rate-limits by IP, dedupes one code per email, upserts to Klaviyo (best-effort), issues a single-use code.
- `POST /api/bccc/score` — `{ name, bestDrive }` → `{ ok }`.
- `GET  /api/bccc/leaderboard?limit=10` → `{ entries: [{nm, sc}] }`.

Errors: `422` invalid email / implausible score, `429` rate-limited, `503` out of codes.

## Modes
- **MOCK** (no creds): mints fake `BCCC-XXXX` codes, no external calls. This is the default and what runs in `npm run dev` (via the Vite middleware in `vite.config.ts`) and in CI. The whole email→code flow is testable with zero setup.
- **LIVE**: set env (see `../.env.example`). Klaviyo upsert + list subscribe, and Shopify codes via **Pattern A** (pre-generated pool, `SHOPIFY_CODE_POOL`) or **Pattern B** (Admin API, `SHOPIFY_SHOP`/`SHOPIFY_ADMIN_TOKEN`/`SHOPIFY_PRICE_RULE_ID`).

## Run / deploy
- **Local dev:** nothing to do — `npm run dev` serves `/api/bccc/*` (mock).
- **Standalone Node:** `node --import tsx server/node.ts` (set env first). Listens on `PORT` (default 8787).
- **Vercel/Netlify:** create a function that calls `createApi().handle(method, url, body, ip)` and returns `{status, json}`. (Create the `Api` once at module scope.)

## Production notes
- **Storage:** the default store is in-memory (`store.ts`) — fine for a single instance / demo, but it resets on restart and won't dedupe across instances. For a real drop, implement the `Store` interface against Vercel KV / Upstash Redis / a DB and pass it to `createApi({ store })`.
- **Security (threat model §0):** the score is client-side, so the email gate + one-code-per-email + per-IP rate limit here are the real controls. Keep the Shopify code standard/capped/single-use; never issue uncapped codes.
- **Keys stay server-side.** The client only calls these endpoints; it never sees Klaviyo/Shopify keys.
