import { Howl, Howler } from 'howler';
import VO_FILES from 'virtual:vo-manifest';
import { PURE_GRADE } from './Reward';

/**
 * Audio — a procedural WebAudio SFX engine (synthesized, no asset files needed)
 * plus drop-in slots for a real ambient bed and announcer VO via Howler.
 *
 * SFX (blip/click/swing/thwack/bounce/chime/thud) are synthesized live, so they
 * work with zero assets. The country-club ambient loop and the deadpan announcer
 * VO need real audio files — drop them in public/assets/audio/ and they activate
 * automatically (probed on unlock; silently skipped if absent). All audio respects
 * the master Sound toggle and is autoplay-safe (created on first user gesture).
 */
const VO_SLUG: Record<string, string> = {
  'Shanked It': 'shanked',
  'Worm Burner': 'wormburner',
  'On the Short Grass': 'shortgrass',
  Respectable: 'respectable',
  'Now That’s Clubhouse Talk': 'clubhouse',
  'Absolute Cannon': 'cannon',
  [PURE_GRADE]: 'pure',
};

// Each grade can have multiple announcer takes that shuffle so repeated drives in
// the same band don't replay the same line. Take 1 is `<slug>.mp3`; add variety by
// dropping `<slug>-2.mp3`, `<slug>-3.mp3`, … into public/assets/audio/vo/ — the
// list is baked in at BUILD time (virtual:vo-manifest), so the pool is always
// complete. (The old boot-time URL probing could transiently miss a file on a
// flaky network, collapsing a grade's pool down to repeats of one clip.)

// Back-to-back variety: when the same scenario fires several times in a row,
// rotate through these slugs instead of replaying one line. Index 0 is the
// grade's own line (first hit); each consecutive repeat advances one step and
// wraps. The three "bad shot" grades cycle through ALL bad-shot lines (shanked /
// wormburner / shortgrass share one pool — owner call). The mid/high grades stay
// in their OWN lane: each has 3-4 recorded takes now, and hearing another
// grade's line on a good drive read as a mismatch (cross-grade borrowing was a
// stopgap from the single-take days). Their variety comes from the per-slug
// take shuffle in playSlug.
const VO_ROTATION: Record<string, string[]> = {
  'Shanked It': ['shanked', 'wormburner', 'shortgrass'],
  'Worm Burner': ['wormburner', 'shortgrass', 'shanked'],
  'On the Short Grass': ['shortgrass', 'wormburner', 'shanked'],
  Respectable: ['respectable'],
  'Now That’s Clubhouse Talk': ['clubhouse'],
  'Absolute Cannon': ['cannon'],
  [PURE_GRADE]: ['pure'],
};

// Grades that share a streak: any consecutive run WITHIN the group advances the
// rotation, even when the exact grade differs (shank -> worm burner -> shank all
// count as one "bad shot" streak, so the lines keep cycling instead of resetting).
const VO_STREAK_GROUP: Record<string, string> = {
  'Shanked It': 'bad-shot',
  'Worm Burner': 'bad-shot',
  'On the Short Grass': 'bad-shot',
};

// NOTE: alternates never open — the FIRST line a session hears for any grade is
// always the base take (`<slug>.mp3`); see playSlug. This is a structural
// guarantee (replaces the old per-file "follow-up only" gate): some alternates
// only read as follow-ups, and a gate keyed to a specific filename is blind to
// any content/label mix-up at recording or export time.

// Lines that only read as a FOLLOW-UP (they presume an earlier shot in the same
// bucket): excluded until their grade has already played a line THIS ROUND —
// so they can never open a session OR a fresh bucket. Currently empty:
// "Respectable 4" (respectable-3.mp3) was re-recorded 2026-07-06 to stand
// alone and its gate was lifted. Add filenames here if future takes need it.
const VO_FOLLOWUP_ONLY: Record<string, string[]> = {};

// Some files are different TAKES of the SAME line (verified by audio
// cross-correlation, 2026-07-06) — playing two of them in a row sounds like a
// repeat even though the filenames differ. Files sharing a group id here never
// play consecutively; files not listed are their own group (all distinct lines).
const VO_LINE_GROUP: Record<string, string> = {
  'shanked.mp3': 'shanked-line-1',
  'shanked-2.mp3': 'shanked-line-1',
  'wormburner.mp3': 'wormburner-line-1',
  'wormburner-2.mp3': 'wormburner-line-1',
  'shortgrass.mp3': 'shortgrass-line-1',
  'shortgrass-4.mp3': 'shortgrass-line-1',
  'clubhouse.mp3': 'clubhouse-line-1',
  'clubhouse-3.mp3': 'clubhouse-line-1',
};
const lineGroup = (name: string): string => VO_LINE_GROUP[name] ?? name;

export class Audio {
  soundOn = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private ambient: Howl | null = null;
  private vo = new Map<string, { howl: Howl; name: string }[]>(); // takes per grade (shuffled)
  private voLast = new Map<string, string>(); // last take FILENAME per slug — avoids back-to-back
  // repeats. By name, not index: the probe-retry merge re-orders the takes array,
  // so a stored index can silently point at a different file after a merge.
  private voPlayed = new Set<string>(); // slugs heard this session — first play is the base take
  private voPlayedRound = new Set<string>(); // slugs heard this ROUND — gates VO_FOLLOWUP_ONLY lines
  private lastVoGrade = ''; // grade of the previous shot — detects consecutive repeats
  private voStreak = 0; // consecutive count of the current grade — indexes VO_ROTATION
  private sfxClips = new Map<string, Howl>(); // crowd reactions (clap/cheer)
  private extrasProbed = false;
  private gestureHooked = false;

  private base = import.meta.env.BASE_URL;

  /** Create/resume the context on a user gesture. */
  unlock(): void {
    try {
      // iOS: route ALL web audio through the "playback" session so synthesized
      // SFX (Web Audio) aren't muted by the hardware ring/silent switch — the
      // reason intro <video> had sound but gameplay SFX didn't. (Safari 16.4+)
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.soundOn ? 1 : 0;
        this.master.connect(this.ctx.destination);
        // short noise buffer for thwack/whoosh
        const n = Math.floor(this.ctx.sampleRate * 0.5);
        this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      this.resumeCtx();
      this.hookGestures();
      this.probeExtras();
    } catch {
      /* no-op */
    }
  }

  /** Resume whenever NOT running. iOS uses a 'suspended' AND an 'interrupted'
   *  state — the latter happens after an <video>/media plays (our intro clips),
   *  and a 'suspended'-only check would leave SFX silent in gameplay. */
  private resumeCtx(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    // nudge Howler's separate context (ambient bed + VO) too
    const hctx = Howler.ctx as (AudioContext | undefined);
    if (hctx && hctx.state !== 'running') void hctx.resume();
  }

  /** Belt-and-suspenders: any later tap (and tab refocus) re-resumes the context,
   *  so iOS can't strand us muted after the intro video or a backgrounding. */
  private hookGestures(): void {
    if (this.gestureHooked) return;
    this.gestureHooked = true;
    const wake = (): void => this.resumeCtx();
    for (const ev of ['pointerdown', 'touchend', 'click'] as const) {
      window.addEventListener(ev, wake, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  }

  /** Force sound ON from a user gesture (e.g. the intro tap-to-start gate). */
  enable(): void {
    if (this.soundOn) return;
    this.soundOn = true;
    this.unlock();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
    Howler.mute(false);
    this.startAmbient();
  }

  toggle(): boolean {
    this.soundOn = !this.soundOn;
    if (this.soundOn) this.unlock();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.soundOn ? 1 : 0, this.ctx.currentTime, 0.02);
    }
    Howler.mute(!this.soundOn);
    if (this.soundOn) {
      this.startAmbient();
      this.click();
    } else {
      this.ambient?.pause();
    }
    return this.soundOn;
  }

  // ---------------- synthesized SFX ----------------
  private t(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** One oscillator note with an exp decay; optional pitch sweep. */
  private osc(freq: number, dur: number, type: OscillatorType, vol: number, sweepTo?: number): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.t();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Filtered noise burst (for impact crack / whoosh / grass). */
  private burst(dur: number, filter: BiquadFilterType, freq: number, q: number, vol: number, sweepTo?: number): void {
    if (!this.soundOn || !this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = filter;
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    const t = this.t();
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  blip(): void {
    this.osc(440, 0.06, 'sine', 0.05);
  } // UI select
  click(): void {
    this.osc(620, 0.05, 'square', 0.04);
    this.osc(320, 0.04, 'square', 0.03);
  } // lock
  swing(): void {
    this.burst(0.34, 'bandpass', 600, 0.8, 0.05, 1700);
  } // club whoosh up
  thwack(power = 1): void {
    const v = 0.08 + 0.06 * power;
    this.burst(0.05, 'highpass', 1800, 0.5, v); // crack
    this.osc(150, 0.18, 'sine', v * 1.4, 60); // low thump
  }
  bounce(): void {
    this.burst(0.12, 'lowpass', 900, 1, 0.05, 300); // soft grass
  }
  chime(): void {
    // bright pin chime (300+)
    this.osc(1320, 0.5, 'sine', 0.06);
    this.osc(1980, 0.5, 'sine', 0.035);
    this.osc(2640, 0.4, 'sine', 0.02);
  }
  thud(): void {
    this.osc(180, 0.16, 'sine', 0.05, 110);
  }

  // ---------------- ambient + VO (drop-in files) ----------------
  private probeExtras(): void {
    if (this.extrasProbed) return;
    this.extrasProbed = true;
    // ambient bed
    void this.exists(`${this.base}assets/audio/ambient-loop.mp3`).then((ok) => {
      if (!ok) return;
      this.ambient = new Howl({ src: [`${this.base}assets/audio/ambient-loop.mp3`], loop: true, volume: 0.25 });
      if (this.soundOn) this.startAmbient();
    });
    // announcer VO clips (each grade may have several takes that shuffle) — from
    // the build-time manifest, so every take registers instantly and completely
    for (const slug of new Set(Object.values(VO_SLUG))) {
      this.loadVoVariants(slug);
    }
    // crowd reactions: polite golf clap (300+) and full cheer (340+)
    for (const s of ['clap', 'cheer'] as const) {
      void this.exists(`${this.base}assets/audio/sfx/${s}.mp3`).then((ok) => {
        if (ok) this.sfxClips.set(s, new Howl({ src: [`${this.base}assets/audio/sfx/${s}.mp3`], volume: s === 'clap' ? 0.6 : 0.75 }));
      });
    }
  }

  /** Polite gallery applause (drives at the membership threshold). */
  clap(): void {
    if (this.soundOn) this.sfxClips.get('clap')?.play();
  }

  /** Full crowd roar (the big bombs). */
  cheer(): void {
    if (this.soundOn) this.sfxClips.get('cheer')?.play();
  }

  /** Register every announcer take for a grade from the build-time manifest:
   *  `<slug>.mp3` plus any `<slug>-2.mp3`, `<slug>-3.mp3`, … No network probing —
   *  the manifest is the complete truth, so the pool can never silently degrade. */
  private loadVoVariants(slug: string): void {
    const takes = VO_FILES.filter((f) => f === `${slug}.mp3` || f.startsWith(`${slug}-`)).map((name) => ({
      name,
      howl: new Howl({ src: [`${this.base}assets/audio/vo/${name}`], volume: 0.55 }),
    }));
    if (takes.length) this.vo.set(slug, takes);
  }

  private async exists(url: string): Promise<boolean> {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      return r.ok && (r.headers.get('content-type') ?? '').includes('audio');
    } catch {
      return false;
    }
  }

  private startAmbient(): void {
    if (this.ambient && !this.ambient.playing()) this.ambient.play();
  }

  /** Play an announcer line for a grade bucket. Consecutive repeats of the same
   *  scenario rotate through VO_ROTATION (a 2nd shank borrows the worm-burner
   *  line, etc.) so a player stuck in one band doesn't hear the identical clip
   *  looping. Grades in the same VO_STREAK_GROUP share one streak — any run of
   *  bad shots keeps the cycle advancing even as the exact grade varies. The
   *  streak resets when a grade outside the group is hit. */
  playVo(grade: string): void {
    if (!this.soundOn) return;
    const rotation = VO_ROTATION[grade] ?? (VO_SLUG[grade] ? [VO_SLUG[grade]] : null);
    if (!rotation) return;
    const key = VO_STREAK_GROUP[grade] ?? grade;
    if (key === this.lastVoGrade) this.voStreak++;
    else {
      this.lastVoGrade = key;
      this.voStreak = 0;
    }
    this.playSlug(rotation[this.voStreak % rotation.length]);
  }

  /** A fresh bucket started — follow-up-only lines are gated again until their
   *  grade has spoken this round. */
  newRound(): void {
    this.voPlayedRound.clear();
  }

  /** Play one take for a slug. Rules, in precedence order:
   *  1. First play of a SESSION is always the base take (`<slug>.mp3`) —
   *     alternates can never open, no matter how the files are labeled.
   *  2. VO_FOLLOWUP_ONLY lines can't play until their grade has spoken this
   *     ROUND (they presume an earlier shot in the bucket). This outranks the
   *     no-repeat rule — repeating a line beats leaking a follow-up opener.
   *  3. Otherwise shuffle, never following a take with another take of the same
   *     LINE (VO_LINE_GROUP — two deliveries of one joke read as a repeat). */
  private playSlug(slug: string): void {
    const takes = this.vo.get(slug);
    if (!takes || !takes.length) return;
    const gated = this.voPlayedRound.has(slug) ? [] : (VO_FOLLOWUP_ONLY[slug] ?? []);
    let eligible = takes.filter((t) => !gated.includes(t.name));
    if (!eligible.length) eligible = takes; // safety: never end up empty
    let pick: { name: string; howl: Howl };
    if (!this.voPlayed.has(slug)) {
      pick = eligible.find((t) => t.name === `${slug}.mp3`) ?? eligible[0];
    } else {
      const last = this.voLast.get(slug);
      let pool = last === undefined ? eligible : eligible.filter((t) => lineGroup(t.name) !== lineGroup(last));
      if (!pool.length) pool = eligible; // repeat a line rather than leak a gated follow-up
      pick = pool[Math.floor(Math.random() * pool.length)];
    }
    this.voLast.set(slug, pick.name);
    this.voPlayed.add(slug);
    this.voPlayedRound.add(slug);
    pick.howl.play();
  }
}
