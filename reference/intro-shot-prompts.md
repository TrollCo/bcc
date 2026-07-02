# BCCC Driving Range — Intro Shot Prompts (Path A)

Two short pre-rendered clips for the cinematic cold open, generated via the
Higgsfield pipeline. Render them already in the **engraved brand grade** so they
cut cleanly into the 2D gameplay (which uses the same duotone + grain + halation).

**Global style (append to / hold constant across both shots):**
> Hand-engraved vintage line-illustration aesthetic, etched crosshatch shading,
> royal pine green + bone + sage duotone palette, 35mm film grain, halation bloom
> on highlights, soft vignette, warm vintage grade. Premium, cinematic, understated.
> Subject: a muscular blue-collar hard-hat ironworker (work shirt with rolled
> sleeves, work pants, belt, work boots, hard hat with a "T" mark) — the Blue
> Collar Country Club "Driver". Setting: an upscale Mediterranean country club
> (cupola, palms, oaks) that is incongruously full of work trucks. Deadpan,
> blue-collar-meets-country-club tone. No on-screen text.

**Model routing:** Seedance 2.0 (default) or Kling 3.0. ~4s each, muted.
**Aspect:** 3:2 (or 16:9 — the player covers/crops). 24fps, subtle motion.

---

## Shot 1 — `intro-truck.mp4` · "The Arrival" (~4s)

> A weathered dump truck rolls up the manicured entrance drive of an exclusive
> country club at golden morning light, kicking up a little dust, palms and a
> Mediterranean clubhouse behind it. Slow, confident push-in on the truck as it
> stops at the first tee. The blue-collar hard-hat golfer is at the wheel.
> Engraved line-illustration look, pine/bone/sage duotone, 35mm grain, halation,
> vignette. Cinematic, unhurried, a touch of swagger. No text.

- Motion: slow dolly-in / light handheld. End on the truck parked, golfer about to step out.

## Shot 2 — `intro-ots.mp4` · "Sizing It Up" (~4s)

> Over-the-shoulder from behind the hard-hat ironworker golfer as he stands at the
> tee and looks out down a long driving range toward a distant flag, driver in
> hand, palms and clubhouse to the side. The camera drifts from the over-the-
> shoulder angle around to a clean side-on profile of him at address. Engraved
> line-illustration look, pine/bone/sage duotone, 35mm grain, halation, vignette.
> Calm, focused, cinematic. No text.

- **Critical:** end the move on a **side-on profile at the tee** (figure on the
  left, range opening to the right) so it match-cuts into the gameplay side-view.
- Motion: arc from OTS to side profile, settle and hold the last ~0.5s.

---

### Wiring
Drop the rendered files in `public/assets/video/`. They're referenced by name in
`src/game/Game.ts` (the `shots` array). The intro auto-plays on load, supports
tap / Skip, and is bypassed under `prefers-reduced-motion`.
