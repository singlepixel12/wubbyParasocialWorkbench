// Serves the production build (out/) the way GitHub Pages does, under the real basePath:
//   /wubbyParasocialWorkbench/watch → watch.html, unknown paths → 404.html with a 404.
// Usage: node static-site.mjs <outDir> <port> [basePath]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const [dir, port, base = '/wubbyParasocialWorkbench'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const file = (rel) => {
  const p = path.join(dir, rel);
  return p.startsWith(path.resolve(dir)) && existsSync(p) && statSync(p).isFile() ? p : null;
};

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return res.writeHead(404).end();
  const rel = decodeURIComponent(pathname.slice(base.length)).replace(/^\/+/, '');
  const hit = rel === '' ? file('index.html') : file(rel) ?? file(`${rel.replace(/\/$/, '')}.html`) ?? file(`${rel}/index.html`);
  const target = hit ?? file('404.html');
  res.writeHead(hit ? 200 : 404, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' });
  createReadStream(target).pipe(res);
}).listen(Number(port));
