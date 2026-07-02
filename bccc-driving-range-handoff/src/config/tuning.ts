/**
 * All gameplay tuning constants, seeded verbatim from the prototype
 * (reference/bccc-driving-range.html). Do NOT retune the distance model by feel —
 * it is balanced. Tune MEMBER_THRESHOLD from live data so ~40-60% of round
 * completers unlock (rationale: bccc-backend-spec.md §0 / §6).
 */
export const TUNING = {
  // ---- reward gate ----
  MEMBER_THRESHOLD: 300, // yards for a single drive to earn membership
  CHEER_THRESHOLD: 340, // yards for the full crowd roar (clap plays at 300+)
  BALLS_PER_ROUND: 3,
  // Decorative pin marker position. A hair short of MEMBER_THRESHOLD (300) so the
  // tall flag sits just left of the natural-thumb-height TAP cue instead of under
  // it; purely visual — scoring is distance-based, independent of the flag.
  PIN_MARKER_YD: 273,

  // ---- swing meters ----
  // eased 2026-06-08 (owner calls): power 1.62->1.40->1.55; contact 2.55->2.25->2.0->1.85 —
  // the meters are the difficulty knob (NOT the distance model, which stays as-is)
  powerSpeed: 1.55, // power oscillation speed
  contactSpeed: 1.85, // contact needle sweep speed (skill gate)
  SWEET: 0.5, // center of the contact sweet zone (0..1 across the bar)
  SWEET_W: 0.105, // half-width of the sweet zone (~21% of the bar)
  contactForgiveness: 0.85, // Q = 1 - off/SWEET_W * this

  // ---- swing animation timing (drives swingAngle + frame mapping) ----
  contactEase: 11, // how fast the club eases to top-of-backswing while aiming
  swingSpeed: 3.4, // swingT progression during the SWING state
  flightSwingSpeed: 3.0, // swingT continues during FLIGHT (follow-through)
  impactT: 0.7, // swingT at which the ball launches

  // ---- distance model (analytic; see Physics.startSwing) ----
  // carry = (carryBase + carryPower*P) * (carryQMin + carryQRange*Q)
  carryBase: 110,
  carryPower: 210,
  carryQMin: 0.55,
  carryQRange: 0.45,
  // roll  = (rollBase + rollQ*Q) * (rollPMin + rollPRange*P)
  rollBase: 8,
  rollQ: 30,
  rollPMin: 0.5,
  rollPRange: 0.5,
  minYards: 8,

  // flight shape
  carryFracBase: 0.82, // fraction of total that is carry (+ carryFracQ*Q)
  carryFracQ: 0.06,
  apexMin: 50,
  apexMax: 210,
  apexFactor: 0.92, // apex ~ resultYd * apexFactor * (0.7 + 0.3*Q)
  apexQMin: 0.7,
  apexQRange: 0.3,
  flightTimeBase: 0.85, // Tc = base + resultYd/timeDiv
  flightTimeDiv: 520,
  rollDurBase: 0.55, // rollDur = base + (totalPx - carryPx)/rollDurDiv
  rollDurDiv: 600,

  // ---- world / camera ----
  PXY: 2.55, // pixels per yard (world space)
  GX0: 150, // golfer screen-x when camera at 0
  cameraLead: 230, // camera keeps the ball this many px from the left edge
  groundOffset: 86, // GROUND = H - this
} as const;

export type Tuning = typeof TUNING;
