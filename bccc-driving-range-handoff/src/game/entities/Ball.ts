import { Graphics } from 'pixi.js';
import { Camera } from '../systems/Camera';
import { SCENE } from '../../config/palette';
import { STATE } from '../StateMachine';
import type { GameState } from '../state';

/** The ball + its dotted flight trail. Visible during FLIGHT and RESULT. Ported
 *  from the ball/trail block of render(). */
export class Ball {
  readonly view = new Graphics();

  redraw(s: GameState): void {
    const g = this.view;
    g.clear();
    if (s.state !== STATE.FLIGHT && s.state !== STATE.RESULT) return;

    const b = s.ball;
    // trail
    for (let t = 0; t < b.trail.length; t++) {
      const tt = b.trail[t];
      const al = (t / b.trail.length) * 0.4;
      g.circle(Camera.worldToScreen(s, tt.x), tt.y, 1.6).fill({ color: 0x14160f, alpha: al });
    }
    // ball
    const bx = Camera.worldToScreen(s, b.x);
    g.circle(bx, b.y - 6, 5).fill(SCENE.ball).stroke({ width: 1, color: 0x23402f, alpha: 0.5 });
  }
}
