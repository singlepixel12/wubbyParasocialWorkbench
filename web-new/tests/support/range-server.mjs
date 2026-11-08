// Static server that imitates archive.wubby.tv for Listen-mode tests:
//  - single Range (closed or open-ended) -> 206 with Content-Length; multi-range -> 416
//  - Access-Control-Allow-Origin: * but NO Access-Control-Expose-Headers, so the page can read
//    only cache-control / content-length / content-type / last-modified
//  - preflight (OPTIONS) answers without CORS headers, so If-Range and friends fail like the real server
// usage: node tests/support/range-server.mjs <dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , rootArg, port = '4320'] = process.argv;
const root = path.resolve(rootArg);
const cors = { 'Access-Control-Allow-Origin': '*' };

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }
    const file = path.resolve(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, cors);
      return res.end();
    }
    const stat = fs.statSync(file);
    const headers = {
      ...cors,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'no-store',
    };
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    }
    // One range, closed (bytes=a-b, what Listen sends) or open-ended (bytes=a-, what <video> sends).
    // Multi-range (a comma) is refused with 416, like the real archive.
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!m || Number(m[1]) >= stat.size) {
      res.writeHead(416, { ...cors, 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    const start = Number(m[1]);
    const end = m[2] === '' ? stat.size - 1 : Math.min(Number(m[2]), stat.size - 1);
    res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
    fs.createReadStream(file, { start, end }).pipe(res);
  })
  .listen(Number(port), () => console.log(`range-server ${root} on :${port}`));
