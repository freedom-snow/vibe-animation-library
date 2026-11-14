// three -> 无头渲染抽帧 小脚本
// 流程：内建静态服务（供 import map 加载本地 three 模块）
//       + puppeteer-core 驱动 chrome-headless-shell（WebGL）
//       + 逐帧调用 scene.html 的 window.__render 截图 PNG / JPEG
// 输出：frames/frame_0000.png ... frame_0089.png （30fps x 3s = 90 帧）
//
// 两种渲染模式（由环境变量切换）：
//   方案A 软件渲染（默认，本机无 GPU 加速时的主路径）：
//     RENDER_GL 不设置，或 = swiftshader
//     -> 速度约 1.45 帧/秒（1080×1920）
//   方案B 硬件 GPU 加速（机器有可用 WebGL 时）：
//     RENDER_GL=gpu
//     -> 速度数倍提升
//   另：把 CAPTURE 设为 jpeg 可改用 canvas.toDataURL，提速约 2~5 倍。
//
// 依赖：npm i three puppeteer-core；chrome-headless-shell 通过
//       REMOTION_CHROME_PATH 环境变量指向其所在目录。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8731;
const FRAMES = 90;            // 3 秒 @ 30fps
const W = 1280, H = 720;
// three 模块位置：优先环境变量，否则取本地 node_modules/three
const THREE_DIR = process.env.THREE_DIR || path.join(__dirname, 'node_modules', 'three');
const OUT = path.join(__dirname, 'frames');
const CAPTURE = (process.env.CAPTURE || 'png').toLowerCase();   // png | jpeg

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

// ---- 内建静态服务 ----
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/' || u === '/scene.html') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(fs.readFileSync(path.join(__dirname, 'scene.html')));
  }
  if (u.startsWith('/three/')) {
    const f = path.join(THREE_DIR, u.slice('/three/'.length));
    if (fs.existsSync(f)) {
      res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
      return res.end(fs.readFileSync(f));
    }
  }
  res.statusCode = 404; res.end('not found');
});
await new Promise(r => server.listen(PORT, r));
console.log(`[server] 静态服务已启动 http://127.0.0.1:${PORT}`);

fs.mkdirSync(OUT, { recursive: true });

// ---- 解析 chrome 路径（复用管线 REMOTION_CHROME_PATH）----
const chromePath = process.env.REMOTION_CHROME_PATH
  ? path.join(process.env.REMOTION_CHROME_PATH, 'chrome-headless-shell.exe')
  : 'chrome-headless-shell';   // 未设置则依赖系统 PATH
console.log(`[chrome] ${chromePath}`);

// ---- 渲染后端（方案A 软件 / 方案B 硬件）----
const gpu = (process.env.RENDER_GL || 'swiftshader') === 'gpu';
const glArgs = gpu
  ? ['--use-gl=angle', '--use-angle=gl']                                   // 硬件 GPU 加速
  : ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']; // 软件渲染（默认）
console.log(`[render] 模式 = ${gpu ? 'GPU 硬件' : 'SwiftShader 软件'} | 取图 = ${CAPTURE}`);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'shell',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    ...glArgs,
    `--window-size=${W},${H}`,
    '--hide-scrollbars'
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('  [page-error]', m.text()); });
page.on('pageerror', e => console.error('  [pageerror]', e.message));

// 加载一次场景
await page.goto(`http://127.0.0.1:${PORT}/scene.html?frame=0&total=${FRAMES}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction('typeof window.__render === "function"', { timeout: 30000 });
console.log('[scene] 已加载，开始抽帧…');

const t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  await page.evaluate((idx) => window.__render(idx, 90), i);
  const ext = CAPTURE === 'jpeg' ? 'jpg' : 'png';
  const p = path.join(OUT, `frame_${String(i).padStart(4, '0')}.${ext}`);
  if (CAPTURE === 'jpeg') {
    const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9));
    fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
  } else {
    await page.screenshot({ path: p });
  }
  if (i % 15 === 0 || i === FRAMES - 1) console.log(`  帧 ${i}/${FRAMES - 1} 完成`);
}

await browser.close();
server.close();
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n[done] 共 ${FRAMES} 帧，耗时 ${dt}s -> ${OUT}`);
