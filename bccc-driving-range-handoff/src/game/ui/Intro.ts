/**
 * Cinematic cold-open intro (Path A). Plays a short, linear sequence of
 * pre-rendered shots over the canvas, then hands off to the title/gameplay:
 *
 *   INTRO_TRUCK ("the arrival") -> INTRO_OTS ("over the shoulder") -> TITLE
 *
 * Because the art is flat 2D engraving, true 3D camera angles aren't possible
 * in-engine — so the cinematic angles live as pre-rendered clips (generate via
 * the Higgsfield pipeline, in the engraved brand grade; see
 * reference/intro-shot-prompts.md). This layer plays an <video> per shot, falls
 * back to a labeled slate when the clip isn't present yet, supports tap-to-skip
 * and a Skip button, and is bypassed entirely under prefers-reduced-motion.
 *
 * Keep the over-the-shoulder shot's final frame framed to match the side-view so
 * the cut into gameplay reads as an intentional match-cut.
 */
import type { Audio } from '../systems/Audio';

/**
 * Enter true fullscreen on a user gesture (Chrome on Android + desktop). Also
 * tries to lock landscape. iOS (Safari AND Chrome — all WebKit) has no element
 * Fullscreen API, so this silently no-ops there; the viewport-fit=cover layout
 * already fills the safe area. Mobile/touch only — desktop stays windowed.
 */
function enterImmersive(): void {
  try {
    const coarse = window.matchMedia?.('(pointer:coarse)').matches ?? false;
    const small = Math.min(window.innerWidth, window.innerHeight) <= 600;
    if (!coarse && !small) return; // desktop: don't hijack into fullscreen
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (req) void Promise.resolve(req.call(el)).catch(() => { /* denied */ });
    const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    void orient?.lock?.('landscape').catch(() => { /* unsupported (iOS) */ });
  } catch {
    /* no fullscreen support — fall back to the in-page fill */
  }
}

export interface IntroShot {
  id: string;
  label: string;
  src: string; // video URL (public/assets/video/*)
  duration: number; // ms the fallback slate holds before auto-advancing
  volume?: number; // playback gain 0..1 (default 1) — tame loud clips vs the mix
  caption?: string;
}

export class Intro {
  private layer: HTMLDivElement | null = null;
  private skippedAll = false;
  private advance: (() => void) | null = null;
  private audioEnabled = false;
  private gateAdvance: ((enableAudio: boolean) => void) | null = null;
  private videos: (HTMLVideoElement | null)[] = [];

  constructor(
    private stage: HTMLElement,
    private shots: IntroShot[],
    private reducedMotion: boolean,
    private audio: Audio,
    private onAudioEnabled: () => void,
  ) {}

  async play(): Promise<void> {
    if (this.reducedMotion || this.shots.length === 0) return;

    this.layer = document.createElement('div');
    this.layer.className = 'intro';

    const skip = document.createElement('button');
    skip.className = 'intro-skip';
    skip.textContent = 'Skip ›';
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skippedAll = true;
      this.gateAdvance?.(false); // skip straight from the gate (no audio)
      this.advance?.();
    });
    this.layer.appendChild(skip);
    this.stage.appendChild(this.layer);

    // probe every clip in parallel NOW — they resolve while the user sits on the
    // gate, so there's no network round-trip between shots (that gap was a
    // visible background flash at every cut).
    const probes = Promise.all(this.shots.map((s) => this.probe(s.src)));

    // tap-to-start gate: the user gesture that unlocks audio so the cold-open
    // plays UNMUTED (browsers block autoplaying sound without a gesture).
    await this.gate();

    // pre-create ALL players up front (stacked, hidden) so they buffer ahead.
    // Each ended clip stays FROZEN on its last frame until the next clip is
    // actually rendering — gapless cuts, never the bare layer background.
    const real = await probes;
    this.videos = this.shots.map((shot, i) => (real[i] ? this.makeVideo(shot) : null));
    for (const v of this.videos) if (v && this.layer) this.layer.appendChild(v);

    for (let i = 0; i < this.shots.length; i++) {
      if (this.skippedAll) break;
      await this.playShot(this.shots[i], this.videos[i]);
    }

    for (const v of this.videos) {
      if (v) {
        v.pause();
        v.remove();
      }
    }
    this.videos = [];
    this.layer.remove();
    this.layer = null;
  }

  /** Hidden, buffering player for a clip — revealed when its shot starts. */
  private makeVideo(shot: IntroShot): HTMLVideoElement {
    const v = document.createElement('video');
    v.className = 'intro-video';
    v.preload = 'auto';
    v.muted = true; // real muted state is set at play time (after the gate)
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.src = shot.src;
    v.style.visibility = 'hidden';
    return v;
  }

  /** Brand start card; resolves on tap (enabling audio) or Skip (silent). */
  private gate(): Promise<void> {
    return new Promise<void>((resolve) => {
      const layer = this.layer;
      if (!layer || this.skippedAll) return resolve();

      const g = document.createElement('div');
      g.className = 'intro-gate';
      const base = import.meta.env.BASE_URL;
      g.innerHTML =
        `<img class="crest" src="${base}assets/art/crest.png" alt="Blue Collar Country Club crest" />` +
        `<img class="ov-lockup" src="${base}assets/art/bccc-lockup.png" alt="Blue Collar Country Club" />` +
        '<div class="gate-prompt">Tap to begin</div>' +
        '<div class="gate-snd">Sound on &middot; Headphones recommended</div>';
      layer.appendChild(g);

      const onTap = (e: Event): void => {
        e.preventDefault();
        this.gateAdvance?.(true);
      };
      layer.addEventListener('pointerdown', onTap);

      this.gateAdvance = (enableAudio: boolean): void => {
        this.gateAdvance = null;
        layer.removeEventListener('pointerdown', onTap);
        g.remove();
        if (enableAudio) {
          this.audio.enable();
          this.audioEnabled = true;
          this.onAudioEnabled();
          enterImmersive(); // Chrome/Android: go fullscreen on this gesture (iOS no-ops)
        }
        resolve();
      };
    });
  }

  /** Is there a real video at this URL? Missing public assets fall through to
   *  Vite's SPA HTML — and Vite mislabels them `video/mp4` by extension — so sniff
   *  the first bytes: HTML starts with '<', a real mp4 does not. */
  private async probe(src: string): Promise<boolean> {
    try {
      const res = await fetch(src, { headers: { Range: 'bytes=0-63' } });
      if (!res.ok && res.status !== 206) return false;
      const head = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()).slice(0, 64)).trim();
      return !head.startsWith('<'); // '<!doctype html>' / '<html' => SPA fallback, not a clip
    } catch {
      return false;
    }
  }

  private playShot(shot: IntroShot, video: HTMLVideoElement | null): Promise<void> {
    return new Promise<void>((resolve) => {
      const layer = this.layer;
      if (!layer) return resolve();

      let done = false;
      let slateTimer = 0;
      let slate: HTMLDivElement | null = null;

      const finish = (): void => {
        if (done) return;
        done = true;
        this.advance = null;
        layer.removeEventListener('pointerdown', onTap);
        window.clearTimeout(slateTimer);
        if (video) {
          video.onended = video.onerror = null;
          // freeze on the current frame — do NOT remove: it stays visible under
          // the next clip until that one is rendering, so no background flash
          video.pause();
        }
        slate?.remove();
        resolve();
      };
      this.advance = finish; // Skip button / external advance

      const onTap = (e: Event): void => {
        e.preventDefault();
        finish();
      };
      layer.addEventListener('pointerdown', onTap);

      if (video) {
        video.muted = !this.audioEnabled; // unmuted after the gate gesture
        video.volume = shot.volume ?? 1;
        video.onended = () => finish();
        video.onerror = () => finish(); // unexpected decode error — don't get stuck
        // reveal on the first PRESENTED frame; only then drop the previous
        // clip's frozen frame (rVFC where available, 'playing' as fallback)
        const reveal = (): void => {
          video.style.visibility = 'visible';
          for (const o of this.videos) if (o && o !== video) o.style.visibility = 'hidden';
        };
        const rvfc = (video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => void;
        }).requestVideoFrameCallback;
        if (rvfc) rvfc.call(video, reveal);
        else video.addEventListener('playing', reveal, { once: true });
        video.play().catch(() => {
          // unmuted autoplay refused — fall back to muted so the clip still plays
          if (!video.muted) {
            video.muted = true;
            video.play().catch(() => { /* still blocked — tap or Skip advances */ });
          }
        });
      } else {
        // labeled placeholder slate, held for the shot's duration
        slate = document.createElement('div');
        slate.className = 'intro-slate';
        const file = shot.src.split('/').pop();
        slate.innerHTML =
          `<div class="intro-shotnum">${shot.id.toUpperCase()}</div>` +
          `<div class="intro-shotlabel">${shot.label}</div>` +
          (shot.caption ? `<div class="intro-cap">${shot.caption}</div>` : '') +
          `<div class="intro-note">clip placeholder — drop <b>${file}</b> in public/assets/video/</div>`;
        layer.appendChild(slate);
        slateTimer = window.setTimeout(finish, shot.duration);
      }
    });
  }
}
