// Generates Listen-mode fixtures with ffmpeg + ffprobe (both on PATH).
//   node scripts/make-listen-fixtures.mjs        -> tiny (committed) + e2e (gitignored)
//   node scripts/make-listen-fixtures.mjs tiny   -> tiny only
//   node scripts/make-listen-fixtures.mjs e2e    -> e2e only
// tiny*.mp4 mirror the real VODs' layout: moov at the END (ffmpeg's default), H.264 + AAC-LC 48 kHz stereo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('tests/fixtures/listen');
fs.mkdirSync(dir, { recursive: true });
const at = (f) => path.join(dir, f);
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const audioPackets = (file) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'packet=pos,size,duration', '-of', 'json', file]).toString(),
  ).packets.map((p) => ({ pos: Number(p.pos), size: Number(p.size), duration: Number(p.duration) }));
const only = process.argv[2];

if (only !== 'e2e') {
  ff('-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '12', '-c:v', 'libx264', '-b:v', '100k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', at('tiny.mp4'));
  ff('-i', at('tiny.mp4'), '-c', 'copy', '-movflags', '+faststart', at('tiny-faststart.mp4'));
  ff('-i', at('tiny.mp4'), '-c', 'copy', '-an', at('tiny-noaudio.mp4'));
  fs.writeFileSync(at('tiny.audio-packets.json'), JSON.stringify(audioPackets(at('tiny.mp4'))));
  console.log('tiny fixtures written');
}

if (only !== 'tiny') {
  const out = at('e2e-12min.mp4');
  if (!fs.existsSync(out)) {
    ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000',
      '-t', '720', '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '2M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-ac', '2', out);
  }
  // Byte layout the E2E test checks every request against.
  const buf = fs.readFileSync(out);
  const boxes = [];
  for (let o = 0; o < buf.length; ) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(o + 8));
    boxes.push({ type, start: o, size });
    o += size;
  }
  const runs = [];
  for (const p of audioPackets(out)) {
    const last = runs.at(-1);
    if (last && last[0] + last[1] === p.pos) last[1] += p.size;
    else runs.push([p.pos, p.size]);
  }
  fs.writeFileSync(at('e2e-12min.layout.json'), JSON.stringify({ boxes, runs, audioBytes: runs.reduce((a, r) => a + r[1], 0) }));
  console.log(`e2e fixture: ${(buf.length / 1e6).toFixed(0)} MB, ${runs.length} audio runs`);
}
