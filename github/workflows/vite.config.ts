import { defineConfig, type PluginOption } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { createApi } from './server/handler';

// Serves the BCCC API at /api/bccc/* during `npm run dev` so the email->code
// claim flow (and leaderboard) is testable locally. Runs in MOCK mode unless
// creds are set in env (see .env.example) — same handler that deploys to prod.
function bcccApiDev(): PluginOption {
  return {
    name: 'bccc-api-dev',
    apply: 'serve',
    configureServer(server) {
      const api = createApi();
      server.middlewares.use('/api/bccc', async (req, res, next) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const raw = Buffer.concat(chunks).toString() || 'null';
          let body: unknown = null;
          try {
            body = JSON.parse(raw);
          } catch {
            /* GET / empty */
          }
          const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'local').toString();
          const url = req.originalUrl ?? req.url ?? '';
          const r = await api.handle(req.method ?? 'GET', url, body, ip);
          res.statusCode = r.status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(r.json));
        } catch (e) {
          next(e as Error);
        }
      });
    },
  };
}

// base: './' so the built bundle works inside a responsive <iframe> on the
// drop page regardless of mount path (see bccc-backend-spec.md §5).
export default defineConfig({
  base: './',
  // allow tunnel hostnames (trycloudflare quick tunnels) so testers can reach
  // the dev server remotely; the dev backend is mock-mode, no secrets at risk
  server: { allowedHosts: true },
  plugins: [bcccApiDev()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
