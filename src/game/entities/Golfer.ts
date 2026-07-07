import { ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { GROUND } from '../constants';
import { TUNING } from '../../config/tuning';
import { SCENE } from '../../config/palette';
import { Camera } from '../systems/Camera';
import { STATE } from '../StateMachine';
import { AlphaKeyFilter } from '../render/filters/AlphaKeyFilter';
import type { GameState } from '../state';

const INK = 0x14160f;

/**
 * The hard-hat ironworker golfer (art-directed to the Driver tee). Ported from
 * drawGolfer()/swingAngle(). The body, arm rig, and tee/ball are built once; per
 * frame only the arm-rig rotation (the swing) and tee visibility change.
 *
 * Phase 1 placeholder for the authored art: this is the swap point for the
 * 6-pose keyframe sprite (golfer-sheet.png) and later the Rive rig (golfer.riv).
 * Note the rig already rotates the club through the exact swingAngle() beats the
 * keyframe brief is matched to (55deg -> 205deg top -> 82deg impact -> -42deg).
 */
export class Golfer {
  readonly view = new Container();
  private body = new Graphics();
  private armRig = new Container();
  private arm = new Graphics();
  private tee = new Graphics();
  private hatT: Text;
  private heroArt: Sprite | null = null;

  // ---- swing sprite (frames cut from golfer-all-angles.png, scrubbed by swingT) ----
  private swingSprite: Sprite | null = null;
  private swingFrames: Texture[] = []; // [address, midback, top, middown, impact, follow]

  // shoulder pivot (prototype sh = {x:5, y:-94})
  private static readonly SH = { x: 5, y: -94 };

  // Driver-tee figure: a figure-only transparent PNG (1006x1256), already facing
  // the target (screen right) — no crop, no key, no mirror. Placement is tuned
  // against the live grade. anchorY ~ the boots so the feet sit on the ground.
  private static readonly HERO = {
    height: 228, // rendered sprite height in game px (scaled up for the wide view)
    anchorX: 0.49,
    anchorY: 0.93,
    offsetX: 8,
    offsetY: 0,
  };

  // golfer-swing.png is a feet-aligned 1-row x 6-col keyframe sheet generated from
  // the Driver-tee character: address, mid-backswing, top, mid-downswing, impact,
  // follow-through (cell idx = the beat order). Dark linework on white paper.
  private static readonly SWING = {
    cols: 6,
    rows: 1,
    cells: { address: 0, midback: 1, top: 2, middown: 3, impact: 4, follow: 5 },
    height: 250, // rendered cell height in game px (scaled up for the wide view)
    anchorX: 0.5,
    anchorY: 0.975, // feet near cell bottom (from the assembly alignment)
    offsetX: 8,
    mirror: false, // poses already face the target (screen right)
  };

  constructor() {
    this.armRig.position.set(Golfer.SH.x, Golfer.SH.y);
    this.armRig.addChild(this.arm);
    // z-order: body, then arm rig over it, then tee/ball, then hat "T"
    this.view.addChild(this.body, this.armRig, this.tee);

    this.buildBody();
    this.buildArm();
    this.buildTee();

    this.hatT = new Text({
      text: 'T',
      style: new TextStyle({ fontFamily: 'Cormorant Garamond, serif', fontSize: 8, fontWeight: '700', fill: INK }),
    });
    this.hatT.anchor.set(0.5, 1);
    this.hatT.position.set(15, -107);
    this.view.addChild(this.hatT);
  }

  /**
   * Mount the authored Driver-tee figure (the real engraved hero pose). Crops the
   * badge lockup out via a texture frame and keys the black field to transparency.
   * Replaces the procedural figure; the procedural rig stays in the tree for the
   * not-yet-authored poses (Phase 1: 6-pose sheet -> per-frame swap).
   */
  setHeroArt(base: Texture): void {
    const H = Golfer.HERO;
    const sprite = new Sprite(base);
    sprite.anchor.set(H.anchorX, H.anchorY);
    sprite.scale.set(H.height / base.height);
    sprite.position.set(H.offsetX, H.offsetY);
    // the art is dark linework on opaque white paper; key the paper out, and
    // darken (gain < 1) so the figure reads as foreground against the bright sky
    sprite.filters = [new AlphaKeyFilter(0.9, 0.99, true, 0.62)];
    this.heroArt = sprite;
    this.view.addChild(sprite);

    // hide the procedural placeholder figure (keep shadow via a slim graphic)
    this.body.visible = false;
    this.armRig.visible = false;
    this.hatT.visible = false;
    this.tee.visible = false;
  }

  /**
   * Mount the swing as a 6-beat sprite scrubbed by swingT, framed directly from
   * the golfer-all-angles.png grid. The real engraved character now swings:
   * holds the TOP frame during the CONTACT aim, then plays down -> impact ->
   * follow on release — exactly the timeline the engine already computes.
   */
  setSwingSheet(base: Texture): void {
    const S = Golfer.SWING;
    const cw = base.width / S.cols;
    const ch = base.height / S.rows;
    const cell = (idx: number): Texture => {
      const r = Math.floor(idx / S.cols);
      const c = idx % S.cols;
      return new Texture({ source: base.source, frame: new Rectangle(c * cw, r * ch, cw, ch) });
    };
    this.swingFrames = [
      cell(S.cells.address),
      cell(S.cells.midback),
      cell(S.cells.top),
      cell(S.cells.middown),
      cell(S.cells.impact),
      cell(S.cells.follow),
    ];

    const sprite = new Sprite(this.swingFrames[0]);
    sprite.anchor.set(S.anchorX, S.anchorY);
    const mag = S.height / ch;
    sprite.scale.set(S.mirror ? -mag : mag, mag);
    sprite.position.set(S.offsetX, 0);
    // sheet is pre-solidified (baked alpha) so the figure is opaque; just darken
    // it a touch so it reads as the foreground against the bright sky
    const darken = new ColorMatrixFilter();
    darken.brightness(0.74, false);
    sprite.filters = [darken];
    this.swingSprite = sprite;
    this.view.addChild(sprite);

    this.body.visible = false;
    this.armRig.visible = false;
    this.hatT.visible = false;
    this.tee.visible = false;
  }

  /** Map swingT (0 address -> .5 top -> .70 impact -> 1 follow) to a beat frame. */
  private swingFrameForT(t: number): number {
    if (t < 0.18) return 0; // address
    if (t < 0.42) return 1; // mid-backswing
    if (t < 0.58) return 2; // top (held during CONTACT aim)
    if (t < 0.66) return 3; // mid-downswing
    if (t < 0.85) return 4; // impact
    return 5; // follow-through
  }

  /** Per-frame: position at the tee, rotate the rig by swingAngle, toggle the tee ball. */
  redraw(s: GameState): void {
    this.view.position.set(Camera.worldToScreen(s, 0), GROUND);

    if (this.swingSprite) {
      this.swingSprite.texture = this.swingFrames[this.swingFrameForT(s.swingT)];
      return;
    }
    if (this.heroArt) return; // static authored hero pose; nothing to animate yet

    this.armRig.rotation = (this.swingAngle(s.swingT) * Math.PI) / 180;
    const addressing =
      s.state === STATE.ADDRESS ||
      s.state === STATE.POWER ||
      s.state === STATE.CONTACT ||
      (s.state === STATE.SWING && !s.swingLaunched);
    this.tee.visible = addressing;
  }

  /** Swing arc beats, ported verbatim. 0 address -> .5 top -> .7 impact -> 1 follow. */
  private swingAngle(t: number): number {
    if (t <= 0.5) return lerp(55, 205, t / 0.5);
    if (t <= TUNING.impactT) return lerp(205, 82, (t - 0.5) / 0.2);
    return lerp(82, -42, (t - TUNING.impactT) / 0.3);
  }

  private buildBody(): void {
    const g = this.body;
    const { shirt, shirtD, shirtL, pants, pantsD, skin, hat, hatD } = SCENE;

    // grounding shadow
    g.ellipse(0, 0, 32, 5).fill({ color: 0x000000, alpha: 0.2 });

    // legs — wide athletic stance
    g.moveTo(-5, -50).lineTo(-22, -24).lineTo(-18, -3).stroke({ width: 14, color: pants, cap: 'round', join: 'round' });
    g.moveTo(1, -52).lineTo(16, -27).lineTo(15, -3).stroke({ width: 14, color: pants, cap: 'round', join: 'round' });
    g.moveTo(-12, -42).lineTo(-19, -22).stroke({ width: 2, color: pantsD });
    g.moveTo(8, -44).lineTo(13, -24).stroke({ width: 2, color: pantsD });

    // work boots
    g.moveTo(-18, -3).lineTo(-27, -2).stroke({ width: 8, color: INK, cap: 'round' });
    g.moveTo(15, -3).lineTo(25, -2).stroke({ width: 8, color: INK, cap: 'round' });

    // torso
    g.moveTo(-5, -52).lineTo(5, -94).stroke({ width: 23, color: shirt, cap: 'round', join: 'round' });
    // engraved lat/back hatching
    g.moveTo(-11, -62).quadraticCurveTo(-9, -78, -7, -88).stroke({ width: 1.4, color: shirtD });
    g.moveTo(-5, -60).quadraticCurveTo(-3, -78, -1, -90).stroke({ width: 1.4, color: shirtD });
    g.moveTo(9, -66).lineTo(10, -88).stroke({ width: 1.2, color: shirtL });

    // belt + buckle
    g.moveTo(-9, -51).lineTo(5, -53).stroke({ width: 5, color: INK });
    g.rect(-3, -55, 5, 3).fill(0xb8985a);

    // neck + head
    g.moveTo(5, -93).lineTo(8, -101).stroke({ width: 8, color: skin, cap: 'round' });
    g.circle(9, -102, 8.5).fill(skin);
    g.arc(9, -102, 8.5, -0.4, 1.0).stroke({ width: 1, color: 0x000000, alpha: 0.2 });

    // hard hat (dome + brim + suspension ridge)
    g.arc(9, -106, 12, Math.PI, 0).fill(hat);
    g.rect(-5, -107, 29, 4).fill(hat);
    g.rect(-5, -104, 29, 1.6).fill(hatD);
    g.moveTo(9, -118).lineTo(9, -107).stroke({ width: 1.4, color: hatD });
    g.arc(9, -106, 12, Math.PI, 0).stroke({ width: 1.4, color: hatD });
  }

  private buildArm(): void {
    const g = this.arm;
    const { shirt, shirtD, skin } = SCENE;
    g.moveTo(0, 0).lineTo(19, 1).stroke({ width: 10, color: shirt, cap: 'round' }); // upper arm
    g.moveTo(17, 1).lineTo(20, 1).stroke({ width: 10, color: shirtD, cap: 'round' }); // rolled cuff
    g.moveTo(20, 1).lineTo(38, 2).stroke({ width: 8.5, color: skin, cap: 'round' }); // forearm
    g.moveTo(24, 4).lineTo(35, 4.5).stroke({ width: 1, color: 0x000000, alpha: 0.18 });
    g.circle(39, 2, 5).fill(INK); // gloved hands
    g.moveTo(39, 2).lineTo(102, 7).stroke({ width: 2.8, color: INK, cap: 'round' }); // shaft
    g.ellipse(103, 8, 6.5, 3.6).fill(shirtD).stroke({ width: 1, color: INK }); // club head
  }

  private buildTee(): void {
    const g = this.tee;
    g.moveTo(26, 0).lineTo(26, -7).stroke({ width: 2, color: SCENE.tee });
    g.circle(26, -10, 4).fill(SCENE.ball).stroke({ width: 1, color: 0x23402f, alpha: 0.5 });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
