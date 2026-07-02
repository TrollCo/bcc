import { W } from '../constants';
import type { GameState } from '../state';

/** Particle/ambient motion — divot puffs and drifting clouds. Ported from the prototype. */
export const Particles = {
  spawnPuff(s: GameState, x: number, y: number, life: number): void {
    s.puffs.push({ x, y, life, max: life });
  },

  /** Tick puff lifetimes and drift the clouds. */
  update(s: GameState, dt: number): void {
    for (let i = 0; i < s.clouds.length; i++) {
      s.clouds[i].x += dt * 4 * s.clouds[i].s;
      if (s.clouds[i].x > W + 80) s.clouds[i].x = -80;
    }
    for (let j = s.puffs.length - 1; j >= 0; j--) {
      s.puffs[j].life -= dt;
      if (s.puffs[j].life <= 0) s.puffs.splice(j, 1);
    }
  },
};
