import { Application, Assets, Container, Rectangle } from 'pixi.js';
import { W, H, GROUND, TAGS } from './constants';
import { TUNING } from '../config/tuning';
import { createState, type GameState } from './state';
import { STATE } from './StateMachine';
import { SwingMeter } from './systems/SwingMeter';
import { Physics } from './systems/Physics';
import { Camera } from './systems/Camera';
import { Particles } from './systems/Particles';
import { Reward, PURE_GRADE } from './systems/Reward';
import { Audio } from './systems/Audio';
import { Haptics } from './systems/Haptics';
import { track } from './systems/Analytics';
import { getHandle } from './systems/Leaderboard';
import { submitScore } from './systems/Backend';
import { Background } from './entities/Background';
import { Clubhouse } from './entities/Clubhouse';
import { Range } from './entities/Range';
import { Golfer } from './entities/Golfer';
import { Ball } from './entities/Ball';
import { HUD } from './entities/HUD';
import { GradeFilter } from './render/filters/GradeFilter';
import { Overlay } from './ui/Overlay';
import { Intro, type IntroShot } from './ui/Intro';

// speaker icons for the sound toggle (engraved-line style, currentColor)
const SPEAKER_ON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" stroke="none"/><path d="M16 9a4.3 4.3 0 0 1 0 6"/><path d="M18.6 6.4a7.8 7.8 0 0 1 0 11.2"/></svg>';
const SPEAKER_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" stroke="none"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';

export interface GameDom {
  stage: HTMLElement;
  overlay: HTMLElement;
  ballNo: HTMLElement;
  best: HTMLElement;
  footTag: HTMLElement;
  soundBtn: HTMLButtonElement;
}

/**
 * The game. Boots Pixi, builds the graded scene, and runs the ported state
 * machine. All gameplay logic (tap, round flow, the per-frame tick) is ported 1:1
 * from the prototype; only the render layer is new (PixiJS containers + the
 * GradeFilter). See BUILD.md §3.
 */
export class Game {
  readonly app = new Application();
  readonly state: GameState = createState();
  private audio = new Audio();
  private overlay: Overlay;

  private scene = new Container(); // everything that passes through the grade
  // crosshatch etch dialed back from the prototype's 1.0 (cleaner, less busy)
  private grade = new GradeFilter({ halftone: 0.3 });
  private bg = new Background();
  private clubhouse = new Clubhouse();
  private range = new Range();
  private golfer = new Golfer();
  private ball = new Ball();
  private hud = new HUD();

  private reducedMotion = false;
  private cueSpan: HTMLElement | null = null;

  constructor(private dom: GameDom) {
    this.overlay = new Overlay(dom.overlay, this.audio, () => this.startRound());
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.cueSpan = dom.stage.querySelector('.tap-cue span');
  }

  async start(): Promise<void> {
    await this.app.init({
      width: W,
      height: H,
      background: 0xcfc6ad,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl', // the grade is authored as a WebGL (GLSL) filter
    });

    // mount canvas as the bottom layer of .stage (grain + overlay sit above it)
    this.dom.stage.insertBefore(this.app.canvas, this.dom.stage.firstChild);

    // load the authored Driver-tee figure (the real engraved hero pose); fall
    // back to the procedural placeholder if it isn't in public/assets/art yet
    const base = import.meta.env.BASE_URL;
    try {
      // animated 6-beat swing, keyframes generated from the Driver-tee character,
      // feet-aligned into golfer-swing.png, scrubbed by swingT
      const tex = await Assets.load(`${base}assets/art/golfer-swing.png`);
      this.golfer.setSwingSheet(tex);
    } catch {
      /* no art yet — procedural golfer stands in */
    }
    try {
      const tex = await Assets.load(`${base}assets/art/palms-clubhouse.png`);
      this.clubhouse.setHeroArt(tex);
    } catch {
      /* no art yet — procedural clubhouse stands in */
    }

    // assemble scene in BUILD.md §3 layer order (back -> front)
    this.scene.addChild(
      this.bg.view,
      this.clubhouse.view,
      this.range.view,
      this.golfer.view,
      this.ball.view,
      this.hud.view,
    );
    // full-frame grade over the whole scene; fixed area so bounds don't chase the ball
    this.scene.filters = [this.grade];
    this.scene.filterArea = new Rectangle(0, 0, W, H);
    this.app.stage.addChild(this.scene);

    this.wireInput();
    this.app.ticker.add(() => this.frame());

    // cinematic cold open, then the title screen (Path A).
    // INTRO_TRUCK -> INTRO_OTS -> TITLE -> gameplay. Clips are pre-rendered in the
    // engraved brand grade (see reference/intro-shot-prompts.md); labeled slates
    // stand in until they're dropped in public/assets/video/.
    const shots: IntroShot[] = [
      { id: 'rigs', label: 'The Crew Rolls In', src: `${base}assets/video/intro-rigs.mp4`, duration: 3500, volume: 0.5, caption: 'The rigs pull up to the club. No suits. No ties.' },
      { id: 'crew', label: 'All Trades Welcome', src: `${base}assets/video/intro-crew.mp4`, duration: 3500, volume: 0.5, caption: 'Eight strong, headed for the clubhouse.' },
      { id: 'ots', label: 'Sizing It Up', src: `${base}assets/video/intro-ots.mp4`, duration: 3500, caption: 'Over the shoulder — the range opens up.' },
    ];
    const intro = new Intro(this.dom.stage, shots, this.reducedMotion, this.audio, () => {
      // the gate's tap enabled audio — keep the footer Sound icon in sync
      this.setSoundIcon(true);
    });
    await intro.play();

    this.showTitle();
  }

  // ===================== ROUND FLOW (ported) =====================
  private startRound(): void {
    const s = this.state;
    s.ballIndex = 0;
    s.bestDrive = 0;
    s.totalYds = 0;
    s.shots = [];
    this.audio.newRound(); // follow-up-only VO lines can't open a fresh bucket
    track('bccc_game_start');
    this.updateStats();
    this.nextBall();
  }

  private nextBall(): void {
    const s = this.state;
    s.swingT = 0;
    s.swinging = false;
    s.swingLaunched = false;
    s.ball.x = 0;
    s.ball.y = GROUND;
    s.ball.p = 0;
    s.ball.rolling = false;
    s.ball.done = false;
    s.ball.trail = [];
    Camera.reset(s);
    s.power = 0;
    s.powerDir = 1;
    s.contact = 0;
    s.contactDir = 1;
    s.state = STATE.ADDRESS;
    this.overlay.hide();
    this.dom.footTag.textContent = TAGS[s.ballIndex % TAGS.length];
    this.updateStats();
  }

  private updateStats(): void {
    const s = this.state;
    this.dom.ballNo.innerHTML = `${Math.min(s.ballIndex + 1, TUNING.BALLS_PER_ROUND)}<span class="yd">/${TUNING.BALLS_PER_ROUND}</span>`;
    this.dom.best.innerHTML = `${s.bestDrive}<span class="yd">yd</span>`;
  }

  /** Title "tap to tee off" → show the one-time coach card on first play, else
   *  go straight to the round. */
  private beginPlay(): void {
    if (this.dom.overlay.querySelector('.coach')) return; // already coaching
    let coached = false;
    try { coached = localStorage.getItem('bccc-coached') === '1'; } catch { /* no storage */ }
    if (coached) { this.startRound(); return; }
    this.overlay.showCoach(() => {
      try { localStorage.setItem('bccc-coached', '1'); } catch { /* no storage */ }
      this.startRound();
    });
  }

  // single-tap loop, ported verbatim
  private tap(): void {
    const s = this.state;
    if (s.state === STATE.TITLE) return this.beginPlay();
    if (s.state === STATE.ADDRESS) {
      s.state = STATE.POWER;
      this.audio.blip();
      return;
    }
    if (s.state === STATE.POWER) {
      SwingMeter.lockPower(s);
      s.state = STATE.CONTACT;
      this.audio.click();
      Haptics.tap();
      return;
    }
    if (s.state === STATE.CONTACT) {
      SwingMeter.lockContact(s);
      this.startSwing();
      Haptics.tap();
      return;
    }
    if (s.state === STATE.RESULT) {
      if (s.ballIndex + 1 >= TUNING.BALLS_PER_ROUND) {
        s.ballIndex++;
        this.showSummary();
      } else {
        s.ballIndex++;
        this.nextBall();
      }
    }
  }

  private startSwing(): void {
    const s = this.state;
    s.state = STATE.SWING;
    s.swinging = true;
    s.swingT = 0.5;
    s.swingLaunched = false;
    Physics.startSwing(s);
    Reward.gradeShot(s, s.resultYd, s.lockedQ);
    this.audio.swing();
  }

  private landShot(): void {
    const s = this.state;
    s.bestDrive = Math.max(s.bestDrive, s.resultYd);
    s.totalYds += s.resultYd;
    s.shots.push({ xpx: s.ball.totalPx, yd: s.resultYd });
    this.updateStats();
    this.showResult();
    const pure = s.resultGrade === PURE_GRADE;
    if (s.resultYd >= TUNING.MEMBER_THRESHOLD || pure) {
      this.audio.chime();
      Haptics.celebrate();
    } else {
      this.audio.thud();
      Haptics.thud();
    }
    // crowd reaction scales with the drive: polite clap at 300+, full roar at 340+
    if (s.resultYd >= TUNING.CHEER_THRESHOLD) this.audio.cheer();
    else if (s.resultYd >= TUNING.MEMBER_THRESHOLD) this.audio.clap();
    this.audio.playVo(s.resultGrade); // deadpan announcer line (if VO clip present)
  }

  // ===================== UPDATE (ported) =====================
  private update(dt: number): void {
    const s = this.state;
    Particles.update(s, dt);

    if (s.state === STATE.POWER) SwingMeter.updatePower(s, dt);
    if (s.state === STATE.CONTACT) SwingMeter.updateContact(s, dt);

    if (s.state === STATE.SWING) {
      s.swingT += dt * TUNING.swingSpeed;
      if (!s.swingLaunched && s.swingT >= TUNING.impactT) {
        s.swingLaunched = true;
        s.state = STATE.FLIGHT;
        this.audio.thwack(s.lockedPower);
        Haptics.impact(s.lockedPower);
        Particles.spawnPuff(s, 0, GROUND, 0.4);
      }
      if (s.swingT > 1) s.swingT = 1;
    }

    if (s.state === STATE.FLIGHT) {
      if (s.swingT < 1) s.swingT += dt * TUNING.flightSwingSpeed;
      if (s.swingT > 1) s.swingT = 1;
      const landed = Physics.stepFlight(s, dt, () => {
        Particles.spawnPuff(s, s.ball.carryPx, GROUND, 0.35);
        this.audio.bounce();
        Haptics.land();
      });
      Camera.follow(s);
      if (landed) this.landShot();
    }
  }

  // ===================== RENDER =====================
  private frame(): void {
    const dt = Math.min(this.app.ticker.deltaMS / 1000, 0.05);
    this.update(dt);

    const s = this.state;
    this.bg.redraw(s);
    this.clubhouse.redraw(s);
    this.range.redraw(s);
    this.golfer.redraw(s);
    this.ball.redraw(s);
    this.hud.redraw(s);

    // show the "tap" cue only during the tap-to-act phases, on the player's
    // thumb side (lefty → left, righty → right). The label teaches the loop:
    // TAP (start) -> LOCK IT (power) -> STRIKE (contact).
    const tappable = s.state === STATE.ADDRESS || s.state === STATE.POWER || s.state === STATE.CONTACT;
    this.dom.stage.classList.toggle('tap-ready', tappable);
    this.dom.stage.classList.toggle('handed-left', s.handed === 'L');
    if (tappable && this.cueSpan) {
      const label = s.state === STATE.POWER ? 'Lock it' : s.state === STATE.CONTACT ? 'Strike' : 'Tap';
      if (this.cueSpan.textContent !== label) this.cueSpan.textContent = label;
    }
    // in-play = HUD floats over the light sky (flip the mark to pine); excludes
    // TITLE/RESULT/SUMMARY (dark overlay) and the intro (state still TITLE).
    const inPlay = s.state === STATE.ADDRESS || s.state === STATE.POWER || s.state === STATE.CONTACT ||
      s.state === STATE.SWING || s.state === STATE.FLIGHT;
    document.documentElement.classList.toggle('in-play', inPlay);

    if (!this.reducedMotion) this.grade.setTime(performance.now() / 1000);
  }

  // ===================== OVERLAYS =====================
  private showTitle(): void {
    this.state.state = STATE.TITLE;
    this.overlay.showTitle(this.state);
  }

  private showResult(): void {
    this.state.state = STATE.RESULT;
    this.overlay.showResult(this.state);
  }

  private showSummary(): void {
    this.state.state = STATE.SUMMARY;
    track('bccc_round_complete', { bestDrive: this.state.bestDrive });
    this.submitBest();
    this.overlay.showSummary(this.state);
  }

  /** Post the device's best drive to the live standings — once per new best,
   *  under the persisted anonymous handle (fire-and-forget). */
  private submitBest(): void {
    const best = this.state.bestDrive;
    if (best <= 0) return;
    let prev = 0;
    try { prev = Number(localStorage.getItem('bccc-best-submitted') ?? 0); } catch { /* no storage */ }
    if (best <= prev) return;
    try { localStorage.setItem('bccc-best-submitted', String(best)); } catch { /* no storage */ }
    void submitScore(getHandle(), best);
  }

  // ===================== INPUT =====================
  private wireInput(): void {
    const s = this.state;
    this.setSoundIcon(this.audio.soundOn); // initial speaker glyph (off by default)
    this.app.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.unlock();
      this.tap();
    });
    // overlay taps advance the simple prompts (title / result) — but ONLY a clean
    // tap, so a scroll/swipe (e.g. scrolling the scorecard) or a control tap
    // (Lefty/Righty, buttons) doesn't skip the screen. No preventDefault, so the
    // overlay can scroll. Summary advances via its own buttons, not a tap.
    let downX = 0, downY = 0;
    this.dom.overlay.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    this.dom.overlay.addEventListener('pointerup', (e) => {
      if (s.state !== STATE.TITLE && s.state !== STATE.RESULT) return;
      if (this.dom.overlay.querySelector('.coach')) return; // coach card → only its button advances
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return; // a scroll/drag
      if ((e.target as HTMLElement | null)?.closest('button,input,.handed')) return; // a control
      this.tap();
    });
    window.addEventListener('keydown', (e) => {
      // never hijack keys while a form control has focus — Enter in the email
      // input must submit the claim, not restart the round
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (s.state === STATE.SUMMARY) this.startRound();
        else this.tap();
      }
    });
    this.dom.soundBtn.addEventListener('click', () => {
      const on = this.audio.toggle();
      this.setSoundIcon(on);
    });
  }

  /** Swap the speaker glyph + label to match the sound state. */
  private setSoundIcon(on: boolean): void {
    this.dom.soundBtn.innerHTML = on ? SPEAKER_ON : SPEAKER_OFF;
    this.dom.soundBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
  }
}
