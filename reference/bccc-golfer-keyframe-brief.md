# BCCC "Driver" Golfer — 6-Pose Keyframe Brief
## For the illustrator · feeds Phase 1 sprite-sheet (and the Rive rig later)

Goal: six drawings of the Blue Collar Country Club hard-hat golfer that play back as a golf swing in the game. The game holds the **TOP** frame while the player aims, then plays **down → impact → follow** on release. Frame timing and club angles below are pulled directly from the game's swing math, so the animation and physics line up.

---

## Global style (every frame)
- **Subject:** the BCCC Driver-tee ironworker — muscular, hard hat with the Troll "T," button work shirt (sleeves rolled), work pants + belt, work boots. Same man, same build, every frame.
- **Treatment:** hand-engraved line illustration, **sage green on transparent** (game tints to palette; deliver as if printing sage `#93A384` line + shading on dark). Match the Driver-tee rendering — etched hatching for muscle and fabric folds, confident line weight.
- **View:** ¾ back/side, facing the target (screen right), exactly as the Driver tee. Consistent across all six.
- **Reads at 200px tall.** Don't over-detail past what survives at game scale; keep the silhouette legible.

## Registration (critical — prevents jitter)
- Identical figure scale and a **fixed ground line** in every cell.
- Keep the **lead foot + ball position locked** at the same screen point across all frames; the body rotates around it. If feet drift frame-to-frame, the swing will look like it's sliding.
- Single consistent pivot: the **hands/grip** travel along a smooth arc — front of the body (low) → up behind the trail shoulder → back down to the ball → up over the lead shoulder.

## Delivery
- **6 cells, 3×2 grid, 1024×1024 PNG, transparent.** One figure per cell, centered on its registration point.
- Also provide **layered source** (PSD/AI/SVG) with parts on separate layers — `hat / head / torso / lead-arm / trail-arm / hands+club / lead-leg / trail-leg / boots`. This unlocks the Rive rig in Phase 2 with no redraw.
- Name cells `golfer_01`…`golfer_06` in the order below.

---

## The six frames

| # | Frame | Game time | Club / hands | Body |
|---|---|---|---|---|
| 01 | **Address** | t = 0.0 | Club low, head of club at the ball on the tee in front of him; hands at thigh height, arms relaxed-straight. Shaft angles down-forward. | Athletic stance, knees slightly bent, weight centered, slight forward spine tilt. Looking down at the ball. |
| 02 | **Mid-backswing** | t ≈ 0.25 | Club swung back to roughly **horizontal**, pointing behind him (away from target). Hands at waist/ribcage height on the trail side. | Shoulders beginning to coil; weight shifting to trail (back) leg; lead arm straight. |
| 03 | **TOP — hero frame** | t = 0.5 | **Hands high, club up and behind the trail shoulder**, shaft pointing up/back. Fully coiled. | Max shoulder turn, broad back to camera, weight loaded on trail leg, lead heel may lift slightly. **This is the held frame — make it the strongest, most heroic drawing.** |
| 04 | **Mid-downswing** | t ≈ 0.60 | Club dropping **into the slot from inside** — shaft back to ~horizontal-behind but now descending, hands leading ahead of the clubhead. | Hips firing open toward target ahead of the upper body; weight transferring to lead leg. Tension/torque visible. |
| 05 | **Impact** | t = 0.70 | Clubhead **down at the ball**, shaft near-vertical at the bottom of the arc, hands slightly ahead of the ball. *(Ball launches on this frame.)* | Hips open, head still down/behind the ball, full extension through the hit. The power frame. |
| 06 | **Follow-through** | t = 1.0 | Club **up and over the lead shoulder**, finishing high in front; hands high by the lead ear. | Fully unwound, chest facing target, weight on lead leg, trail toe up. Balanced, triumphant finish. |

> Rigger's reference (Rive/Spine), grip-arc angle of the club relative to the shoulder per frame: **01 ≈ 55° · 02 ≈ 130° · 03 ≈ 205° (top) · 04 ≈ 144° · 05 ≈ 82° (impact) · 06 ≈ −42° (finish).** Measured screen-space, 0° = pointing toward target, increasing counter-clockwise.

---

## Acceptance check
- Lay all six in sequence (1→6) — the grip traces one smooth continuous arc, no pops.
- Frame 03 holds beautifully on its own (it's on screen the longest).
- Frame 05 reads as the moment of contact, club at the ball.
- Feet/ball registration identical across all six.
- Hard-hat "T" and shirt/pant/boot details consistent frame to frame.
