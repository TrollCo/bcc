import { TUNING } from '../../config/tuning';
import { buildBoard, type Member } from '../systems/Leaderboard';
import { claimMembership, fetchLeaderboard, type ClaimFn } from '../systems/Backend';
import { track } from '../systems/Analytics';
import { PURE_GRADE } from '../systems/Reward';
import { shareDrive } from './ShareCard';
import type { Audio } from '../systems/Audio';
import type { GameState } from '../state';

/** Escape leaderboard names before injecting into HTML (they originate from
 *  other clients via the server — never trust them as markup). */
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const CREST = `<img class="crest" src="${import.meta.env.BASE_URL}assets/art/crest.png" alt="Blue Collar Country Club crest" />`;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * DOM overlays — title, per-shot result, and the round summary / membership card.
 * Kept in the DOM (not Pixi) because they're typographic and contain a real email
 * <input> for capture. Ported from showTitle()/showResult()/showSummary() + the
 * claim handler, with the backend + analytics seams wired in.
 */
export class Overlay {
  private claim: ClaimFn = claimMembership;

  constructor(
    private el: HTMLElement,
    private audio: Audio,
    private onStartRound: () => void,
  ) {}

  /** Phase 2: inject the real /api/bccc/claim implementation. */
  setClaimFn(fn: ClaimFn): void {
    this.claim = fn;
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  private show(html: string): void {
    this.el.classList.remove('hidden');
    // wrap in .ov-inner so the overlay can scroll when content is taller than the
    // viewport (the scorecard on short landscape phones) while still centering
    // when it fits. el.scrollTop reset so each screen starts at the top.
    this.el.innerHTML = `<div class="ov-inner">${html}</div>`;
    this.el.scrollTop = 0;
  }

  showTitle(s: GameState): void {
    this.show(
      CREST +
        `<img class="ov-lockup" src="${import.meta.env.BASE_URL}assets/art/bccc-lockup.png" alt="Blue Collar Country Club" />` +
        '<div class="ov-rule"></div>' +
        `<div class="ov-line">Three balls. One reputation.<br>Smash a drive past ${TUNING.MEMBER_THRESHOLD} yards and the club<br>makes it official.</div>` +
        '<div class="handed" id="handed">' +
        '<span class="handed-lbl">Your swing</span>' +
        `<button class="handed-opt${s.handed === 'L' ? ' on' : ''}" data-h="L">Lefty</button>` +
        `<button class="handed-opt${s.handed === 'R' ? ' on' : ''}" data-h="R">Righty</button>` +
        '</div>' +
        '<div class="prompt">Tap to tee off</div>' +
        '<button class="howto" id="howto">How to play</button>' +
        '<div class="members" style="margin-top:1.6cqw"><h4>No Suits &middot; No Ties &middot; All Trades Welcome</h4></div>',
    );
    this.wireHanded(s);
    const howto = document.getElementById('howto');
    if (howto) howto.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showCoach(() => this.showTitle(s), true); // replay → back to title
    });
  }

  /** One-time "How to Play" coach card — teaches the two-tap swing, then gets out
   *  of the way (the side TAP/LOCK IT/STRIKE button + meters carry it after). Shown
   *  before the first round (Game.beginPlay) and replayable from the title. */
  showCoach(onGo: () => void, replay = false): void {
    this.show(
      '<div class="coach">' +
        '<div class="coach-head">The Swing &middot; Two Taps</div>' +
        '<div class="coach-step"><span class="cs-n">1</span><span class="cs-t"><b>Tap</b> to start your swing.</span></div>' +
        '<div class="coach-step"><span class="cs-n">2</span><span class="cs-t"><b>Tap</b> to lock <b>POWER</b> — the higher the bar, the farther it flies.</span></div>' +
        '<div class="coach-step"><span class="cs-n">3</span><span class="cs-t"><b>Tap</b> to <b>STRIKE</b> — catch the gold zone for a pure flush.</span></div>' +
        '<div class="coach-foot">Tap the pulsing circle, or anywhere on screen.</div>' +
        `<button class="btn" id="coachGo">${replay ? 'Got it' : "Let’s tee off"}</button>` +
        '</div>',
    );
    const go = document.getElementById('coachGo');
    if (go) go.addEventListener('click', (e) => { e.stopPropagation(); onGo(); });
  }

  /** Lefty/Righty toggle on the title — sets state.handed (moves the power meter
   *  to the opposite side) and persists it. stopPropagation so tapping a button
   *  doesn't also fire the overlay's "tap to tee off". */
  private wireHanded(s: GameState): void {
    const wrap = document.getElementById('handed');
    if (!wrap) return;
    wrap.querySelectorAll<HTMLButtonElement>('.handed-opt').forEach((btn) => {
      const stop = (e: Event): void => e.stopPropagation();
      btn.addEventListener('pointerdown', stop);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const h = btn.dataset.h === 'L' ? 'L' : 'R';
        s.handed = h;
        try { localStorage.setItem('bccc-handed', h); } catch { /* no storage */ }
        wrap.querySelectorAll('.handed-opt').forEach((b) =>
          b.classList.toggle('on', (b as HTMLButtonElement).dataset.h === h));
        this.audio.blip();
      });
    });
  }

  showResult(s: GameState): void {
    const last = s.ballIndex + 1 >= TUNING.BALLS_PER_ROUND;
    const pure = s.resultGrade === PURE_GRADE;
    this.show(
      `<div class="ov-grade${pure ? ' pure' : ''}">${s.resultGrade}</div>` +
        `<div class="ov-dist">${Math.round(s.resultYd)}<span class="yd"> YD</span></div>` +
        `<div class="ov-line" style="margin-top:10px">${s.resultLine}</div>` +
        `<div class="prompt">Tap for ${last ? 'the scorecard' : 'your next ball'}</div>`,
    );
  }

  private rowsHtml(board: Member[]): string {
    let rows = '';
    for (let i = 0; i < board.length; i++) {
      const m = board[i];
      rows +=
        `<div class="row${m.you ? ' you' : ''}"><span class="pos">${i + 1}</span>` +
        `<span class="nm">${esc(m.nm)}</span><span class="sc">${m.sc} yd</span></div>`;
    }
    return rows;
  }

  showSummary(s: GameState): void {
    const rows = this.rowsHtml(buildBoard(s.bestDrive));
    const earned = s.bestDrive >= TUNING.MEMBER_THRESHOLD;
    const head = earned
      ? '<div class="ov-grade">Membership Granted</div>'
      : '<div class="ov-grade" style="color:var(--bone)">Round Complete</div>';

    let body: string;
    if (earned) {
      // Membership page: focused on the reward. No "text a friend for another
      // bucket" CTA here — a member already cleared the bar; that CTA lives only
      // on the miss branch below.
      track('bccc_membership_unlocked', { bestDrive: s.bestDrive });
      body =
        '<div class="card">' +
        '<div class="ribbon">Member in Good Standing</div>' +
        '<div class="sub">Blue Collar Country Club &middot; Est.&nbsp;2017</div>' +
        '<div class="perk">Early Access to BCCC + Free Gift with Purchase.</div>' +
        '<div class="code" id="codeBox">— — — —</div>' +
        '<div class="claim">' +
        '<input id="emailIn" type="email" placeholder="Email to claim your card" />' +
        '<button id="claimBtn">Claim</button>' +
        '</div>' +
        '</div>' +
        '<div class="members" id="standings"><h4>Member Standings</h4>' +
        rows +
        '</div>' +
        '<div class="prompt" id="again" style="margin-top:10px">Play another round</div>';
    } else {
      // Miss branch: near-miss pressure (the replay CTA names the gap) + the
      // "text a friend to hit another bucket" share CTA.
      const share = s.bestDrive > 0 ? '<button class="btn share" id="shareBtn">Text it to a friend</button>' : '';
      const shareHint = s.bestDrive > 0
        ? '<div class="share-hint">Didn’t bring your A game? Text a friend to hit another bucket of range balls.</div>'
        : '';
      const short = TUNING.MEMBER_THRESHOLD - s.bestDrive;
      // Non-clickable tease (NOT a replay CTA): another bucket is earned by
      // texting a friend, not a free replay. Kept as an inert label — the dev
      // wires the referral -> extra-bucket fulfillment (HANDOFF §5).
      const tag = `${short} yards short — one more bucket?`;
      body =
        `<div class="ov-dist" style="font-size:clamp(40px,11vw,64px)">${s.bestDrive}<span class="yd"> YD BEST</span></div>` +
        `<div class="ov-line" style="margin-top:8px">${short} yards short of a membership. The driving range is open 24/7.</div>` +
        `<div class="members" id="standings" style="margin-top:14px"><h4>Member Standings</h4>${rows}</div>` +
        `<div class="sum-actions"><div class="miss-tag" aria-disabled="true">${tag}</div>${share}</div>` +
        shareHint;
    }

    this.show(head + '<div class="ov-rule"></div>' + body);
    this.wireSummary(s, earned);
    void this.refreshBoard(s); // swap in the live standings when they arrive
  }

  /** Pull the live leaderboard and swap it into the rendered standings (no-op if
   *  the fetch fails or the player has already left the summary). */
  private async refreshBoard(s: GameState): Promise<void> {
    const real = await fetchLeaderboard();
    if (!real || real.length === 0) return;
    const standings = this.el.querySelector('#standings');
    if (!standings) return;
    standings.innerHTML = '<h4>Member Standings</h4>' + this.rowsHtml(buildBoard(s.bestDrive, 7, real));
  }

  private wireSummary(s: GameState, earned: boolean): void {
    const again = document.getElementById('again');
    if (again) again.addEventListener('click', (ev) => { ev.stopPropagation(); this.onStartRound(); });

    const shareBtn = document.getElementById('shareBtn') as HTMLButtonElement | null;
    if (shareBtn) {
      shareBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        shareBtn.disabled = true;
        void shareDrive(s.bestDrive)
          .then((how) => {
            if (how === 'copied') shareBtn.textContent = 'Copied — paste it anywhere';
          })
          .finally(() => { shareBtn.disabled = false; });
      });
    }

    if (!earned) return;
    const claimBtn = document.getElementById('claimBtn') as HTMLButtonElement | null;
    const emailIn = document.getElementById('emailIn') as HTMLInputElement | null;
    if (!claimBtn || !emailIn) return;

    const doClaim = async (ev: Event): Promise<void> => {
      ev.stopPropagation();
      const email = (emailIn.value || '').trim();
      if (!EMAIL_RE.test(email)) {
        emailIn.style.borderColor = '#b85a5a';
        return;
      }
      claimBtn.disabled = true;
      claimBtn.textContent = '…';
      // === BACKEND: POST {email, bestDrive} -> ESP; reveal server code on ok ===
      // NO raw email in the analytics payload: track() postMessages to the parent
      // frame with targetOrigin '*', so any embedder would receive it (PII leak).
      // The ESP gets the address server-side via the claim POST; the pixel event
      // only needs to fire.
      track('bccc_email_submitted', { bestDrive: s.bestDrive });
      let refBy: string | undefined;
      try { refBy = localStorage.getItem('bccc-ref-by') ?? undefined; } catch { /* no storage */ }
      try {
        const res = await this.claim({
          email,
          bestDrive: s.bestDrive,
          totalRound: s.totalYds,
          refBy,
          source: 'bccc-driving-range',
          ts: Date.now(),
        });
        if (res.ok && res.code) {
          const codeBox = document.getElementById('codeBox');
          if (codeBox) codeBox.textContent = res.code;
          // (no code in the payload — same postMessage('*') exposure as the email)
          track('bccc_code_revealed', { alreadyClaimed: res.alreadyClaimed });
          claimBtn.textContent = 'Sent ✓';
          this.audio.chime();
        } else {
          claimBtn.disabled = false;
          claimBtn.textContent =
            res.error === 'rate_limited' ? 'Slow down' :
            res.error === 'invalid_email' ? 'Bad email' :
            res.error === 'out_of_codes' ? 'Sold out' : 'Retry';
          if (res.error === 'invalid_email') emailIn.style.borderColor = '#b85a5a';
        }
      } catch {
        claimBtn.disabled = false;
        claimBtn.textContent = 'Retry';
      }
    };
    claimBtn.addEventListener('click', (ev) => void doClaim(ev));
    emailIn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !claimBtn.disabled) void doClaim(ev);
    });
  }
}
