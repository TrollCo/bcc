/**
 * Member Standings. Phase 1 uses the seeded decorative array from the prototype.
 * Phase 2 replaces SEED with a fetch() to the persisted standings endpoint and
 * POSTs the player's score (bccc-backend-spec.md §3); keep SEED as the offline /
 * first-paint fallback.
 */
export interface Member {
  nm: string;
  sc: number;
  you?: boolean;
}

export const SEED: Member[] = [
  { nm: 'Big Mike — HVAC', sc: 392 },
  { nm: 'Dwayne — Framer', sc: 358 },
  { nm: 'Sully — Plumber', sc: 341 },
  { nm: 'Tig — Welder', sc: 327 },
  { nm: 'Sparks — Sparky', sc: 309 },
  { nm: 'Concrete Carl', sc: 286 },
];

/**
 * Insert the player into the standings and return the sorted top `limit`.
 * When live entries from /api/bccc/leaderboard are provided they take the board,
 * padded with the seed crew while it's cold; the player's own submitted handle is
 * filtered out so they don't appear twice (their row is "You").
 */
export function buildBoard(bestDrive: number, limit = 7, real: Member[] | null = null): Member[] {
  const handle = getHandle();
  const board: Member[] = [];
  if (real && real.length) {
    board.push(...real.filter((m) => m.nm !== handle).map((m) => ({ nm: m.nm, sc: m.sc })));
    if (board.length < limit - 1) board.push(...SEED.slice(0, limit - 1 - board.length));
  } else {
    board.push(...SEED);
  }
  board.push({ nm: 'You', sc: bestDrive, you: true });
  board.sort((a, b) => b.sc - a.sc);
  return board.slice(0, limit);
}

const TRADES = ['Sparky', 'Wrench', 'Mason', 'Framer', 'Rigger', 'Welder', 'Sawdust', 'Diesel', 'Plumb', 'Torque'];

/** Anonymous trade-style handle for score submissions, persisted per device. */
export function getHandle(): string {
  try {
    const cur = localStorage.getItem('bccc-handle');
    if (cur) return cur;
    const h = `${TRADES[Math.floor(Math.random() * TRADES.length)]} #${100 + Math.floor(Math.random() * 900)}`;
    localStorage.setItem('bccc-handle', h);
    return h;
  } catch {
    return 'Walk-On';
  }
}
