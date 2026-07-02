import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { W, GROUND } from '../constants';
import type { GameState } from '../state';

/**
 * The Palms clubhouse engraving — Mediterranean clubhouse with cupola, palms,
 * oaks, and parked work trucks (the BCCC joke). Ported from drawClubhouse() and
 * its helpers. Drawn ONCE into a Graphics at local origin (cx = 0, baseY =
 * GROUND); parallax is just the container's x each frame. Phase 1 placeholder for
 * the authored clubhouse.png (assets/README.md).
 */
const PINE = { color: 0x23402f, alpha: 0.62 };
const SAGE = { color: 0x6f7e62, alpha: 0.5 };
const BONE = { color: 0xece3cf, alpha: 0.32 };
const ROOF = { color: 0x6f7e62, alpha: 0.3 };
const TILE = { color: 0x23402f, alpha: 0.32 };

export class Clubhouse {
  readonly view = new Container();
  private g = new Graphics();

  // clean no-vehicles clubhouse scene (palms-clubhouse.png, pre-cropped +
  // solidified). Uses the whole texture (resolution-independent), sized small and
  // set back on the horizon so green shows in front of it and behind the golfer.
  private static readonly HERO = {
    width: 430, // rendered backdrop width in game px (smaller = further away)
    offsetX: 36, // nudged right of the tee
    baseRaise: 40, // lift the base off the ground line, onto the distant horizon
  };

  constructor() {
    this.view.addChild(this.g);
    this.build(0, GROUND);
  }

  /** Mount the authored Palms engraving in place of the procedural backdrop. */
  setHeroArt(base: Texture): void {
    const H = Clubhouse.HERO;
    const sprite = new Sprite(base);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(H.width / base.width); // resolution-independent
    sprite.position.set(H.offsetX, GROUND - H.baseRaise); // set back on the horizon
    this.view.addChild(sprite);
    this.g.visible = false; // hide procedural clubhouse
  }

  /** Reposition for parallax (matches drawClubhouse cx = W*0.5 - cameraX*0.45). */
  redraw(s: GameState): void {
    this.view.x = W * 0.5 - s.cameraX * 0.45;
  }

  private build(cx: number, baseY: number): void {
    const g = this.g;

    // flanking oaks + towering palms (as in the print)
    this.oak(g, cx - 186, baseY - 2, 30, SAGE);
    this.oak(g, cx + 186, baseY - 2, 30, SAGE);
    this.palm(g, cx - 150, baseY - 2, 152, PINE);
    this.palm(g, cx - 110, baseY - 2, 120, SAGE);
    this.palm(g, cx + 110, baseY - 2, 120, SAGE);
    this.palm(g, cx + 150, baseY - 2, 152, PINE);

    // building base + wings
    const bw = 210;
    const bh = 54;
    const bx = cx - bw / 2;
    const by = baseY - bh;
    g.rect(bx, by, bw, bh).fill(BONE).stroke({ width: 1.2, ...PINE });

    // wing tiled hip roof
    g.moveTo(bx - 7, by).lineTo(bx + 26, by - 16).lineTo(bx + bw - 26, by - 16).lineTo(bx + bw + 7, by).closePath();
    g.fill(ROOF).stroke({ width: 1.2, ...PINE });
    g.moveTo(bx - 3, by - 5).lineTo(bx + bw + 3, by - 5).stroke({ width: 0.8, ...TILE });
    g.moveTo(bx + 13, by - 11).lineTo(bx + bw - 13, by - 11).stroke({ width: 0.8, ...TILE });

    // central pavilion
    const pw = 68;
    const pbx = cx - pw / 2;
    const pby = by - 26;
    g.rect(pbx, pby, pw, 26).fill(BONE).stroke({ width: 1.2, ...PINE });
    g.moveTo(pbx - 5, pby).lineTo(cx - 16, pby - 15).lineTo(cx + 16, pby - 15).lineTo(pbx + pw + 5, pby).closePath();
    g.fill(ROOF).stroke({ width: 1.2, ...PINE });
    g.moveTo(pbx - 1, pby - 5).lineTo(pbx + pw + 1, pby - 5).stroke({ width: 0.8, ...TILE });

    // cupola tower w/ arched openings + pyramidal roof + finial
    const tw = 22;
    const tx = cx - tw / 2;
    const ty = pby - 15 - 17;
    g.rect(tx, ty, tw, 17).fill(BONE).stroke({ width: 1.2, ...PINE });
    this.archWin(g, cx - 5, ty + 14, 3, PINE);
    this.archWin(g, cx + 5, ty + 14, 3, PINE);
    g.moveTo(tx - 3, ty).lineTo(cx, ty - 13).lineTo(tx + tw + 3, ty).closePath();
    g.fill(ROOF).stroke({ width: 1.2, ...PINE });
    g.moveTo(cx, ty - 13).lineTo(cx, ty - 18).stroke({ width: 1, ...PINE });

    // arched central entry
    g.moveTo(cx - 10, baseY).lineTo(cx - 10, by + 18);
    g.arc(cx, by + 18, 10, Math.PI, 0).lineTo(cx + 10, baseY).stroke({ width: 1.3, ...PINE });

    // arched windows along the wings
    for (let wx = bx + 20; wx < cx - 22; wx += 20) this.archWin(g, wx, by + 36, 6, PINE);
    for (let wx2 = cx + 22; wx2 < bx + bw - 16; wx2 += 20) this.archWin(g, wx2, by + 36, 6, PINE);

    // hedge line + receding walkway
    for (let hx = bx - 4; hx <= bx + bw + 4; hx += 8) {
      g.moveTo(hx, baseY).quadraticCurveTo(hx + 4, baseY - 5, hx + 8, baseY);
    }
    g.stroke({ width: 2, ...SAGE });
    g.moveTo(cx - 10, baseY).lineTo(cx - 36, baseY + 13);
    g.moveTo(cx + 10, baseY).lineTo(cx + 36, baseY + 13);
    g.stroke({ width: 1, ...SAGE });

    // work trucks parked out front
    this.truck(g, cx - 104, baseY + 3, 'bucket', PINE);
    this.truck(g, cx - 58, baseY + 3, 'van', SAGE);
    this.truck(g, cx + 20, baseY + 3, 'mixer', SAGE);
    this.truck(g, cx + 66, baseY + 3, 'dump', PINE);
  }

  private palm(g: Graphics, x: number, baseY: number, h: number, color: { color: number; alpha: number }): void {
    const stroke = { width: 1.5, cap: 'round' as const, ...color };
    g.moveTo(x, baseY).quadraticCurveTo(x + 6, baseY - h * 0.5, x - 3, baseY - h).stroke(stroke);
    const tx = x - 3;
    const ty = baseY - h;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.96 + i * ((Math.PI * 1.92) / (n - 1));
      const len = 18 + (i % 2 ? 5 : 0);
      const ex = tx + Math.cos(a) * len;
      const ey = ty + Math.sin(a) * len * 0.62 - 4;
      const mx = tx + Math.cos(a) * len * 0.5;
      const my = ty - 11;
      g.moveTo(tx, ty).quadraticCurveTo(mx, my, ex, ey).stroke(stroke);
    }
    g.circle(tx, ty + 1, 1.5).fill(color);
  }

  private oak(g: Graphics, x: number, baseY: number, r: number, color: { color: number; alpha: number }): void {
    g.moveTo(x, baseY).lineTo(x, baseY - r * 0.7).stroke({ width: 1.4, ...color });
    const cyc = baseY - r * 0.7 - r * 0.5;
    const bumps = 10;
    for (let i = 0; i <= bumps; i++) {
      const a = (Math.PI * 2 * i) / bumps;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 1.9));
      const px = x + Math.cos(a) * rr;
      const py = cyc + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill({ color: 0x6f7e62, alpha: 0.16 }).stroke({ width: 1.4, ...color });
  }

  private archWin(g: Graphics, x: number, y: number, r: number, color: { color: number; alpha: number }): void {
    g.moveTo(x - r, y).lineTo(x - r, y - r).arc(x, y - r, r, Math.PI, 0).lineTo(x + r, y).stroke({ width: 1, ...color });
  }

  private truck(g: Graphics, x: number, baseY: number, type: string, col: { color: number; alpha: number }): void {
    const w = 34;
    const h = 11;
    const y = baseY - h;
    const body = { color: 0xece3cf, alpha: 0.22 };
    g.rect(x, y, w, h).fill(body).stroke({ width: 1.2, cap: 'round' as const, ...col });
    g.rect(x + w - 12, y - 7, 12, 7).fill(body).stroke({ width: 1.2, ...col });
    g.circle(x + w - 1.5, y - 1.5, 1).fill(col); // headlight

    const wheel = (wx: number): void => {
      g.circle(wx, baseY, 2.6).fill({ color: 0x23402f, alpha: 0.5 }).stroke({ width: 1.2, ...col });
    };
    wheel(x + 7);
    wheel(x + w - 6);
    if (type !== 'van') wheel(x + w - 13);

    if (type === 'bucket') {
      g.moveTo(x + 7, y).lineTo(x - 11, y - 21).stroke({ width: 1.2, ...col });
      g.rect(x - 16, y - 26, 8, 6).fill(body).stroke({ width: 1.2, ...col });
    } else if (type === 'mixer') {
      g.ellipse(x + 13, y - 4, 10, 7).fill(body).stroke({ width: 1.2, ...col });
      g.moveTo(x + 5, y - 8).lineTo(x + 21, y - 1).stroke({ width: 1.2, ...col });
    } else if (type === 'dump') {
      g.moveTo(x, y).lineTo(x + 5, y - 11).lineTo(x + 24, y - 11).lineTo(x + 22, y).closePath();
      g.fill(body).stroke({ width: 1.2, ...col });
    } else {
      g.moveTo(x, y).lineTo(x, y - 7).lineTo(x + w - 12, y - 7).stroke({ width: 1.2, ...col });
    }
  }
}
