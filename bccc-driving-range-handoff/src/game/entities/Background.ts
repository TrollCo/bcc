import { Container, Graphics } from 'pixi.js';
import { W, GROUND } from '../constants';
import { SCENE } from '../../config/palette';
import type { GameState } from '../state';

/**
 * Sky, parallax sage hills, and engraved clouds. Ported from the prototype's
 * render() sky/hills/cloud section. Source colors are the prototype's; the grade
 * filter remaps them onto the brand ramp.
 */
export class Background {
  readonly view = new Container();
  private sky = new Graphics();
  private hills = new Graphics();
  private clouds = new Graphics();

  constructor() {
    this.view.addChild(this.sky, this.hills, this.clouds);
    this.drawSky(); // static
  }

  private drawSky(): void {
    // approximate the bone morning gradient with horizontal bands (top->bottom)
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = lerpColor(SCENE.skyTop, SCENE.skyBottom, t);
      const y = (GROUND * i) / bands;
      this.sky.rect(0, y, W, GROUND / bands + 1).fill(col);
    }
  }

  redraw(s: GameState): void {
    this.drawHills(s);
    this.drawClouds(s);
  }

  private drawHills(s: GameState): void {
    const g = this.hills;
    g.clear();
    this.hillBand(g, s, 0.25, 0xaeb89c, GROUND - 46, 28);
    this.hillBand(g, s, 0.45, 0x9aa888, GROUND - 26, 22);
  }

  private hillBand(g: Graphics, s: GameState, par: number, color: number, baseY: number, amp: number): void {
    const off = (s.cameraX * par) % 160;
    g.moveTo(0, GROUND);
    for (let x = -off; x <= W; x += 8) {
      const y = baseY - Math.sin((x + s.cameraX * par) / 90) * amp - amp;
      g.lineTo(x, y);
    }
    g.lineTo(W, GROUND);
    g.lineTo(0, GROUND);
    g.fill(color);
  }

  private drawClouds(s: GameState): void {
    const g = this.clouds;
    g.clear();
    for (const c of s.clouds) this.cloud(g, c.x, c.y, c.s);
  }

  private cloud(g: Graphics, x: number, y: number, s: number): void {
    // soft puffy cloud: a union of overlapping circles (closed shapes, so no
    // stray connector lines), filled as one blob. Two passes give a subtle
    // shaded base under a brighter top.
    const puffs: [number, number, number][] = [
      [0, 4, 11], [13, -3, 15], [28, -6, 14], [43, -1, 12], [22, 2, 14], [35, 5, 11],
    ];
    // shaded underside (soft sage), slightly dropped
    for (const [dx, dy, r] of puffs) g.circle(x + dx * s, y + (dy + 3) * s, r * s);
    g.fill({ color: 0x9aa888, alpha: 0.34 });
    // bright body on top
    for (const [dx, dy, r] of puffs) g.circle(x + dx * s, y + dy * s, r * s);
    g.fill({ color: 0xfbf5e6, alpha: 0.92 });
  }
}

/** Linear interpolate two 0xRRGGBB colors. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export { lerpColor };
