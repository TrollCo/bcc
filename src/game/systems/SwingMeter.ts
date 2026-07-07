import { TUNING } from '../../config/tuning';
import type { GameState } from '../state';

/**
 * Swing meters — the two-tap skill gate, ported verbatim from the prototype.
 * 1) POWER: a gauge oscillates 0..1; tap locks `lockedPower`.
 * 2) CONTACT: a needle sweeps 0..1; tap computes quality `Q` from the distance
 *    to the sweet-zone center, with the same forgiving partial-credit curve.
 */
export const SwingMeter = {
  /** POWER state: oscillate the power gauge. */
  updatePower(s: GameState, dt: number): void {
    s.power += s.powerDir * TUNING.powerSpeed * dt;
    if (s.power >= 1) {
      s.power = 1;
      s.powerDir = -1;
    }
    if (s.power <= 0) {
      s.power = 0;
      s.powerDir = 1;
    }
  },

  /** CONTACT state: ease the club toward top-of-backswing while the needle sweeps. */
  updateContact(s: GameState, dt: number): void {
    s.swingT += (0.5 - s.swingT) * Math.min(1, dt * TUNING.contactEase);
    s.contact += s.contactDir * TUNING.contactSpeed * dt;
    if (s.contact >= 1) {
      s.contact = 1;
      s.contactDir = -1;
    }
    if (s.contact <= 0) {
      s.contact = 0;
      s.contactDir = 1;
    }
  },

  /** Lock power on tap (POWER -> CONTACT). */
  lockPower(s: GameState): void {
    s.lockedPower = s.power;
  },

  /** Lock contact on tap (CONTACT -> SWING); returns the resulting quality Q. */
  lockContact(s: GameState): number {
    const off = Math.abs(s.contact - TUNING.SWEET);
    let q = Math.max(0, 1 - (off / TUNING.SWEET_W) * TUNING.contactForgiveness);
    q = Math.min(1, q);
    s.lockedQ = q;
    return q;
  },
};
