# Blue Collar Country Club — "The Driving Range"
## Engine Build Spec (Route C — Claude Code project)

This is the build plan to rebuild the driving-range mini-game as a real WebGL game with authored art, skeletal animation, and a brand-accurate engraved render — the version where the **actual Driver-tee golfer swings**. It's written to be handed to Claude Code (drop it in the repo as `BUILD.md`) alongside two reference files:

- `bccc-driving-range.html` — the working prototype. **It is the source of truth for game logic, the state machine, the physics/distance model, and all tuning constants.** Port the logic; replace the rendering.
- `bccc-backend-spec.md` — the email/code/leaderboard integrations. Unchanged; wire as written.

---

## 0. Read this before you spend a dollar (the honest gate)

A full engine build is the right call **only** if at least one of these is true:
- This is a **centerpiece campaign asset** for the BCCC drop, not a page filler.
- It will be **reused across future drops** (re-skinnable golf/arcade engine = an asset that amortizes).
- You want a **flagship "BCCC Arcade" moment** worth earned media / social clips.

If it's a one-off bit of page garnish, **Route A** (embed the real merch art as a static hero + lighter animation) gets ~80% of the visual "whoa" for ~20% of the cost. Don't build a Ferrari to drive to the mailbox.

**The long pole is art, not code.** The engine is the easy 30%. Making your real vector golfer *swing* requires someone to cut the illustration into parts and rig it with bones (Section 4). Budget the project around the art/animation labor, not the programming.

**Realistic effort (conservative):**
- Engine + logic port + shaders + MVP frame animation: **3–5 focused days** of dev.
- Skeletal rig of the real golfer (illustrator/animator): **2–4 days** of art, separate skill from code.
- Audio + VO + leaderboard backend + QA/polish + mobile perf pass: **2–3 days**.
- **All-in realistic: ~2 weeks** of mixed art + dev, not a weekend. Anyone quoting less is quoting the code only.

---

## 1. Stack

**Recommended:**
- **Vite + TypeScript** — fast dev server, clean build, type safety for the state machine.
- **PixiJS v8** (WebGL/WebGPU 2D renderer) — fast, mature, first-class custom shader/filter support, great on mobile.
- **Rive** for the golfer animation — modern, free editor, tiny runtime, built specifically to rig a vector illustration and drive it from code via a state machine. This is the lowest-friction path to "the real art swings."
- **Howler.js** for audio.
- **@pixi/sound** acceptable alternative to Howler.

**Animation runtime alternatives (pick one, see Section 4):**
| Option | Editor cost | Why | Why not |
|---|---|---|---|
| **Rive** (recommended) | Free | Web-first, ~tiny runtime, vector-native, code-driven state machine, blends poses | Newer; team must learn the editor |
| **Spine** | Paid (~$69 Essential) | Industry standard, best-in-class mesh deform | License cost; heavier pipeline |
| **DragonBones** | Free | Free Spine-alike, Pixi runtime exists | Less maintained |
| **Sprite-sheet keyframes** | Free | No rigging editor; illustrator draws 6 poses; reads as "engraved/vintage" | Less fluid than rigged |

> **Pragmatic recommendation:** ship the MVP with **sprite-sheet keyframes** (Section 4B) — it's faster, needs no rig, and the limited-frame look actually suits the engraved aesthetic. Move to **Rive** in V2 if you want buttery motion.

---

## 2. Repo structure

Follows the pipeline's lowercase, Drive-synced conventions.

```
bccc-driving-range/
  BUILD.md                 # this spec
  reference/
    bccc-driving-range.html   # logic source of truth
    bccc-backend-spec.md
  public/
    assets/
      art/                 # authored art (PNG w/ alpha, or .riv)
        golfer.riv         # rigged golfer (Route 4A)  OR
        golfer-sheet.png   # keyframe sheet (Route 4B)
        clubhouse.png      # Palms engraving, transparent
        crest.svg          # BC laurel crest
        flag.svg, hills.png, trees.png, trucks.png
      textures/
        paper-grain.png    # brand grain (reuse drop-stitcher grain)
        halftone.png       # dot/line screen for the etch shader
      fonts/               # licensed Spencerian + serif (real typefaces)
      audio/
        thwack.wav, ambient-loop.mp3, vo/*.mp3
  src/
    main.ts
    game/
      StateMachine.ts      # TITLE..SUMMARY (ported from prototype)
      systems/
        Input.ts  SwingMeter.ts  Physics.ts  Camera.ts
        Particles.ts  Audio.ts  Reward.ts  Leaderboard.ts
      entities/
        Golfer.ts  Ball.ts  Range.ts  Clubhouse.ts  HUD.ts
      render/
        filters/  Duotone.ts  Halftone.ts  Grain.ts  Vignette.ts  Halation.ts
        stage.ts
    config/
      tuning.ts            # all constants (Section 7)
      palette.ts           # pine/bone/sage hex
  index.html
  vite.config.ts
  package.json
```

Scaffold:
```bash
npm create vite@latest bccc-driving-range -- --template vanilla-ts
cd bccc-driving-range
npm i pixi.js @rive-app/canvas howler
npm i -D @types/howler
```

---

## 3. Architecture — port the logic, replace the render

The prototype's logic is correct and proven. **Do not redesign it.** Port these 1:1:

- **State machine:** `TITLE → ADDRESS → POWER → CONTACT → SWING → FLIGHT → RESULT → SUMMARY`. Identical transitions and single-tap loop.
- **Swing input:** power gauge (oscillating, lock on tap) → contact needle (sweep over sweet zone, lock on tap) → quality `Q` from distance-to-center. Same forgiving partial-credit curve.
- **Distance model (analytic, then animate to it):** carry/roll from `P` and `Q`, exactly as in the prototype's `startSwing()`. Keep distances feeling right; let the visual arc land on the computed yardage.
- **Camera follow, yard markers, shot-scatter, deadpan grade lines, Members board, reward unlock at `MEMBER_THRESHOLD`.**

What changes is purely the **render layer**: Pixi `Container`s and `Sprite`s instead of `ctx` draw calls, the golfer becomes a rigged/keyframed sprite, and everything passes through the filter stack (Section 5).

Layer order (back → front), each its own Pixi Container for parallax:
1. Sky gradient (bone)
2. Hills (parallax 0.25 / 0.45)
3. **Clubhouse** (parallax 0.45) — authored Palms engraving sprite
4. Clouds
5. Fairway + mow stripes + yard posts (world space)
6. Shot-scatter markers + pin/flag
7. Particles (divot puffs, grass)
8. **Golfer** (rigged) + ball + trail
9. Screen-space: meters, HUD, live distance
10. Full-frame filter stack (Section 5)

---

## 4. The golfer — two paths to "the real art swings"

The Driver-tee illustration is a single static image. To animate it, choose one:

### 4A. Rigged (Rive) — the dream version
1. Illustrator exports the golfer as **separated parts**: `hat`, `head`, `torso`, `upper-arm`, `forearm+hands`, `club`, `back-leg`, `front-leg`, `boots`. Keep the engraved line treatment per part.
2. In Rive: assemble parts, add **bones** (spine, shoulder→elbow→wrist→club, hips→knees→ankles), bind meshes.
3. Build a **State Machine** in Rive with one number input `swing` (0..1) blending poses: `address (0) → top (0.5) → impact (0.70) → follow (1.0)`. Mirror the prototype's `swingAngle(t)` beats so the club is up-and-behind at the top and down at the ball at impact.
4. In code: `riveInstance.setNumberStateMachineInput('swing', swingT)` each frame. The same `swingT` the prototype already computes drives the rig.

> Net: the literal merch art swings, fluidly. Cost is the rig (2–4 art days).

### 4B. Keyframe sprite sheet — the fast version (recommended for MVP)
1. Illustrator draws **6 poses** in BCCC style on one sheet (1024×1024, 3×2, transparent): `address, mid-backswing, top, mid-downswing, impact, follow-through`.
2. Load as Pixi `Spritesheet`; map `swingT` ranges to frames (the prototype's `swingAngle` breakpoints tell you the timing).
3. Hold the **top frame** during the CONTACT aim (it's the hero frame); flip through down→impact→follow on release.

> Less fluid, but the staccato reads as engraved/vintage and needs **no rigging editor**. Six poses is a tractable illustration ask. **Start here.**

A **keyframe pose brief** for the illustrator can be generated on request (angles, club position, weight shift per frame, matched to the swing math).

---

## 5. The render — nailing the engraved look (this is where the "WAY better" lives)

Stack these as PixiJS `Filter`s (fragment shaders). This is what makes shapes-and-sprites read as a premium etched print. It also keeps every input on-palette regardless of source art.

1. **Duotone / palette lock** — map luminance to the brand ramp (pine `#1f3a2e` → sage `#93a384` → bone `#ece3cf`). Everything obeys the BCCC palette automatically.
   ```glsl
   // sketch — duotone fragment
   vec4 c = texture2D(uSampler, vTextureCoord);
   float l = dot(c.rgb, vec3(0.299,0.587,0.114));
   vec3 lo = vec3(0.122,0.227,0.180);   // pine
   vec3 mid= vec3(0.576,0.640,0.518);   // sage
   vec3 hi = vec3(0.925,0.890,0.812);   // bone
   vec3 col = l < 0.5 ? mix(lo,mid,l*2.0) : mix(mid,hi,(l-0.5)*2.0);
   gl_FragColor = vec4(col, c.a);
   ```
2. **Halftone / crosshatch** — sample a screen texture (or procedural lines) modulated by luminance for the etched shading. Subtle; this sells "engraving."
3. **Paper grain** — multiply-blend the brand grain texture (reuse the `drop-stitcher` grain so it matches the video pipeline). Low opacity, animated jitter optional.
4. **Halation + vignette + fine film grain** — port the *exact* aesthetic from the `drop-stitcher` skill (35mm grain, halation bloom on highlights, vintage grade, vignette) so the game color-matches the brand's video output. This single move makes it feel like part of the brand, not a separate toy.

Tie #4 to drop-stitcher so the game, the drop reel, and the ads all share one grade.

---

## 6. Audio

- **Ambient loop:** low country-club morning bed — distant birds, faint breeze, a far-off mower. Sells place.
- **SFX:** power-meter tick, contact lock, a real driver **thwack** at impact, ball whoosh, bounce, roll-to-stop, pin chime on a 300+.
- **VO (optional, high-impact):** the deadpan club announcer reading the grade lines. Record a voice actor or generate; keep it dry and posh-but-blue-collar. 6–10 short lines mapped to the grade buckets already in the prototype.
- Howler with a master mute (respect the existing Sound toggle); autoplay-safe (init on first tap).

---

## 7. Tuning & config

Move every constant into `config/tuning.ts`, seeded from the prototype's current values:

```ts
export const TUNING = {
  MEMBER_THRESHOLD: 300,   // yd to earn membership
  BALLS_PER_ROUND: 3,
  powerSpeed: 1.62,
  contactSpeed: 2.55,
  sweetWidth: 0.105,       // half-width of contact sweet zone
  pxPerYard: 2.55,
  // distance model (carry/roll) — see prototype startSwing()
};
```
Keep the analytic distance model from the prototype verbatim; it's tuned for feel. Re-tune `MEMBER_THRESHOLD` from live data so ~40–60% of round-completers unlock (rationale in the backend spec).

---

## 8. Backend, build, deploy, performance

- **Backend:** implement `bccc-backend-spec.md` as written — Klaviyo email capture, single-use Shopify code, optional weekly leaderboard, 5 analytics events. No changes.
- **Build:** `vite build` → static bundle. Embed on the drop page via responsive `<iframe>`; bubble analytics + the email payload up via `postMessage` so keys stay off the client.
- **Performance budget (mobile-first):** 60fps on a mid-tier phone; total initial payload **< 4 MB** (compress art, use texture atlases, lazy-load audio); WebGL context-loss handling; respect `prefers-reduced-motion` (offer a static-backdrop fallback). Test on real iOS Safari + Android Chrome, not just desktop.

---

## 9. Phased plan (ship value early)

**Phase 1 — MVP (looks 5× better, ~1 week):**
Vite+Pixi scaffold · port state machine + physics + meters from the prototype · authored **clubhouse + hills + crest** sprites (your real art or Route-B generated) · **keyframe sprite-sheet golfer (4B)** · duotone + grain + vignette filters · basic SFX · existing local leaderboard. **This alone clears the bar you're asking about.**

**Phase 2 — Flagship (~1 more week):**
Rive-rigged golfer (4A) · full halftone/halation shader stack matched to drop-stitcher · ambient bed + VO announcer · live Klaviyo + Shopify code + weekly Members board · analytics events · mobile perf pass + QA.

---

## 10. Kicking it off in Claude Code

1. Create the repo, drop in this `BUILD.md` + the two `reference/` files + whatever art you have.
2. Prompt Claude Code: *"Scaffold per BUILD.md Phase 1. Port all game logic, the state machine, the physics/distance model, and tuning constants from reference/bccc-driving-range.html verbatim — only replace the render layer with PixiJS. Use placeholder rectangles for any art not yet in public/assets, and wire the duotone+grain+vignette filter stack."*
3. Hand the illustrator the **6-pose keyframe brief** (ask me to generate it) so art and code proceed in parallel.
4. Bring it up on the Mac mini once active; the build is a standard Node/Vite project (`npm i && npm run dev`).

**Dependencies to have ready:** the real Driver-tee golfer + Palms artwork (layered/exportable), the licensed Spencerian + serif typefaces, the brand grain texture from drop-stitcher, and Shopify/Klaviyo API access for Phase 2.

---

### Bottom line
The engine is straightforward and the logic already exists. The quality ceiling — and the cost — is set by the **art and animation**, not the code. Phase 1 with the keyframe golfer is the smart first ship; it will look dramatically better than the canvas prototype while keeping the rigging investment optional until you've proven the asset earns its place on the page.
