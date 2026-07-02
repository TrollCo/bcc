import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { W, H, GROUND } from '../constants';
import { TUNING } from '../../config/tuning';
import { SCENE } from '../../config/palette';
import { Camera } from '../systems/Camera';
import { lerpColor } from './Background';
import type { GameState } from '../state';

const serif = (size: number, weight: '400' | '600' | '700' = '400'): TextStyle =>
  new TextStyle({ fontFamily: 'Cormorant Garamond, serif', fontSize: size, fontWeight: weight, fill: 0xece3cf, align: 'center' });

/**
 * The range floor: fairway + mow stripes (static), yard posts, the previous-shot
 * scatter, the pin/pennant at the member threshold, and divot puffs (dynamic).
 * Ported from drawRange(), drawPin(), the scatter/puff loops in render().
 */
export class Range {
  readonly view = new Container();
  private floor = new Graphics(); // static fairway + stripes
  private dynamic = new Graphics(); // posts, scatter dots, pin, puffs
  private postLabels: Text[] = [];
  private scatterLabels: Text[] = [];
  private pinLabel: Text;

  constructor() {
    this.view.addChild(this.floor, this.dynamic);
    this.buildFloor();

    // yard posts every 50yd, 50..400
    for (let yd = 50; yd <= 400; yd += 50) {
      const t = new Text({ text: String(yd), style: serif(12) });
      t.anchor.set(0.5, 1);
      t.alpha = 0.6;
      (t as Text & { _yd: number })._yd = yd;
      this.postLabels.push(t);
      this.view.addChild(t);
    }
    // scatter labels pool
    for (let i = 0; i < TUNING.BALLS_PER_ROUND; i++) {
      const t = new Text({ text: '', style: serif(11) });
      t.anchor.set(0.5, 1);
      t.alpha = 0.4;
      t.visible = false;
      this.scatterLabels.push(t);
      this.view.addChild(t);
    }
    // pin "BC"
    this.pinLabel = new Text({ text: 'BC', style: serif(13, '700') });
    this.pinLabel.anchor.set(0.5, 0.5);
    this.pinLabel.tint = 0x1b3124;
    this.pinLabel.style.fill = 0x1b3124;
    this.view.addChild(this.pinLabel);
  }

  private buildFloor(): void {
    const g = this.floor;
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = lerpColor(SCENE.fairwayTop, SCENE.fairwayBottom, t);
      const y = GROUND + ((H - GROUND) * i) / bands;
      g.rect(0, y, W, (H - GROUND) / bands + 1).fill(col);
    }
    // mow stripes (subtle alternating bands)
    for (let b = 0; b < 8; b++) {
      const yy = GROUND + (b * (H - GROUND)) / 8;
      const stripe = b % 2 ? { color: 0xffffff, alpha: 0.03 } : { color: 0x000000, alpha: 0.04 };
      g.rect(0, yy, W, (H - GROUND) / 8 + 1).fill(stripe);
    }
  }

  redraw(s: GameState): void {
    const g = this.dynamic;
    g.clear();

    // yard posts (tick + label)
    for (const t of this.postLabels) {
      const yd = (t as Text & { _yd: number })._yd;
      const sx = Camera.worldToScreen(s, yd * TUNING.PXY);
      if (sx < -20 || sx > W + 20) {
        t.visible = false;
        continue;
      }
      t.visible = true;
      t.position.set(sx, GROUND - 18);
      g.moveTo(sx, GROUND).lineTo(sx, GROUND - 14).stroke({ width: 1, color: 0xece3cf, alpha: 0.35 });
    }

    // previous shot scatter
    for (let i = 0; i < this.scatterLabels.length; i++) {
      const lbl = this.scatterLabels[i];
      const shot = s.shots[i];
      if (!shot) {
        lbl.visible = false;
        continue;
      }
      const sx = Camera.worldToScreen(s, shot.xpx);
      if (sx < -10 || sx > W + 10) {
        lbl.visible = false;
        continue;
      }
      lbl.visible = true;
      lbl.text = String(shot.yd);
      lbl.position.set(sx, GROUND - 6);
      g.circle(sx, GROUND + 4, 2.5).fill({ color: 0xece3cf, alpha: 0.55 });
    }

    // pin + pennant (decorative; a touch short of MEMBER_THRESHOLD to sit beside
    // the TAP cue, not under it)
    this.drawPin(g, s, TUNING.PIN_MARKER_YD);

    // divot / landing puffs
    for (const pf of s.puffs) {
      const a = pf.life / pf.max;
      const px = Camera.worldToScreen(s, pf.x);
      g.circle(px, GROUND - 3, 8 * (1 - a) + 4).fill({ color: 0xd8cfb6, alpha: a * 0.6 });
    }
  }

  private drawPin(g: Graphics, s: GameState, yd: number): void {
    const sx = Camera.worldToScreen(s, yd * TUNING.PXY);
    if (sx < -30 || sx > W + 30) {
      this.pinLabel.visible = false;
      return;
    }
    // tall flagstick + pennant. A real flagstick stands taller than a person; the
    // pin sits ~300yd downrange so perspective shrinks it, but 84px read stubby —
    // 150px gives it proper flagstick height against the foreground golfer (228px).
    const top = GROUND - 150;
    g.moveTo(sx, GROUND).lineTo(sx, top).stroke({ width: 3, color: 0xece3cf });
    g.moveTo(sx, top).lineTo(sx + 44, top + 10).lineTo(sx, top + 21).closePath().fill(0xb8985a);
    g.ellipse(sx, GROUND + 1, 7, 2.5).fill({ color: 0x000000, alpha: 0.35 });
    this.pinLabel.visible = true;
    this.pinLabel.position.set(sx + 16, top + 10);
  }
}
