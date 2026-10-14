// 의존성 없는 개발용 정적 서버. vercel.json 의 headers 를 그대로 적용해
// 로컬(Docker)에서도 배포 환경과 같은 CSP 로 검증한다.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.env.WEB_ROOT || 'web');
const PORT = Number(process.env.PORT || 3000);
const vercel = JSON.parse(await readFile(path.resolve('vercel.json'), 'utf8'));
const globalHeaders = (vercel.headers.find((h) => h.source === '/(.*)')?.headers) || [];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let file = path.join(ROOT, path.normalize(clean));
  if (!file.startsWith(ROOT)) return null;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, 'index.html');
    return file;
  } catch {
    if (!path.extname(file)) {              // cleanUrls: /m -> /m/index.html
      try { await stat(file + '.html'); return file + '.html'; } catch { /* fallthrough */ }
      try { await stat(path.join(file, 'index.html')); return path.join(file, 'index.html'); } catch { /* fallthrough */ }
    }
    return null;
  }
}

http.createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url || '/');
    for (const { key, value } of globalHeaders) res.setHeader(key, value);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(PORT, '0.0.0.0', () => console.log(`rolling-paper dev server on :${PORT} (root=${ROOT})`));
