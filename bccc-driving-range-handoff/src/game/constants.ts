import { TUNING } from '../config/tuning';

/** Logical render HEIGHT — fixed; the grade shader's etch/grain frequencies are
 *  tuned around this and it stays constant regardless of device pixel ratio. */
export const H = 460;

/** Logical render WIDTH — responsive. Desktop keeps the authored ~1.48:1 frame;
 *  touch / short-viewport devices (phones in landscape) widen the world to the
 *  device's aspect so the procedural scene fills the screen edge-to-edge instead
 *  of letterboxing. Computed once at load (uses the screen's long:short ratio so
 *  it's correct even if the page loads in portrait, then rotates). The scene is
 *  fully W-parameterized (Background/Range/HUD/Clubhouse), so a wider W just
 *  widens the range vista — no new art needed. */
function computeWidth(): number {
  if (typeof window === 'undefined') return 680;
  const vw = window.innerWidth, vh = window.innerHeight;
  const long = Math.max(vw, vh), short = Math.min(vw, vh) || 1;
  const coarse = window.matchMedia?.('(pointer:coarse)').matches ?? false;
  const widen = coarse || short <= 600; // phones, or short landscape viewports
  if (!widen) return 680; // desktop: the authored 1.48:1 frame, pixel-identical
  // already landscape → match the LIVE viewport exactly (zero side bars);
  // portrait (pre-rotate) → use the screen's long:short as the best estimate.
  const ratio = vw > vh ? vw / vh : long / short;
  const aspect = Math.min(2.6, Math.max(1.48, ratio));
  return Math.round(H * aspect);
}
export const W = computeWidth();

// expose the render aspect to CSS so the mobile layout can size the stage to match
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--game-aspect', (W / H).toFixed(4));
}

/** Ground line (top of the fairway) in screen space. */
export const GROUND = H - TUNING.groundOffset; // 374

export const TAGS = [
  'No Suits, No Ties, Only Good Times',
  'All Trades Welcome',
  'Open 24/7',
  'Members Only',
  'Dirty Hands, Clean Money',
] as const;
