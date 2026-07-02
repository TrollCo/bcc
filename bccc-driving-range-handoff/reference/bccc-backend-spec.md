# Blue Collar Country Club — Driving Range Mini-Game
## Backend Integration Spec (v1)

The mini-game (`bccc-driving-range.html`) is a complete, self-contained front-end. It runs with zero backend. This spec covers the three integrations that turn it from a demo into a live lead-capture + promo mechanic on the BCCC drop page. Everything below maps to comment markers already in the game's `<script>`:

- `BACKEND HANDOFF` block (top of script) — overview + the three hooks.
- `=== BACKEND: POST ... ===` (inside `claimBtn` handler) — the email/code hook.
- `MEMBERS[]` seeded array — the leaderboard hook.

A frontend dev can wire all three without touching game logic.

---

## 0. Threat model first (read this before building)

The score is computed client-side. **A determined user can fake a 300-yard drive and mint codes.** Treat the unlock as a *lead magnet / soft gate*, not a security boundary. Design implications:

- Do **not** put anything truly costly behind the score alone (e.g. no "free product," no stackable high-value discount).
- Gate the reward behind **email capture**, and enforce **one code per email** and **per-IP rate limiting** server-side.
- The discount itself should be a **standard, capped, single-use** Shopify code — same exposure as any newsletter signup offer.
- Optionally validate plausibility server-side (reject impossible scores) but don't over-invest; the email gate is the real control.

Net: the game drives engagement + email opt-ins. The discount is the same risk profile as a popup coupon, no worse.

---

## 1. Email capture → ESP (Klaviyo)

**Trigger:** user enters email and taps **Claim** on the Membership card.
**Front-end change:** in the `claimBtn` handler, replace the client-side `newCode()` reveal with a `fetch()` to your endpoint; reveal the returned code only on success.

### Request
```
POST /api/bccc/claim
Content-Type: application/json

{
  "email": "user@example.com",
  "bestDrive": 327,          // yards, integer
  "totalRound": 0,           // optional, sum of round
  "source": "bccc-driving-range",
  "ts": 1735830000000
}
```

### Response (success)
```
200 OK
{ "ok": true, "code": "BCCC-7K4P", "perk": "15% off + early access" }
```
### Response (already claimed)
```
200 OK
{ "ok": true, "code": "BCCC-7K4P", "alreadyClaimed": true }   // return their existing code
```
### Response (rejected)
```
429 Too Many Requests   // rate limited
422 Unprocessable       // invalid email / implausible score
```

### Server responsibilities
1. Validate email format; dedupe on email (return existing code if present).
2. Upsert profile to Klaviyo with properties: `bccc_best_drive`, `bccc_member` (bool), `source`. Add to a **"BCCC Members"** list/segment to trigger the welcome/early-access flow.
3. Mint or look up the Shopify discount code (Section 2), store `email → code`.
4. Rate-limit by IP (e.g. 5/min) and cap codes per email at 1.

---

## 2. Single-use promo code (Shopify)

Two viable patterns — pick one:

**A. Pre-generated pool (simplest, recommended for a drop).**
Generate N single-use codes in Shopify ahead of the drop (Discounts → bulk). Server hands out the next unused code from the pool on claim and marks it assigned to that email. Pros: no live Admin API calls, predictable cap (you control N). Cons: finite — monitor remaining count.

**B. On-demand via Shopify Admin API.**
On claim, create a unique code under a parent price rule:
```
POST /admin/api/2025-01/price_rules/{price_rule_id}/discount_codes.json
{ "discount_code": { "code": "BCCC-7K4P" } }
```
Parent price rule config: 15% off, **usage_limit: 1**, **once_per_customer: true**, optional collection scope (BCCC drop only), start/end dates = drop window. Pros: unlimited, self-cleaning. Cons: live API dependency + rate limits.

> Either way: scope the discount to the **BCCC collection** and set an **expiry** = drop window. Never issue an uncapped or sitewide code from a client-triggered event.

---

## 3. Member Standings leaderboard (optional but high-value)

Currently `MEMBERS[]` is a seeded decorative array and resets on reload (browser storage is disabled in the artifact runtime). To make it real and persistent:

### Submit a score (on round complete)
```
POST /api/bccc/score
{ "name": "Tig — Welder", "bestDrive": 327, "source": "bccc-driving-range" }
```
- Capture `name` with a short, sanitized free-text field (profanity filter; cap length ~20).
- Store top N. Consider a **rolling weekly board** ("this week's longest drives") to keep it fresh and give repeat reasons to return — pairs well with a weekly code drop.

### Fetch the board (on load / summary screen)
```
GET /api/bccc/leaderboard?window=week&limit=10
→ { "entries": [ { "name": "...", "bestDrive": 392 }, ... ] }
```
- Replace the seeded `MEMBERS[]` with this fetch; keep a seeded fallback for first paint / offline.
- Anti-abuse: same plausibility check + rate limit as the claim endpoint.

---

## 4. Analytics events (wire to GA4 / Meta / TikTok pixels)

Fire these from the game (add calls at the matching state transitions):

| Event | When | Use |
|---|---|---|
| `bccc_game_start` | first tee-off | engagement / funnel top |
| `bccc_round_complete` | after 3 balls | completion rate |
| `bccc_membership_unlocked` | bestDrive ≥ threshold | reward rate (tune threshold to ~40–60% of completers) |
| `bccc_email_submitted` | Claim success | **the conversion that matters** |
| `bccc_code_revealed` | code shown | redemption funnel start |

Tie `bccc_email_submitted` to your ad platforms as the optimization event.

---

## 5. Embedding on the drop page

- Drop the single HTML file in as a full-bleed `<iframe>` (it's responsive, mobile-first, no external deps beyond Google Fonts), **or** inline the `<canvas>` + script into the page template.
- If iframed, use `postMessage` to bubble the analytics events and the `bccc_email_submitted` payload up to the parent page so the parent owns ESP/pixel calls (keeps keys off the client).
- No build step required.

---

## 6. Tunables (already exposed at top of the game script)

| Const | Default | Effect |
|---|---|---|
| `MEMBER_THRESHOLD` | 300 | yards to unlock membership. Lower = more unlocks/emails, cheaper-feeling code. Recommend tuning so ~40–60% of *completers* unlock. |
| `BALLS_PER_ROUND` | 3 | session length. More balls = longer dwell, higher unlock odds. |
| `powerSpeed` / `contactSpeed` / `SWEET_W` | 1.62 / 2.55 / 0.105 | swing difficulty. Tighter/faster = more skill, fewer easy unlocks. |

---

### Build order (fastest path to live)
1. Pre-generate a Shopify code pool (Section 2A) + parent discount scoped to the BCCC collection.
2. Stand up `/api/bccc/claim` (email validate → Klaviyo upsert → hand out pool code → store mapping).
3. Swap the client code reveal for the `fetch()`; gate reveal on `ok:true`.
4. Add the 5 analytics events.
5. (Optional) Add `/score` + `/leaderboard` for the weekly Member Standings.

Steps 1–3 are the MVP. 4–5 are upside.
