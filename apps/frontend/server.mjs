/**
 * Static file server for the production build.
 *
 * Render's Web Service type expects a long-running process bound to $PORT,
 * rather than the plain file upload a Static Site does. This serves ./dist and
 * falls back to index.html for any path that isn't a real file, which is what
 * React Router needs for deep links like /dashboard.
 *
 * Deliberately dependency-free: the frontend install already had to be coaxed
 * through an npm workspace, so adding a server framework here would be one more
 * thing to go wrong at build time.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Resolves a URL path to a file inside DIST, or null if it escapes the
 * directory. Without this check a request for /../../etc/passwd would be served.
 */
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(DIST, normalize(decoded)));
  return candidate === DIST || candidate.startsWith(DIST + (process.platform === 'win32' ? '\\' : '/'))
    ? candidate
    : null;
}

async function readIfFile(path) {
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }

  const target = safePath(req.url || '/');
  if (!target) {
    res.writeHead(400).end('Bad Request');
    return;
  }

  let body = await readIfFile(target);
  let ext = extname(target);

  // Not a real file: hand back the SPA shell so the client router can take over.
  // Hashed filenames under /assets are content-addressed, so a miss there is a
  // genuine 404 rather than a route - serving HTML would break module loading.
  if (!body) {
    if (req.url?.startsWith('/assets/')) {
      res.writeHead(404).end('Not Found');
      return;
    }

    body = await readIfFile(join(DIST, 'index.html'));
    ext = '.html';

    if (!body) {
      res.writeHead(500).end('Build output missing: dist/index.html not found');
      return;
    }
  }

  // Vite fingerprints asset filenames, so they can be cached indefinitely.
  // index.html must not be, or clients pin to a stale bundle after a deploy.
  const cacheControl =
    ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';

  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': cacheControl,
  });

  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${DIST} on http://${HOST}:${PORT}`);
});
