# Blue Collar Country Club — "The Driving Range"
## Claude Code Build Handoff

This package contains everything needed to build the BCCC driving-range mini-game as a production web game. Start here, then open the files in the order below.

---

## What I'm trying to achieve

A **premium, on-brand mini-game for the Blue Collar Country Club drop landing page** — and, if it earns its place, a reusable arcade engine for future drops.

**The game:** *"The Driving Range."* A hard-hat ironworker (the Driver-tee character) tees off at the world's most blue-collar country club. Tap to set power, tap to nail contact, watch the drive fly. Three balls a round, a deadpan club-announcer grades every swing, a Members leaderboard ranks you against the trades, and crushing a drive past the threshold earns a **Membership** — a promo code, gated behind an email capture.

**Why it exists:** it's a lead-capture + engagement mechanic for the drop (email opt-ins → Klaviyo, single-use Shopify code), and a flagship interactive brand moment worth sharing. Secondarily, built right, it's a re-skinnable engine we can reuse for future drops.

**The look is non-negotiable:** it must read like the BCCC prints — royal pine + bone, Spencerian script over tracked serif caps, engraved/etched linework — and it must **color-match our video grade** (the drop-stitcher look: 35mm grain, halation, vintage grade, vignette). The game, the drop reel, and the ads should look like one family.

**What's already proven (do not redesign — port it):** the prototype in `reference/` is a fully working version. Its game logic, state machine, swing mechanic, physics/distance model, tuning constants, **and a working WebGL grade** (duotone palette-lock + crosshatch etch + halation + grain + vignette) are all validated. The Claude Code build keeps all of that and upgrades the **art and rendering**, not the design.

**What changes in the real build:** a proper engine (PixiJS + TypeScript + Vite), our **actual Driver-tee golfer art** animated (keyframes first, skeletal rig later), the full shader stack matched to drop-stitcher, real audio + announcer VO, and the live backend (Klaviyo + Shopify + leaderboard).

**The honest priority:** the long pole is **art and animation, not code.** Ship **Phase 1** first — it looks dramatically better than the prototype and needs no rigging. Only commit to the rig (Phase 2) once the asset has proven it earns its spot on the page.

**Definition of done (Phase 1):** 60fps on a mid-tier phone; on-brand engraved look matching the prototype's grade; authored clubhouse + a keyframe-animated golfer; the swing mechanic, physics, and tuning preserved exactly from the prototype; embeds cleanly on the drop page.

---

## What's in this package

| File | What it is | Use it for |
|---|---|---|
| `README.md` | this doc | start here — the goal + how to use everything |
| `BUILD.md` | the engineering build spec | the actual technical plan: stack, repo layout, architecture, shader stack, phases, effort/cost reality |
| `reference/bccc-driving-range.html` | the working prototype | **source of truth for all game logic + a reference implementation of the WebGL grade.** Open it in a browser to feel the target. Port its logic verbatim; replace its render layer. |
| `bccc-backend-spec.md` | backend integration spec | wiring the email capture (Klaviyo), single-use code (Shopify), leaderboard, and analytics. Includes the threat model — read section 0. |
| `bccc-golfer-keyframe-brief.md` | illustrator brief | hand to the artist. Six swing poses matched to the game's swing math; unblocks Phase 1 art in parallel with code. |
| `assets/README.md` | asset checklist | exactly what art, fonts, textures, and audio to drop into the repo, with specs. |

---

## Kick it off in Claude Code

1. Create the repo and copy this whole package into it. `BUILD.md` already references `reference/bccc-driving-range.html` and `bccc-backend-spec.md` by these paths.
2. Hand the artist `bccc-golfer-keyframe-brief.md` and start the 6 poses now (parallel track).
3. Paste this to Claude Code:

> Scaffold the project per `BUILD.md` Phase 1. Use Vite + TypeScript + PixiJS. **Port all game logic, the state machine, the swing mechanic, the physics/distance model, and every tuning constant verbatim from `reference/bccc-driving-range.html`** — only replace the 2D-canvas render layer with PixiJS sprites/containers. Re-implement the WebGL grade from the prototype as a Pixi filter stack (duotone palette-lock, 45° crosshatch etch, halation bloom, film grain, paper fiber, vignette) and expose its intensities as config. Use placeholder rectangles for any art not yet in `public/assets/`. Wire the swing meters and camera exactly as the prototype. Do not redesign the gameplay.

4. When art lands, drop it into `public/assets/` per `assets/README.md` and swap the placeholders.
5. Phase 2 (rig + audio + live backend) only after Phase 1 is approved on a real phone.

---

## The one honest reminder

The prototype is procedurally drawn shapes under a great grade. The reason we're moving to Claude Code is to put **our real authored art** under that same grade and have it actually animate. The engine is the easy part; budget the project around the **art and rigging** (see `BUILD.md` §0 for realistic effort and cost). Phase 1 keeps the expensive rigging optional until the asset proves itself.
