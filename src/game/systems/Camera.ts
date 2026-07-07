import { TUNING } from '../../config/tuning';
import type { GameState } from '../state';

/**
 * Camera — world-to-screen mapping and ball-follow, ported from the prototype.
 * The golfer sits at world x = 0 (screen x = GX0 when camera at 0); the camera
 * trails the ball so it stays `cameraLead` px from the left during flight.
 */
export const Camera = {
  /** World x (px) -> screen x (px). */
  worldToScreen(s: GameState, xpx: number): number {
    return TUNING.GX0 + xpx - s.cameraX;
  },

  /** Follow the ball during flight. */
  follow(s: GameState): void {
    s.cameraX = Math.max(0, s.ball.x - TUNING.cameraLead);
  },

  reset(s: GameState): void {
    s.cameraX = 0;
  },
};
