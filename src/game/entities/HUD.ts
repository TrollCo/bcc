import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { W, H } from '../constants';
import { TUNING } from '../../config/tuning';
import { STATE } from '../StateMachine';
import type { GameState } from '../state';

const BONE = 0xece3cf;
const label = (size: number, weight: '400' | '600' | '700' = '600', italic = false): TextStyle =>
  new TextStyle({
    fontFamily: 'Cormorant Garamond, serif',
    fontSize: size,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    fill: BONE,
    align: 'center',
  });

/**
 * Screen-space HUD: the vertical POWER gauge, the horizontal CONTACT needle (with
 * sweet zone), the address hint, and the live flight distance. Ported from
 * drawPowerMeter()/drawContactMeter()/drawHint(). Redrawn each frame by state.
 */
export class HUD {
  readonly view = new Container();
  private g = new Graphics();
  private hintBg = new Graphics();
  private hintText: Text;
  private powerLabel: Text;
  private contactLabel: Text;
  private liveDist: Text;

  constructor() {
    this.hintText = new Text({ text: '', style: label(15, '400', true) });
    this.hintText.anchor.set(0.5, 0.5);

    this.powerLabel = new Text({ text: 'POWER', style: label(12) });
    this.powerLabel.anchor.set(0.5, 0.5);
    this.powerLabel.rotation = -Math.PI / 2;

    this.contactLabel = new Text({ text: 'CONTACT — hit the gold', style: label(12) });
    this.contactLabel.anchor.set(0.5, 0.5);

    this.liveDist = new Text({ text: '', style: label(30, '600') });
    this.liveDist.anchor.set(1, 0);
    this.liveDist.style.fill = 0x14261b;

    this.view.addChild(this.g, this.hintBg, this.hintText, this.powerLabel, this.contactLabel, this.liveDist);
  }

  redraw(s: GameState): void {
    this.g.clear();
    this.hintBg.clear();
    this.powerLabel.visible = false;
    this.contactLabel.visible = false;
    this.liveDist.visible = false;
    this.hintText.visible = false;

    // NOTE: the per-state top hint text is intentionally gone — the pulsing side
    // TAP/LOCK IT/STRIKE button + the visual meters carry the in-the-moment cue,
    // and the one-time "How to Play" coach card teaches it up front (Overlay).
    if (s.state === STATE.POWER) this.drawPowerMeter(s);
    if (s.state === STATE.CONTACT) this.drawContactMeter(s);
    if (s.state === STATE.FLIGHT) {
      this.liveDist.visible = true;
      this.liveDist.text = `${Math.round(s.ball.x / TUNING.PXY)} yd`;
      // dropped below the BALL/BEST chrome (was y=26, overlapping it)
      this.liveDist.position.set(W - 18, 88);
    }
  }

  private panel(x: number, y: number, w: number, h: number): void {
    this.g.roundRect(x, y, w, h, 5).fill({ color: 0x14261b, alpha: 0.82 }).stroke({ width: 1, color: 0xb8985a, alpha: 0.45 });
  }

  private drawPowerMeter(s: GameState): void {
    const y = 70;
    const w = 22;
    const h = H - 200;
    // right-handed → meter on the LEFT (the side opposite the dominant hand), so
    // it isn't under the player's tapping thumb; left-handed → right. (player pref)
    const onLeft = s.handed === 'R';
    const x = onLeft ? 24 : W - 46;
    this.panel(x - 6, y - 26, w + 12, h + 52);
    this.g.rect(x, y, w, h).fill(0x1b3124);
    // fill from bottom (banded sage -> gold -> coral)
    const fh = h * s.power;
    const segs: number[] = [0x9aa884, 0xc7b06e, 0xd8946a];
    for (let i = 0; i < 3; i++) {
      const segH = fh / 3;
      this.g.rect(x, y + h - segH * (i + 1), w, segH + 0.5).fill(segs[i]);
    }
    this.g.rect(x, y, w, h).stroke({ width: 1, color: BONE });
    this.powerLabel.visible = true;
    this.powerLabel.position.set(onLeft ? x + w + 12 : x - 12, y + h / 2);
  }

  private drawContactMeter(s: GameState): void {
    const w = W * 0.62;
    const x = (W - w) / 2;
    const y = H - 44;
    const h = 18;
    this.panel(x - 8, y - 30, w + 16, h + 40);
    this.g.rect(x, y, w, h).fill(0x1b3124);
    // sweet zone
    const sw = w * TUNING.SWEET_W * 2;
    const sx = x + w * TUNING.SWEET - sw / 2;
    this.g.rect(sx, y, sw, h).fill(0xd8b878);
    this.g.rect(sx, y, sw * 0.18, h).fill({ color: 0xb8985a, alpha: 0.4 });
    this.g.rect(sx + sw * 0.82, y, sw * 0.18, h).fill({ color: 0xb8985a, alpha: 0.4 });
    this.g.rect(x, y, w, h).stroke({ width: 1, color: BONE });
    // needle
    const nx = x + w * s.contact;
    this.g.moveTo(nx, y - 6).lineTo(nx, y + h + 6).stroke({ width: 3, color: 0xfbf7ec });
    this.contactLabel.visible = true;
    this.contactLabel.position.set(x + w / 2, y - 14);
  }
}
