/* depth2d.js · 2D 造 3D 观感 · 纯函数元件集
 * ---------------------------------------------------------------------------
 * 建库 2026-11-13，来源：OpusPro 下 9 个外部引擎的造法抽取，逐项对账见
 *   本仓库 references/造法层_2D伪3D.md（原对账文档的公开摘要）
 * 造法卡（怎么抄、参数多少）见本仓库 references/造法层_2D伪3D.md
 *
 * 【库规 · 不可破】
 *  1. 命名中性：只用几何/物理名，不出现任何项目专名、角色名。
 *  2. 元件只造形，不排时序：这里没有一个函数持有 t、启动计时器或注册 rAF；
 *     时间一律由调用方以参数传入，返回值只依赖参数（可乱序逐帧 seek）。
 *  3. 确定性：禁 Math.random / Date.now / performance.now / rAF / 跨帧可变状态。
 *  4. 源工程一字不动：本文件是新写的接口化实现，不改动 OpusPro 里任何源文件。
 *  5. 纯 Canvas 2D：无 WebGL、无法线、无光照点积；z 只用于排序/缩放/配色。
 *
 * 【边界 · 别误读】
 *  layerTransform() 的纯缩放平移只能生成 F 族深度层（前/中/后景速度差），
 *  它不构成「机位带动」——要机位感仍须穿行 + 透视收缩 + 视差三件套。
 *  本库是造法层，不是判据，也不构成上真 3D 的理由。
 *
 * 用法：<script src="assets/depth2d.js"></script> 后取 window.D2；
 *       Node 下 require('./assets/depth2d.js') 亦可（自检用）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.D2 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---- 常量：外部源码里的实测默认，供参考，不是本产线判据 ---- */
  var C = {
    DEPTH_UNIT: 0.5,      // Frame-By-Plane default_layer_offset：越大视差越强
    MAX_DISTANCE: 500,    // parallax-maker Camera.max_distance
    FOCAL_LENGTH: 100,    // parallax-maker Camera.focal_length (mm)
    SENSOR_WIDTH: 35,     // parallax-maker Camera.sensor_width (mm)
    SLICES: 5,            // parallax-maker num_slices 默认切 5 层
    FEATHER: 50,          // parallax-maker feather_mask(num_expand=50)
    FPX: 8,               // pxt-raycasting 定点小数位
    ARC_HANDLE: 9 / 16,   // zdog path-command.js 圆弧转贝塞尔控制点系数
    FOG_BASE: 100,        // simple-mesh generateRgbZ 灰阶基值
    FOG_K: 0.5            // simple-mesh z 线性系数
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function rad(deg) { return deg * Math.PI / 180; }
  function easeInOut(k, p) { // zdog Zdog.easeInOut 同形，p 为幂次
    k = clamp(k, 0, 1);
    return k < 0.5 ? Math.pow(k * 2, p) / 2 : 1 - Math.pow((1 - k) * 2, p) / 2;
  }

  /* ================= A 族 · 圆头笔触体积（源 zdog） ================= */

  /** 三轴旋转。顺序固定 rotateZ → rotateY → rotateX（与 zdog vector.js 一致）。
   *  p={x,y,z}, rot={x,y,z} 弧度。返回新点，不改入参。 */
  function rotate3(p, rot) {
    var x = p.x, y = p.y, z = p.z || 0, c, s, t;
    if (rot.z) { c = Math.cos(rot.z); s = Math.sin(rot.z); t = x * c - y * s; y = x * s + y * c; x = t; }
    if (rot.y) { c = Math.cos(rot.y); s = Math.sin(rot.y); t = x * c - z * s; z = x * s + z * c; x = t; }
    if (rot.x) { c = Math.cos(rot.x); s = Math.sin(rot.x); t = y * c - z * s; z = y * s + z * c; y = t; }
    return { x: x, y: y, z: z };
  }

  /** 父变换累加（scale → rotate → translate），返回新点。 */
  function transform(p, opt) {
    var s = opt.scale == null ? 1 : opt.scale;
    var q = { x: p.x * s, y: p.y * s, z: (p.z || 0) * s };
    if (opt.rotate) q = rotate3(q, opt.rotate);
    var tr = opt.translate || { x: 0, y: 0, z: 0 };
    return { x: q.x + tr.x, y: q.y + tr.y, z: q.z + (tr.z || 0) };
  }

  /** 平均 z 画家排序（zdog shape.updateSortValue）。
   *  zOf 可选：自定义取 z 的函数；默认取 item.points 数组的 z 均值。
   *  升序＝先画远处。返回新数组；组内想锁成整体就把整组当一个 item 传入。 */
  function painterSort(items, zOf) {
    var getZ = zOf || function (it) {
      var pts = it.points || [], n = 0, sum = 0;
      for (var i = 0; i < pts.length; i++) { sum += (pts[i].z || 0); n++; }
      return n ? sum / n : 0;
    };
    return items.slice().map(function (it, i) { return { it: it, z: getZ(it), i: i }; })
      .sort(function (a, b) { return a.z - b.z || a.i - b.i; })
      .map(function (o) { return o.it; });
  }

  /** 朝向 → 预置色（zdog getRenderColor 的 backface 字符串用法）。
   *  normalZ>0 视为背面；backface 为 false 时返回 null 表示剔除。 */
  function faceColor(normalZ, frontColor, backface) {
    if (backface === false && normalZ > 0) return null;
    if (typeof backface === 'string' && normalZ > 0) return backface;
    return frontColor;
  }

  /** 圆头笔触描一条 2D 路径——一条 2 点路径即一根圆头圆柱（zdog 的体积感来源）。
   *  只画形：调用方自己决定何时画、画哪几帧。单点路径退化为圆球。 */
  function drawRoundPath(ctx, pts, opt) {
    opt = opt || {};
    var w = opt.width == null ? 1 : opt.width;
    if (!pts || !pts.length) return;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, w / 2, 0, TAU);
      ctx.fillStyle = opt.color || '#000';
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    ctx.strokeStyle = opt.stroke == null ? (opt.color || '#000') : opt.stroke;
    if (opt.fill) ctx.fillStyle = opt.fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (opt.closed) ctx.closePath();
    if (opt.fill) ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** 圆弧转贝塞尔的两条控制点（zdog path-command.js 的 9/16 系数）。 */
  function arcHandles(prev, corner, end, k) {
    k = k == null ? C.ARC_HANDLE : k;
    return {
      cp0: { x: lerp(prev.x, corner.x, k), y: lerp(prev.y, corner.y, k) },
      cp1: { x: lerp(end.x, corner.x, k), y: lerp(end.y, corner.y, k) }
    };
  }

  /* ================= B 族 · 正交投影 + z 灰度雾（源 simple-mesh） ================= */

  /** z → 灰阶（simple-mesh generateRgbZ）。z 越大越亮，零光源。 */
  function zFog(z, base, k) {
    var g = Math.round(clamp((base == null ? C.FOG_BASE : base) + z * (k == null ? C.FOG_K : k), 0, 255));
    return 'rgb(' + g + ',' + g + ',' + g + ')';
  }

  /** 正交投影：z 不参与缩放，只反转 Y 轴（simple-mesh translate(origin)）。
   *  这是成本最低的一档 2.5D——不需要任何透视数学。 */
  function ortho(p, origin) {
    var o = origin || { x: 0, y: 0, z: 0 };
    return { x: p.x + o.x, y: -(p.y + o.y), z: (p.z || 0) + (o.z || 0) };
  }

  /* ================= C 族 · 射线墙高 / 鱼眼 / 纹理列（源 raycasting-html5） ================= */

  /** 投影平面距离。注意 FOV 必须传弧度（外部源码这里漏转，抄时别照抄）。 */
  function planeDistance(viewW, fovRad) { return (viewW / 2) / Math.tan(fovRad / 2); }

  /** 墙高 = 瓦片高 / 距离 × 投影平面距离。返回屏幕像素高度。 */
  function wallHeight(dist, planeDist, tileH) {
    if (dist <= 0) return Infinity;
    return (tileH / dist) * planeDist;
  }

  /** 鱼眼校正：欧氏距离 → 垂直距离。 */
  function fisheye(dist, viewAngle, rayAngle) { return dist * Math.cos(viewAngle - rayAngle); }

  /** 纹理列号：命中点坐标对瓦片尺寸取余。 */
  function texColumn(hit, tile) { return hit - Math.floor(hit / tile) * tile; }

  /* ================= D 族 · 定点数 + 方向选帧（源 pxt-raycasting） ================= */

  /** 浮点 → 定点（8 位小数），整数除法用 Math.trunc，天然无浮点累积漂移。 */
  function toFpx(n) { return (n * (1 << C.FPX)) | 0; }
  function fromFpx(n) { return n / (1 << C.FPX); }
  function idiv(a, b) { return b === 0 ? 0 : Math.trunc(a / b); }

  /** dir∈[0,1] → 方向帧数组下标（pxt Animations.getFrameByDir）。
   *  length 1..8，4 方向=[left,front,right,back]，8 方向=[l,lf,f,fr,r,rb,b,lb]。 */
  function dirFrame(dir, n) { return Math.round(((dir % 1) + 1) % 1 * n) % n; }

  /** 「观察者看精灵」的方向归一化到 [0,1]（pxt render_raycasting.ts）。 */
  function viewDir(vx, vy, toX, toY, myAngle) {
    var d = (Math.atan2(vx, vy) - myAngle) / Math.PI / 2 + 2 - 0.25;
    return ((d % 1) + 1) % 1;
  }

  /* ================= E 族 · 序列帧 seek（源 animate-images） ================= */

  /** t → 帧号（1-indexed，内部数组 0-indexed）。
   *  产线必须自己算帧号再 setFrame，不要用库的 play()。 */
  function seqFrame(t, fps, n) {
    if (n <= 0) return 1;
    return 1 + (Math.floor(Math.max(0, t) * fps) % n);
  }

  /** 时间 → 帧增量，返回 {frames, remainder}。
   *  小数进位桶由调用方持有 remainder（animate-images _framesQueue 的无状态版），
   *  避免逐帧取整误差累积导致实际 fps 下降。 */
  function framesDelta(dt, fps, remainder) {
    var raw = Math.max(0, dt) * fps + (remainder || 0);
    return { frames: Math.floor(raw), remainder: raw - Math.floor(raw) };
  }

  /* ================= F 族 · 分层深度 / 视差（源 parallax-maker + Frame-By-Plane） ================= */

  /** 深度值 → 世界 z（parallax-maker slice._depth_to_z）。depth 为 0..255，远处=黑需先反相。 */
  function depthToZ(depth, maxDistance) {
    return (maxDistance == null ? C.MAX_DISTANCE : maxDistance) * ((255 - depth) / 255);
  }

  /** 焦距换算成像素（parallax-maker camera.focal_length_px）。 */
  function focalPx(imageW, focal, sensorW) {
    return imageW * (focal == null ? C.FOCAL_LENGTH : focal) / (sensorW == null ? C.SENSOR_WIDTH : sensorW);
  }

  /** 1/z 透视除法（parallax-maker scene.py 的 u = fl*x/z + W/2）。 */
  function project(x, y, z, flPx, viewW, viewH) {
    var zz = z <= 0 ? 1e-6 : z;
    return { x: flPx * x / zz + viewW / 2, y: flPx * y / zz + viewH / 2 };
  }

  /** ⚠️ 纯 2D 降维视差：层缩放 + 层平移（近大远小）。
   *  只用于生成 F 族深度层，不算机位带动（见文件头【边界】）。 */
  function layerTransform(z, zRef, camDx, camDy) {
    var k = z <= 0 ? 1 : zRef / z;
    return {
      scale: k,
      dx: (camDx || 0) * (1 - k),
      dy: (camDy || 0) * (1 - k)
    };
  }

  /** near/mid/far 自动分组边界：取 1/3、2/3 分位处相邻值中点
   *  （Frame-By-Plane depth_split_thresholds）。不同深度值 <3 时返回 null。 */
  function depthBands(depths) {
    var uniq = depths.slice().sort(function (a, b) { return a - b; })
      .filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; });
    if (uniq.length < 3) return null;
    var i1 = Math.max(1, Math.round(uniq.length / 3));
    var i2 = Math.max(i1 + 1, Math.round(uniq.length * 2 / 3));
    if (i2 >= uniq.length) i2 = uniq.length - 1;
    return { near: (uniq[i1 - 1] + uniq[i1]) * 0.5, far: (uniq[i2 - 1] + uniq[i2]) * 0.5 };
  }

  /** 每层等像素数自适应阈值：给定深度直方图，切出 n+1 个阈值。
   *  hist 为长度 256 的数组，值=该深度的像素数。 */
  function depthThresholds(hist, n) {
    var total = 0, i;
    for (i = 0; i < hist.length; i++) total += hist[i];
    var target = total / (n + 1), acc = 0, out = [0];
    for (i = 0; i < hist.length; i++) {
      acc += hist[i];
      if (acc >= target * out.length && out.length <= n) { out.push(i); }
    }
    while (out.length < n + 1) out.push(255);
    out[0] = 0;
    return out;
  }

  /* ================= G 族 · 确定性辅助 ================= */

  /** 由 (seed, i) 直接求 0..1，替代 Math.random（concept-reel / render-craft 的 hash 思路）。 */
  function hash01(seed, i) {
    var x = Math.sin((seed + 1) * 127.1 + (i + 1) * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** 确定性自检：同参数两次结果必须逐字节一致；返回通过项数 / 总项数。 */
  function selftest() {
    var cases = [rotate3({ x: 1, y: 2, z: 3 }, { x: 0.3, y: 0.7, z: 1.1 }),
                 painterSort([{ points: [{ z: 9 }, { z: 11 }] }, { points: [{ z: 1 }] }], null),
                 zFog(120), project(3, 4, 120, focalPx(1080), 1080, 1920),
                 layerTransform(120, 100, 40, 0), depthBands([1, 2, 3, 8, 9, 10, 20, 21, 22]),
                 depthThresholds((function () { var h = []; for (var i = 0; i < 256; i++) h.push(i < 128 ? 2 : 1); return h; })(), 5),
                 { f: seqFrame(12.345, 30, 90), d: framesDelta(0.033, 30, 0.4), df: dirFrame(0.62, 8) }];
    var pass = 0;
    for (var i = 0; i < cases.length; i++) {
      if (JSON.stringify(cases[i]) === JSON.stringify(
        [rotate3({ x: 1, y: 2, z: 3 }, { x: 0.3, y: 0.7, z: 1.1 }),
         painterSort([{ points: [{ z: 9 }, { z: 11 }] }, { points: [{ z: 1 }] }], null),
         zFog(120), project(3, 4, 120, focalPx(1080), 1080, 1920),
         layerTransform(120, 100, 40, 0), depthBands([1, 2, 3, 8, 9, 10, 20, 21, 22]),
         depthThresholds((function () { var h = []; for (var j = 0; j < 256; j++) h.push(j < 128 ? 2 : 1); return h; })(), 5),
         { f: seqFrame(12.345, 30, 90), d: framesDelta(0.033, 30, 0.4), df: dirFrame(0.62, 8) }][i])) pass++;
    }
    return { pass: pass, total: cases.length, ok: pass === cases.length };
  }

  return {
    C: C,
    clamp: clamp, lerp: lerp, rad: rad, easeInOut: easeInOut,
    rotate3: rotate3, transform: transform, painterSort: painterSort,
    faceColor: faceColor, drawRoundPath: drawRoundPath, arcHandles: arcHandles,
    zFog: zFog, ortho: ortho,
    planeDistance: planeDistance, wallHeight: wallHeight, fisheye: fisheye, texColumn: texColumn,
    toFpx: toFpx, fromFpx: fromFpx, idiv: idiv, dirFrame: dirFrame, viewDir: viewDir,
    seqFrame: seqFrame, framesDelta: framesDelta,
    depthToZ: depthToZ, focalPx: focalPx, project: project,
    layerTransform: layerTransform, depthBands: depthBands, depthThresholds: depthThresholds,
    hash01: hash01, selftest: selftest
  };
});
