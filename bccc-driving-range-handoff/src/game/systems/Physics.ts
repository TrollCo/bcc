import { TUNING } from '../../config/tuning';
import { GROUND } from '../constants';
import type { GameState } from '../state';

/**
 * The analytic distance model + ball-flight integrator, ported VERBATIM from the
 * prototype's startSwing() and the FLIGHT branch of update(). Tuned for feel, not
 * realism — do not change the coefficients (they live in config/tuning.ts).
 */
export const Physics = {
  /**
   * Resolve the shot from locked power (P) and quality (Q): carry + roll -> total
   * yardage, then set up the flight (carry distance, apex, time constant).
   */
  startSwing(s: GameState): void {
    const P = s.lockedPower;
    const Q = s.lockedQ;

    const carry = (TUNING.carryBase + TUNING.carryPower * P) * (TUNING.carryQMin + TUNING.carryQRange * Q);
    const roll = (TUNING.rollBase + TUNING.rollQ * Q) * (TUNING.rollPMin + TUNING.rollPRange * P);
    s.resultYd = Math.max(TUNING.minYards, Math.round(carry + roll));

    const b = s.ball;
    b.totalPx = s.resultYd * TUNING.PXY;
    b.carryPx = b.totalPx * (TUNING.carryFracBase + TUNING.carryFracQ * Q);
    b.rollFrom = b.carryPx;
    b.apex = Math.max(TUNING.apexMin, Math.min(TUNING.apexMax, s.resultYd * TUNING.apexFactor * (TUNING.apexQMin + TUNING.apexQRange * Q)));
    b.Tc = TUNING.flightTimeBase + s.resultYd / TUNING.flightTimeDiv;
    b.p = 0;
    b.rolling = false;
    b.done = false;
    b.trail = [];
  },

  /**
   * Advance the ball during FLIGHT. Returns true on the frame the ball comes to
   * rest (caller should land the shot). Mirrors the prototype's flight branch.
   */
  stepFlight(s: GameState, dt: number, onCarryEnd: () => void): boolean {
    const b = s.ball;
    if (!b.rolling) {
      b.p += dt / b.Tc;
      if (b.p >= 1) {
        b.p = 1;
        b.rolling = true;
        b.rollT = 0;
        b.rollDur = TUNING.rollDurBase + (b.totalPx - b.carryPx) / TUNING.rollDurDiv;
        onCarryEnd();
      }
      b.x = b.carryPx * b.p;
      const h = 4 * b.apex * b.p * (1 - b.p); // parabolic carry arc
      b.y = GROUND - h;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 16) b.trail.shift();
    } else {
      b.rollT += dt;
      const rp = Math.min(1, b.rollT / b.rollDur);
      const ease = 1 - Math.pow(1 - rp, 2);
      b.x = b.rollFrom + (b.totalPx - b.rollFrom) * ease;
      b.y = GROUND;
      if (rp >= 1) return true;
    }
    return false;
  },
};
