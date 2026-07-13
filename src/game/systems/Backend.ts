import type { Member } from './Leaderboard';

// Universal membership code — one shared code sent to everyone (not per-player
// single-use). Configure a matching Shopify discount when the backend goes live;
// see HANDOFF.md §5. This client fallback reveals it directly on a static deploy.
export const MEMBERSHIP_CODE = 'FREESTROKES';

/**
 * Backend seam (bccc-backend-spec.md §1-3). The client calls a real API when one
 * is configured, and falls back to a local stub for offline/dev so the game is
 * never broken. The actual Klaviyo/Shopify work happens server-side (keys off the
 * client) — see /server. Set the API base with VITE_BCCC_API (defaults to
 * same-origin, e.g. when the drop page hosts /api/bccc/* itself); the Vite dev
 * server serves a mock at /api/bccc/* so this flow works in `npm run dev`.
 */
const API_BASE = (import.meta.env.VITE_BCCC_API ?? '').replace(/\/$/, '');

export interface ClaimRequest {
  email: string;
  bestDrive: number;
  totalRound?: number;
  refBy?: string; // referrer's handle from a shared ?ref= link (bonus-discount flow)
  source: 'bccc-driving-range';
  ts: number;
}

export interface ClaimResponse {
  ok: boolean;
  code?: string;
  perk?: string;
  alreadyClaimed?: boolean;
  error?: string;
  status?: number; // HTTP status surfaced for UI (429 rate-limited, 422 invalid)
}

export type ClaimFn = (req: ClaimRequest) => Promise<ClaimResponse>;

async function postJSON(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

/**
 * Claim a membership: POST the email + score to the API; reveal the returned
 * single-use code only on success. Falls back to the local stub if the API is
 * unreachable (offline / not yet deployed) so the demo still works.
 */
const localCode = (status: number): ClaimResponse => ({
  // lead-magnet fallback (NOT a security boundary) — keeps the demo working when
  // there's no backend (static host → /api/* 404s) or it's unreachable (offline)
  ok: true,
  code: MEMBERSHIP_CODE,
  perk: 'Early Access + Free Gift with Purchase',
  status,
});

export const claimMembership: ClaimFn = async (req) => {
  try {
    const { status, json } = await postJSON('/api/bccc/claim', req);
    const body = (json ?? {}) as ClaimResponse;
    if (status === 200 && body.ok) return { ...body, status };
    // ONLY the real structured errors are surfaced (422 invalid email, 429
    // rate-limited). Anything else (404 no-backend, 5xx, non-JSON) → fall back to
    // a local code so a static/backend-less deploy never dead-ends the player.
    if (status === 422 || status === 429) {
      return { ok: false, status, error: body.error ?? (status === 429 ? 'rate_limited' : 'invalid_email') };
    }
    return localCode(status);
  } catch {
    return localCode(0);
  }
};

/** Submit the player's best drive to the standings (fire-and-forget). */
export async function submitScore(name: string, bestDrive: number): Promise<void> {
  try {
    await postJSON('/api/bccc/score', { name, bestDrive, source: 'bccc-driving-range' });
  } catch {
    /* best-effort */
  }
}

/** Fetch the live weekly leaderboard; returns null on failure (caller uses seed). */
export async function fetchLeaderboard(window = 'week', limit = 10): Promise<Member[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/bccc/leaderboard?window=${window}&limit=${limit}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { entries?: Member[] };
    return Array.isArray(data.entries) ? data.entries : null;
  } catch {
    return null;
  }
}
