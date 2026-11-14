// 抽帧产物 -> MP4（复用 ffmpeg）
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ffmpeg 位置：优先环境变量，否则取系统 PATH 中的 ffmpeg
const candidates = [
  process.env.FFMPEG_PATH,
  'ffmpeg'
].filter(Boolean);
const ffmpeg = candidates.find(c => {
  try { fs.accessSync(c, fs.constants.X_OK); return true; } catch { return false; }
});
if (!ffmpeg) { console.error('ffmpeg 未找到：请设置 FFMPEG_PATH 或将其加入 PATH'); process.exit(1); }
console.log('[ffmpeg]', ffmpeg);

const ext = (process.env.CAPTURE || 'png').toLowerCase() === 'jpeg' ? 'jpg' : 'png';
const out = path.join(__dirname, 'out', 'three_anim.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });
const args = [
  '-y', '-framerate', '30',
  '-i', path.join(__dirname, 'frames', `frame_%04d.${ext}`),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
  '-movflags', '+faststart', out
];
const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
console.log(r.status === 0 ? `\n[done] -> ${out}` : `\n[ffail] exit ${r.status}`);
process.exit(r.status ?? 1);
