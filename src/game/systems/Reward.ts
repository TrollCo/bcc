import { TUNING } from '../../config/tuning';
import type { GameState } from '../state';

/**
 * Top-tier grade string. Single source of truth: it's the on-screen label AND
 * the key for the PURE gold-stamp / celebration / VO lookups (Overlay, Game,
 * Audio) — change the text here and everything follows.
 */
export const PURE_GRADE = 'Nuked It!';

/**
 * Reward + grading. The announcer grade buckets are ported verbatim from the
 * prototype's gradeShot(). The membership code is now a single universal code
 * (MEMBERSHIP_CODE in Backend.ts) rather than a per-player mint.
 */
export const Reward = {
  /** Deadpan club-announcer grade. Maps (yards, Q) -> grade + line. */
  gradeShot(s: GameState, yd: number, Q: number): void {
    if (Q < 0.32) {
      s.resultGrade = 'Shanked It';
      s.resultLine = '“…we’ll mark that one as a practice swing.”';
    } else if (yd >= 330) {
      s.resultGrade = 'Absolute Cannon';
      s.resultLine = '“A drive worthy of the back nine, sir.”';
    } else if (yd >= TUNING.MEMBER_THRESHOLD) {
      s.resultGrade = 'Now That’s Clubhouse Talk';
      s.resultLine = '“The members are nodding. Quietly impressed.”';
    } else if (yd >= 230) {
      s.resultGrade = 'Respectable';
      s.resultLine = '“Solid contact. The beverage cart approves.”';
    } else if (yd >= 160) {
      s.resultGrade = 'On the Short Grass';
      s.resultLine = '“Not every swing’s a highlight. Tee up another.”';
    } else {
      s.resultGrade = 'Worm Burner';
      s.resultLine = '“It went forward. We’re calling that a positive.”';
    }
    // PURE is the top DISTANCE tier: any 340+ bomb (owner calls 2026-07-06 — a
    // 343 with slightly-off contact graded Cannon while the crowd roared; the
    // hidden Q gate made the peak moments mismatch). PURE and the crowd roar
    // now always land together. No Q check: a sub-0.32 strike can't physically
    // reach 340 (max ~240), so the shank guard above already covers it.
    if (yd >= TUNING.CHEER_THRESHOLD) s.resultGrade = PURE_GRADE;
  },
};
