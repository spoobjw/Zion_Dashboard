import { checkAccess, checkRequestOrigin } from './access.ts';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, DBContext } from './db.ts';
import { getNetworkAddresses, isAllowedTailscaleOrLanIp, sendError, sendJson } from './http-utils.ts';
import { handleMembershipRoutes } from './routes/membership.ts';
import { handleFinanceRoutes } from './routes/finances.ts';
import { handleBoardRoutes } from './routes/board.ts';
import { handleSermonPrepRoutes } from './routes/sermon-prep.ts';
import { handleLogosRoutes } from './routes/logos.ts';
import { handleStewardRoutes } from './routes/steward.ts';
import { handlePrayerRoutes } from './routes/prayer.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export function createZionServer(dataDir = path.join(PROJECT_ROOT, 'data'), port = Number(process.env.PORT || 3400)) {
  const ctx: DBContext = initDatabase(dataDir);
  const distClientDir = path.join(PROJECT_ROOT, 'dist', 'client');
  const publicDir = path.join(PROJECT_ROOT, 'public');

  const server = http.createServer(async (req, res) => {
    if (!isAllowedTailscaleOrLanIp(req.socket.remoteAddress)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Access restricted to localhost, local LAN, and Tailscale network.');
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    if (!checkAccess(req.socket.remoteAddress, req.headers.authorization)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Zion Dashboard", charset="UTF-8"');
      sendError(res, process.env.ZION_ACCESS_PASSWORD ? 'Sign in with your dashboard credentials.' : 'Remote access requires ZION_ACCESS_PASSWORD on the server.', 401);
      return;
    }
    if (!checkRequestOrigin(req)) {
      sendError(res, 'Cross-origin requests are not allowed.', 403);
      return;
    }
    if (req.method === 'POST' && !req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendError(res, 'Requests must use application/json.', 415);
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const url = new URL(req.url || '/', `http://${host}`);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        const nets = getNetworkAddresses(port);
        sendJson(res, {
          status: 'ok',
          church: 'Zion Congregational Church (Sterling, CO)',
          port,
          network: nets,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (url.pathname.startsWith('/api/membership/')) {
        if (await handleMembershipRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/finances/')) {
        if (await handleFinanceRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/board/')) {
        if (await handleBoardRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/sermon/')) {
        if (await handleSermonPrepRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/logos/')) {
        if (await handleLogosRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/steward/')) {
        if (await handleStewardRoutes(req, res, url, ctx)) return;
      }
      if (url.pathname.startsWith('/api/prayer/')) {
        if (await handlePrayerRoutes(req, res, url, ctx)) return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendError(res, `Unknown API route: ${url.pathname}`, 404);
        return;
      }

      // Serve static PWA files from dist/client (production) or public/
      const candidatePaths = [
        path.join(distClientDir, url.pathname === '/' ? 'index.html' : url.pathname.slice(1)),
        path.join(publicDir, url.pathname.slice(1)),
      ];
      for (const filePath of candidatePaths) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeMap: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.webmanifest': 'application/manifest+json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
          };
          res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
          res.end(fs.readFileSync(filePath));
          return;
        }
      }

      const spaIndex = path.join(distClientDir, 'index.html');
      if (fs.existsSync(spaIndex)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(spaIndex));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Zion Dashboard API Server running. Run `npm run build` or `npm run dev` for the client UI.');
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : String(err), 500);
    }
  });

  return { server, ctx, port };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT || 3400);
  const { server } = createZionServer(undefined, port);
  server.listen(port, '0.0.0.0', () => {
    const nets = getNetworkAddresses(port);
    console.log(`Zion Dashboard listening on http://127.0.0.1:${port}`);
    if (nets.tailscale.length > 0) console.log(`Android Tailscale URL: ${nets.tailscale.join(', ')}`);
    if (nets.lan.length > 0) console.log(`Local LAN URL: ${nets.lan.join(', ')}`);
  });
}
