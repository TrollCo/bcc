import { createServer } from 'node:http';
import { createApi } from './handler';

/**
 * Standalone Node server for the BCCC API (production deploy to any Node host).
 *   node --import tsx server/node.ts     (or compile to JS first)
 * Reads config from env (see .env.example); runs MOCK if no creds are set.
 * For Vercel/Netlify instead, wrap `createApi().handle(...)` in their function
 * signature — the handler is framework-agnostic.
 */
const api = createApi();
const PORT = Number(process.env.PORT ?? 8787);

const server = createServer((req, res) => {
  void (async () => {
    // CORS (the game may be embedded on the drop domain)
    res.setHeader('Access-Control-Allow-Origin', process.env.BCCC_CORS_ORIGIN ?? '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    const url = req.url ?? '';
    if (!url.startsWith('/api/bccc')) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    let body: unknown = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || 'null');
    } catch {
      /* GET / empty */
    }
    const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').toString().split(',')[0].trim();
    const result = await api.handle(req.method ?? 'GET', url, body, ip);
    res.statusCode = result.status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(result.json));
  })().catch((e) => {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'server_error' }));
    console.error('[bccc] handler error:', e);
  });
});

server.listen(PORT, () => {
  console.log(`[bccc] API on :${PORT} (${api.config.mock ? 'MOCK' : 'LIVE'})`);
});
