import { GROUND, W } from './constants';
import { STATE } from './StateMachine';

/** Spread clouds across the (responsive) world width so a wider W isn't bare. */
function makeClouds(): { x: number; y: number; s: number }[] {
  const ys = [70, 46, 84, 58, 50];
  const ss = [1, 1.3, 0.9, 1.15, 0.85];
  const n = Math.max(3, Math.round(W / 230));
  return Array.from({ length: n }, (_, i) => ({
    x: 50 + (i * (W - 100)) / Math.max(1, n - 1),
    y: ys[i % ys.length],
    s: ss[i % ss.length],
  }));
}

/** Ball flight state — mirrors the prototype's `ball` object. */
export interface BallState {
  x: number;
  y: number;
  carryPx: number;
  totalPx: number;
  apex: number;
  p: number; // carry progress 0..1
  Tc: number; // carry time constant (s)
  rolling: boolean;
  rollFrom: number;
  rollT: number;
  rollDur: number;
  done: boolean;
  trail: { x: number; y: number }[];
}

export interface Puff {
  x: number;
  y: number;
  life: number;
  max: number;
}

export interface Cloud {
  x: number;
  y: number;
  s: number;
}

/**
 * The single mutable game state, ported 1:1 from the prototype's module-level
 * vars. Systems and entities read/write this object; there is exactly one.
 */
export type Handed = 'L' | 'R';

export interface GameState {
  state: STATE;

  // handedness — moves the vertical power meter to the opposite side (player pref)
  handed: Handed;

  // round
  ballIndex: number; // 0..BALLS_PER_ROUND-1
  bestDrive: number;
  totalYds: number;
  shots: { xpx: number; yd: number }[]; // landed-marker scatter

  // swing meters
  power: number;
  powerDir: number;
  contact: number;
  contactDir: number;
  lockedPower: number;
  lockedQ: number;

  // swing animation
  swingT: number; // 0 address, .5 top, ~.7 impact, 1 follow
  swinging: boolean;
  swingLaunched: boolean;

  // ball flight
  ball: BallState;
  resultYd: number;
  resultGrade: string;
  resultLine: string;

  // camera & fx
  cameraX: number;
  puffs: Puff[];
  clouds: Cloud[];
}

/** Persisted handedness preference (defaults right-handed). */
function loadHanded(): Handed {
  try { return localStorage.getItem('bccc-handed') === 'L' ? 'L' : 'R'; } catch { return 'R'; }
}

export function createState(): GameState {
  return {
    state: STATE.TITLE,
    handed: loadHanded(),

    ballIndex: 0,
    bestDrive: 0,
    totalYds: 0,
    shots: [],

    power: 0,
    powerDir: 1,
    contact: 0,
    contactDir: 1,
    lockedPower: 0,
    lockedQ: 0,

    swingT: 0,
    swinging: false,
    swingLaunched: false,

    ball: {
      x: 0,
      y: GROUND,
      carryPx: 0,
      totalPx: 0,
      apex: 0,
      p: 0,
      Tc: 1,
      rolling: false,
      rollFrom: 0,
      rollT: 0,
      rollDur: 0,
      done: false,
      trail: [],
    },
    resultYd: 0,
    resultGrade: '',
    resultLine: '',

    cameraX: 0,
    puffs: [],
    clouds: makeClouds(),
  };
}
