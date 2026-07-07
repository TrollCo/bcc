# Intro clips (Path A — cinematic cold open)

Drop the two pre-rendered intro shots here. The engine plays them on load in
order, then cuts to the title screen. Until a file is present, a labeled slate
stands in (so the sequence still runs).

| File | Shot | Notes |
|---|---|---|
| `intro-truck.mp4` | The Arrival — dump truck pulls up to the first tee | ~4s |
| `intro-ots.mp4` | Over-the-shoulder at the tee, range opens up | ~4s; END framed to match the side-view for a clean match-cut to gameplay |

**Specs**
- Format: `.mp4` (H.264), muted (the intro autoplays muted; SFX/VO come from the game audio system).
- Aspect: 3:2 to match the 680×460 stage (16:9 also fine — it's `object-fit: cover`).
- Look: render already in the engraved brand grade (pine/sage/bone duotone, 35mm
  grain, halation, vignette) so the clips match gameplay — see
  `reference/intro-shot-prompts.md` for the generation prompts.
- Keep them short and light (≤ ~2–3 MB each) for the mobile payload budget.

Generated via the Higgsfield pipeline (Seedance 2.0 / Kling 3.0). Filenames are
referenced in `src/game/Game.ts` (the `shots` array) — change there if you rename.
