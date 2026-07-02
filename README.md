# Blue Collar Country Club — The Driving Range

> **👉 Handing this off or new to the project? Read [`HANDOFF.md`](HANDOFF.md) first.**
> It's the current-state guide: live URL, deploy pipeline, content/tuning playbook,
> and the one remaining launch task (the backend).
>
> **Live:** https://sc-creatives.github.io/bccc-driving-range/ · auto-deploys on push to `main`.

PixiJS rebuild of the validated prototype. The engraved look matches the prototype's
grade; the swing mechanic, physics, and tuning are ported verbatim; it builds to a
static bundle that embeds via iframe.

**Since this README was first written, a lot shipped** — authored art, full audio +
announcer VO, the cinematic intro, and live GitHub Pages deploy. The "Phase 1 / Phase 2"
framing below is **historical**; see `HANDOFF.md` for what's actually done vs. left.
`BUILD.md` remains the architecture reference; `reference/` holds the source-of-truth
prototype and the backend / illustrator briefs.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/ (static, iframe-embeddable; base: './')
npm run typecheck
```

## Stack

Vite + TypeScript + PixiJS v8 (WebGL). No other runtime deps beyond Howler
(installed for Phase 2 audio; unused in Phase 1).

## What Phase 1 ships

- **Logic ported 1:1 from the prototype** — state machine, two-tap swing mechanic,
  the analytic carry/roll distance model, the swing-angle beats, the announcer
  grade buckets, camera follow, the scatter, and the Members board. Every constant
  lives in `src/config/tuning.ts`.
- **The grade, re-implemented as a single PixiJS v8 filter** (`render/filters/GradeFilter.ts`)
  — duotone palette-lock → 45° crosshatch etch → halation bloom → film grain +
  paper fiber → vignette. Ported verbatim from the prototype's fragment shader.
  Every intensity is exposed via `GradeOptions` and tunable live:
  `window.__bccc.grade.setOptions({ halation: 1.6 })`. This is the seam to
  color-match the drop-stitcher video grade in Phase 2.
- **Procedural placeholder art** as PixiJS `Graphics` (golfer, Palms clubhouse,
  hills, pin) — the swap points for the authored sprites (`public/assets/`).
- **Backend + analytics seams** stubbed and injectable (`systems/Backend.ts`,
  `systems/Analytics.ts`) — the claim flow and the 5 funnel events are wired at the
  right transitions; Phase 2 injects the real Klaviyo/Shopify endpoint.
- 60fps target met with large headroom (125fps desktop, WebGL @2x).

## Architecture (BUILD.md §2/§3)

```
src/
  config/      tuning.ts  palette.ts          # all constants + brand colors
  game/
    Game.ts                                   # boot, ticker, ported tap/round-flow/tick
    StateMachine.ts  state.ts  constants.ts   # STATE enum + the single mutable state
    systems/   SwingMeter Physics Camera Particles Audio Reward Leaderboard
               Analytics Backend              # gameplay + integration seams
    entities/  Background Clubhouse Range Golfer Ball HUD   # Pixi render of each layer
    render/filters/GradeFilter.ts             # the engraved grade (one full-stage filter)
    ui/Overlay.ts                             # DOM title / result / summary + claim
  main.ts                                     # mount + boot
```

The game scene (everything graded) is one Pixi `Container` with the `GradeFilter`
applied; the brand frame, overlays, and membership card stay in the DOM (they're
typographic and hold the email `<input>`). Source colors are the prototype's — the
grade re-maps luminance onto the brand ramp, so the look is reproduced, not redrawn.

## Phase 2 (not built — earns its place after Phase 1 is approved on a phone)

- Authored art into `public/assets/` (golfer 6-pose sheet → Rive rig; clubhouse PNG;
  crest/flag SVG; licensed fonts) — swap the placeholder `Graphics` for sprites.
- Howler SFX + ambient bed + announcer VO (respect the existing Sound toggle).
- Live Klaviyo + single-use Shopify code + weekly Members board — inject real
  `claimMembership` / leaderboard fetches (`bccc-backend-spec.md`).
- Match the grade to drop-stitcher; mobile perf pass + real-device QA.

## Notes / known Phase-1 simplifications

- Gradients (sky/fairway/meters) are banded/solid fills, not true gradients — the
  duotone grade collapses them onto the ramp anyway. Trivial to restore with
  `FillGradient` if wanted.
- Procedural art redraws each frame (cheap at this complexity); the clubhouse is
  drawn once and parallaxed by container x. Authored sprites make this moot.
- `prefers-reduced-motion` freezes the animated film grain and the prompt pulse.
