/**
 * Pluggable persistence. The default is in-memory (fine for a single-instance
 * dev/demo and small drops). For production/serverless, implement this same
 * interface against Vercel KV / Upstash Redis / a DB and swap createStore().
 */
export interface Member {
  nm: string;
  sc: number;
  you?: boolean;
}

export interface Store {
  getCodeForEmail(email: string): Promise<string | null>;
  setCodeForEmail(email: string, code: string): Promise<void>;
  takePoolCode(): Promise<string | null>; // pop next unused pre-generated code
  loadPool(codes: string[]): Promise<void>;
  hitRateLimit(ip: string, perMin: number): Promise<boolean>; // true => over limit
  addScore(m: Member): Promise<void>;
  topScores(limit: number): Promise<Member[]>;
}

export function createMemoryStore(): Store {
  const emailToCode = new Map<string, string>();
  const pool: string[] = [];
  let poolLoaded = false;
  const ipHits = new Map<string, number[]>(); // ip -> timestamps (ms)
  const scores: Member[] = [];

  return {
    async getCodeForEmail(email) {
      return emailToCode.get(email.toLowerCase()) ?? null;
    },
    async setCodeForEmail(email, code) {
      emailToCode.set(email.toLowerCase(), code);
    },
    async loadPool(codes) {
      if (poolLoaded) return;
      pool.push(...codes);
      poolLoaded = true;
    },
    async takePoolCode() {
      return pool.shift() ?? null;
    },
    async hitRateLimit(ip, perMin) {
      const now = Date.now();
      const win = now - 60_000;
      const hits = (ipHits.get(ip) ?? []).filter((t) => t > win);
      hits.push(now);
      ipHits.set(ip, hits);
      return hits.length > perMin;
    },
    async addScore(m) {
      scores.push({ nm: m.nm, sc: m.sc });
      scores.sort((a, b) => b.sc - a.sc);
      if (scores.length > 500) scores.length = 500;
    },
    async topScores(limit) {
      return scores.slice(0, limit);
    },
  };
}
