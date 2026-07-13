import { defineConfig, type PluginOption } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readdirSync } from 'node:fs';
import { createApi } from './server/handler';

// Bakes the announcer-VO file list into the bundle at build time
// (import voFiles from 'virtual:vo-manifest'). The game previously DISCOVERED
// takes by HEAD-probing each candidate URL at boot — on flaky mobile networks a
// missed probe silently shrank a grade's take pool (degrading variety down to
// repeats of one clip). With a build-time manifest the client always knows
// exactly which takes exist; zero probes, zero degraded pools.
function voManifest(): PluginOption {
  const read = (): string[] => {
    try {
      return readdirSync(fileURLToPath(new URL('./public/assets/audio/vo', import.meta.url)))
        .filter((f) => f.endsWith('.mp3'))
        .sort();
    } catch {
      return [];
    }
  };
  const id = 'virtual:vo-manifest';
  return {
    name: 'vo-manifest',
    resolveId(source) {
      return source === id ? `\0${id}` : undefined;
    },
    load(source) {
      return source === `\0${id}` ? `export default ${JSON.stringify(read())};` : undefined;
    },
    // dev: re-read the folder when takes are added/removed, so the running dev
    // server never serves a stale manifest (production reads at build time)
    configureServer(server) {
      const dir = fileURLToPath(new URL('./public/assets/audio/vo', import.meta.url));
      server.watcher.add(dir);
      const refresh = (file: string): void => {
        if (!file.includes('assets/audio/vo')) return;
        const mod = server.moduleGraph.getModuleById(`\0${id}`);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

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
  plugins: [bcccApiDev(), voManifest()],
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
