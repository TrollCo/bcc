# Assets — drop everything here

Specs for every asset the build needs. Place files in `public/assets/<subfolder>/` in the scaffolded repo. Until an asset exists, the build uses placeholder rectangles.

## Art (`public/assets/art/`)
- **golfer** — the Driver-tee ironworker.
  - Phase 1: `golfer-sheet.png` — 6-pose keyframe sheet, 3×2, 1024×1024, transparent. Build per `bccc-golfer-keyframe-brief.md`.
  - Phase 2: `golfer.riv` — rigged in Rive from the **layered source** (PSD/AI/SVG with hat / head / torso / arms / hands+club / legs / boots on separate layers). Same brief covers the rig pose targets.
- **clubhouse.png** — the Palms engraving (Mediterranean clubhouse, cupola, palms, oaks, work trucks). Transparent PNG, ~1400px wide, sage/pine linework. The real merch art, exported clean.
- **crest.svg** — the BC laurel-and-hardhat crest.
- **hills.png / trees.png** — parallax background layers (or keep procedural).
- **flag.svg** — the pin pennant with BC mark.

## Textures (`public/assets/textures/`)
- **paper-grain.png** — reuse the grain from the **drop-stitcher** skill so the game matches our video grade.
- **halftone.png** — line/dot screen for the crosshatch etch shader (or keep the procedural version from the prototype shader).

## Fonts (`public/assets/fonts/`)
- The **licensed Spencerian script** used for "Blue Collar" on the merch (the prototype substitutes Pinyon Script — replace with the real face).
- The tracked **serif caps** face for "Country Club" / body (prototype uses Cormorant Garamond).

## Audio (`public/assets/audio/`)
- **ambient-loop.mp3** — country-club morning bed (birds, faint breeze, distant mower).
- **sfx:** `tick` (power meter), `lock` (contact), `thwack` (driver impact), `whoosh`, `bounce`, `roll`, `chime` (300+ drive).
- **vo/** — the deadpan announcer reading the grade lines (6–10 short clips, dry, posh-but-blue-collar). Lines map to the grade buckets in the prototype's `gradeShot()`. Optional but high-impact.

## Access (not files — credentials/config for Phase 2)
- Klaviyo API key + the "BCCC Members" list/segment ID.
- Shopify discount config: parent price rule (15% off, single-use, scoped to the BCCC collection, drop-window expiry) OR a pre-generated code pool. See `bccc-backend-spec.md` §2.
- Analytics IDs (GA4 / Meta / TikTok) for the 5 events in the backend spec §4.
