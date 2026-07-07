# The Driving Range — Developer Handoff

Blue Collar Country Club's engraved-aesthetic mini-game. This is the **front door
for the web developer inheriting the project.** It reflects the *current, shipped*
state — read this first, then dive into the linked docs as needed.

- **Live:** https://sc-creatives.github.io/bccc-driving-range/
- **Repo:** https://github.com/SC-Creatives/bccc-driving-range (branch `main`)
- **Stack:** Vite 6 + TypeScript 5 + PixiJS v8 (WebGL) + Howler. Node 20+ (built on 22).
- **Status:** Game, art, audio, intro cinematic, and deploy are **done and live**.
  The **one remaining launch task is standing up the real backend** (see §5).

---

## 1. Current status at a glance

| Area | State |
|---|---|
| Gameplay (two-tap swing, physics, grading, 3-ball rounds) | ✅ Done, tuned |
| Engraved WebGL grade | ✅ Done (single Pixi filter) |
| Authored art (golfer, clubhouse, crest, logo) | ✅ In, replacing placeholders |
| Cinematic intro (3 clips, gapless, audio) | ✅ Done |
| Audio: ambient bed, procedural SFX, announcer VO, crowd clap/cheer | ✅ Done |
| VO variety (back-to-back rotation + drop-in variants) | ✅ Done |
| Share / referral (SMS "text a friend", `?ref=` capture) | ✅ Front-end done; **fulfillment needs backend** |
| iOS safe-area / Dynamic Island handling | ✅ Done (Safari/Chrome/Brave) |
| GitHub Pages auto-deploy | ✅ Done (push-to-main) |
| **Live backend** (Klaviyo capture, single-use Shopify codes, persistent leaderboard, referral fulfillment) | ❌ **Not deployed** — runs in mock/local-fallback today. **This is the launch blocker.** |

**What "mock/local-fallback" means today:** the site is a *static* GitHub Pages
build with no server. So the email claim mints a **fake local `BCCC-XXXX` code**
(no Klaviyo capture, no real Shopify code), and the leaderboard shows **seeded
demo entries**, not live scores. Everything is wired and ready — it just needs the
API from `/server` deployed and `VITE_BCCC_API` pointed at it. See §5.

---

## 2. Run it locally

```bash
npm install
npm run dev        # http://localhost:5173  (also serves a MOCK /api/bccc/* via Vite middleware)
npm run build      # tsc --noEmit && vite build  ->  dist/  (static, iframe-embeddable, base './')
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

No env vars needed for local dev — the API runs in mock mode automatically.

---

## 3. How changes go live

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci &&
npm run build`, uploads `dist/`, and publishes to Pages. ~90s end to end. No manual
step. Watch a run with `gh run watch` or the repo's Actions tab.

> The build is **static** (no server). The backend in `/server` is a separate deploy
> (§5). Pointing the game at it is a one-line env change (`VITE_BCCC_API`) + a push.

---

## 4. Repo map

```
src/
  config/
    tuning.ts          ← ALL gameplay knobs (speeds, thresholds, distance model). Start here for balance.
    palette.ts         ← brand duotone ramp for the grade
  game/
    Game.ts            ← boot, ticker, round flow, wires audio/haptics/backend at each transition
    state.ts constants.ts StateMachine
    systems/
      SwingMeter.ts    ← power + contact meters (the difficulty knobs live in tuning.ts)
      Physics.ts       ← analytic carry+roll distance model (ceiling = 358yd at perfect P & Q)
      Reward.ts        ← (yards, quality) -> grade bucket + announcer line + PURE rule
      Audio.ts         ← ambient/VO/crowd via Howler + procedural WebAudio SFX. VO rotation lives here.
      Leaderboard.ts   ← live-board merge + persistent anon "trade handle"
      Backend.ts       ← claim/score/leaderboard client; falls back to local code on any non-2xx
      Haptics.ts       ← Android vibrate + (dead on modern iOS — see §7)
      Analytics.ts     ← track() funnel events
    entities/          ← Background Clubhouse Range Golfer Ball HUD (Pixi render layers)
    render/filters/GradeFilter.ts   ← the engraved grade (one full-stage WebGL filter)
    ui/
      Intro.ts         ← cinematic cold-open (pre-buffered gapless clips)
      Overlay.ts       ← DOM title / result / summary / membership card / coach card
      ShareCard.ts     ← SMS "text a friend" + referral link
  main.ts              ← mount, boot, ?ref= capture, logo mask, layout/safe-area classes
public/assets/         ← art/ audio/ video/ + README.md (asset specs). Served as-is.
server/                ← the backend (framework-agnostic handler + adapters). NOT yet deployed. See server/README.md.
.github/workflows/deploy.yml   ← Pages auto-deploy
.env.example           ← every env var, documented
```

Other docs: **`BUILD.md`** (original engineering spec/architecture), **`server/README.md`**
(backend endpoints + modes), **`reference/bccc-backend-spec.md`** (backend spec incl.
threat model — read §0), **`public/assets/README.md`** (asset checklist).

> `reference/HANDOFF-README.md` is the *original* "build from scratch in Claude Code"
> brief. It's historical — **this file supersedes it** for anyone maintaining the
> shipped game.

---

## 5. The remaining launch work: the backend

Everything front-end is done. To actually capture leads and issue real codes, deploy
the API in `/server` and point the game at it. It's already written and spec'd.

**What it does** (`server/README.md`, `reference/bccc-backend-spec.md`):
- `POST /api/bccc/claim` — email → Klaviyo upsert/subscribe → single-use Shopify code (dedup one per email, per-IP rate limit).
- `POST /api/bccc/score` and `GET /api/bccc/leaderboard` — persistent Members board.

**Steps:**
1. Deploy `/server` as a serverless function (Vercel/Netlify adapter notes in `server/README.md`) or standalone Node (`node --import tsx server/node.ts`).
2. Set env from `.env.example`: Klaviyo (`KLAVIYO_API_KEY`, `KLAVIYO_LIST_ID`), Shopify (either a pre-generated `SHOPIFY_CODE_POOL` — recommended for a drop — or the Admin-API pattern), `BCCC_PERK`, rate limit, CORS origin.
3. **Replace the in-memory store** (`server/store.ts`) with a real one (Vercel KV / Upstash Redis / DB) implementing the `Store` interface — otherwise codes don't dedupe across instances and reset on restart.
4. Set `VITE_BCCC_API` to the API origin, rebuild, push. (Same-origin also works if the drop page hosts `/api/bccc/*` itself — then leave it empty.)

**Security reality (spec §0):** the score is client-side, so the real controls are
the email gate + one-code-per-email + per-IP rate limit **on the server**. Keep
Shopify codes capped/single-use; never issue uncapped codes. Keys stay server-side —
the client only calls these endpoints.

**Referral fulfillment (not automated):** the "text a friend" flow captures the
referrer via `?ref=<handle>` into `localStorage` and passes it to the claim as
`refBy` (forwarded to Klaviyo as a property). **Actually granting the extra 5% to
both parties is a manual/Klaviyo-flow step you still need to build** — decide the
mechanism (Klaviyo flow, Shopify automatic discount, etc.).

---

## 6. Content & tuning playbook (no deep code needed)

Day-to-day content lives in a few obvious places:

**Gameplay balance — `src/config/tuning.ts`:**
- `powerSpeed` (1.55), `contactSpeed` (1.85) — meter difficulty. Higher = harder.
- `MEMBER_THRESHOLD` (300) — yards to earn membership. `CHEER_THRESHOLD` (340) — full crowd roar (clap plays 300+).
- `BALLS_PER_ROUND` (3). `PIN_MARKER_YD` (273) — decorative flag position only (scoring is independent).
- Distance model constants (`carryBase`, `carryPower`, roll terms) — **perfect swing ceiling = 358 yd.** Don't retune by feel; it's ported from the validated prototype.

**Announcer VO — `public/assets/audio/vo/` + `src/game/systems/Audio.ts`:**
- One file per grade today: `shanked / wormburner / shortgrass / respectable / clubhouse / cannon / pure` `.mp3`.
- **Add variety by dropping in `<slug>-2.mp3`, `<slug>-3.mp3`** (up to 6) — they auto-shuffle, never repeating a take back-to-back. No code change.
- **Back-to-back rotation:** consecutive same-grade shots pull a tonally-adjacent neighbor instead of repeating (a 2nd shank borrows the worm-burner line). Edit the `VO_ROTATION` table in `Audio.ts` to change pairings.
- Grade → line mapping (which grade fires when) is in `src/game/systems/Reward.ts`.

**Crowd + ambient:** `public/assets/audio/sfx/clap.mp3` & `cheer.mp3`; `public/assets/audio/ambient-loop.mp3` (looped bed).

**Intro cinematic — `public/assets/video/` + `src/game/ui/Intro.ts`:**
- Three clips `intro-rigs.mp4` → `intro-crew.mp4` → `intro-ots.mp4`. Swap the files to change footage.
- Per-clip volume is set in the intro shot config in `Game.ts` (rigs/crew are at 0.5 to sit under the mix). `intro-rigs.lowres.bak` is an ignored backup — safe to delete.

**Copy strings:** membership card, share hints, grade lines — in `src/game/ui/Overlay.ts` and `Reward.ts`.

**Logo / brand:** the TROLL CO logo is a CSS mask (`--logo-mask`) set as an *absolute* URL in `main.ts` (relative URLs break under the Pages subpath in WebKit — keep it absolute). Assets in `public/assets/art/`.

---

## 7. Known platform constraints (don't re-debug these)

- **iOS haptics are a hard wall.** `navigator.vibrate` is blocked on all iOS browsers, and the hidden-switch-input trick is patched on current iPhones. `Haptics.ts` still fires on Android; iOS silently no-ops. Not a bug — Apple platform policy.
- **Safe-area / Dynamic Island:** `viewport-fit=cover` populates `env(safe-area-inset-*)`, then the game container (`.clubhouse`) explicitly insets by those values so it never sits under the camera. Brave defaults to full-bleed without the explicit inset — hence the approach. Works across Safari/Chrome/Brave.
- **Audio autoplay:** all audio unlocks on the intro's "tap to begin" gesture; `navigator.audioSession.type='playback'` bypasses the iOS ring/silent switch (16.4+).
- **Static-host fallback:** with no backend, claims mint a local code and the board is seeded (§1). This is by design so the game is fully playable pre-backend — but it is **not** real capture.

---

## 8. Environment variables

Full documented list in `.env.example`. The ones that matter for launch:

| Var | Where | Purpose |
|---|---|---|
| `VITE_BCCC_API` | build-time (client) | API origin. Empty = same-origin / mock. |
| `VITE_BCCC_SHARE_URL` | build-time (client) | Public drop-page URL the "text a friend" links point at. |
| `KLAVIYO_API_KEY`, `KLAVIYO_LIST_ID` | server | Lead capture. |
| `SHOPIFY_CODE_POOL` *or* `SHOPIFY_SHOP`/`SHOPIFY_ADMIN_TOKEN`/`SHOPIFY_PRICE_RULE_ID` | server | Single-use codes (Pattern A pool recommended for a drop). |
| `BCCC_PERK`, `BCCC_RATE_LIMIT_PER_MIN`, `BCCC_CORS_ORIGIN` | server | Perk label, rate limit, allowed origin. |

---

## 9. Embedding on the drop page

The build is self-contained with `base: './'`, so it drops into an iframe:

```html
<iframe src="https://sc-creatives.github.io/bccc-driving-range/"
        title="The Driving Range" allow="fullscreen"
        style="width:100%;aspect-ratio:16/9;border:0"></iframe>
```

For production, host the `dist/` bundle wherever the drop page lives (or keep Pages
and iframe it), set `VITE_BCCC_SHARE_URL` to the drop-page URL, and either host the
API same-origin or set `VITE_BCCC_API`.

---

## 10. First moves for the new developer

1. `npm install && npm run dev` — play it locally (mock backend).
2. Skim `BUILD.md` §2/§3 for architecture, then `server/README.md` + `reference/bccc-backend-spec.md`.
3. Stand up `/server` with a real store + Klaviyo/Shopify creds (§5).
4. Decide + build the referral fulfillment mechanism (§5).
5. Point `VITE_BCCC_API` at it, push, verify a real claim end-to-end on a phone.
