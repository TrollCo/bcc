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
  // Decorative pin marker position. Placed BEYOND the max drive (358) and outside
  // the address frame on every aspect (widest ~2.5:1 needs >381yd to be offscreen)
  // so the camera chases the ball into new ground and the flag slides in late —
  // flight reads as distance covered, not slow motion. Also clears the TAP cue
  // entirely. Purely visual — scoring is distance-based, independent of the flag.
  PIN_MARKER_YD: 385,

  // ---- swing meters ----
  // eased 2026-06-08 (owner calls): power 1.62->1.40->1.55; contact 2.55->2.25->2.0->1.85->2.05 —
  // the meters are the difficulty knob (NOT the distance model, which stays as-is)
  powerSpeed: 1.55, // power oscillation speed
  contactSpeed: 2.05, // contact needle sweep speed (skill gate)
  SWEET: 0.5, // center of the contact sweet zone (0..1 across the bar)
  SWEET_W: 0.105, // half-width of the sweet zone (~21% of the bar)
  contactForgiveness: 0.85, // Q = 1 - off/SWEET_W * this
  // Perfect-lock snap windows (2026-07-06): a mathematically exact double-perfect
  // (P=1.000, Q=1.000 -> the 358 ceiling) was a sub-millisecond frame lottery —
  // tap close enough and it counts as perfect, so the max is earned by skill.
  // Widened same day for touch: the 0.0084 contact snap was an ~8ms finger
  // window — under mobile touch-latency jitter (±25ms) flushes were unreachable
  // and 340+ never fired on phones.
  powerSnap: 0.97, // lock at >= this -> P = 1.0 (~39ms window at the peak)
  contactSnapOff: 0.02, // |contact-0.5| <= this -> Q = 1.0 (inner ~19% of the gold zone, ~20ms)

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
  // raised 2026-07-06 (owner calls: more height, then higher still) —
  // 50/210/0.92 -> 60/265/1.05 -> 70/305/1.15. A flushed bomb now peaks just
  // above the clouds (~y=70 of the 460 frame). Purely visual; distances unchanged.
  apexMin: 70,
  apexMax: 305,
  apexFactor: 1.15, // apex ~ resultYd * apexFactor * (0.7 + 0.3*Q)
  apexQMin: 0.7,
  apexQRange: 0.3,
  // stretched 2026-07-06 (owner calls: more hang time, then floatier still) —
  // 0.85/520 -> 1.0/400 -> 1.15/330; roll 0.55/600 -> 0.7/450.
  // Presentation only: flight DURATION, not the distance model (resultYd unchanged).
  flightTimeBase: 1.15, // Tc = base + resultYd/timeDiv
  flightTimeDiv: 330,
  // Horizontal speed shape through the carry (owner call 2026-07-06: real ball
  // physics — hot off the face, decelerating into the landing, not constant).
  // progress e = mix*(1-(1-p)^pow) + (1-mix)*p  ->  launch ~1.9x the average
  // speed, touchdown ~0.5x (touchdown = 1-mix; 0.25x then 0.4x both caught/
  // stalled right at the landing — owner calls). Also shifts the apex forward /
  // steepens the descent in distance terms, like a real drive. Presentation only.
  carryEasePow: 2.8, // ease-out exponent (higher = punchier launch)
  carryEaseMix: 0.5, // ease vs linear blend (1 = full ease, 0 = old constant speed)
  // (rollDurBase/rollDurDiv retired 2026-07-06 — roll duration is now derived in
  // Physics.stepFlight so the roll starts at exactly the landing speed)

  // ---- world / camera ----
  PXY: 2.55, // pixels per yard (world space)
  GX0: 150, // golfer screen-x when camera at 0
  cameraLead: 230, // camera keeps the ball this many px from the left edge
  groundOffset: 86, // GROUND = H - this
} as const;

export type Tuning = typeof TUNING;
