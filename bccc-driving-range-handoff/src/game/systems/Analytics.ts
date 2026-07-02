/**
 * Analytics — the 5 funnel events from bccc-backend-spec.md §4. Phase 1 logs them
 * and bubbles them to the parent window via postMessage so an embedding drop page
 * can own the GA4/Meta/TikTok pixel calls and keep keys off the client (§5).
 *
 * Wire `bccc_email_submitted` as the optimization event on the ad platforms.
 */
export type AnalyticsEvent =
  | 'bccc_game_start'
  | 'bccc_round_complete'
  | 'bccc_membership_unlocked'
  | 'bccc_email_submitted'
  | 'bccc_code_revealed'
  | 'bccc_shared';

export type TrackFn = (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;

/** Default tracker: console + postMessage to the parent frame. Replaceable. */
export const track: TrackFn = (event, payload = {}) => {
  const msg = { type: 'bccc-analytics', event, payload, ts: Date.now() };
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  } catch {
    /* no-op */
  }
  if (import.meta.env?.DEV) console.debug('[bccc:analytics]', event, payload);
};
