/*
 * face.js · 面部表情元件与 D2 表情动作预设
 * ─────────────────────────────────────────────────────────────
 * 入库 2026-11-09。来源（三集成片里手写、此前未归库的那一层）：
 *   · 第1集 v1  S影片/index.html  B5 (16.80–19.91)  两只眼 + 两道压眉＝火柴人脸部表情
 *                                B8 (41.04–43.92)  瞳孔 24→72→82 放大＝瞪大眼睛／愣住
 *                                B14(78.51–84.08)  眼镜五件套落下＝戴眼镜
 *                                B15(84.08–89.57)  紧凑眼镜 ×8＝群体戴眼镜
 *   · 第1集 v2  html/S1/index.html  0:00.40–0:07.11 带表情的极简大脸（双眼错相位环视／嘴线）
 *               html/S3/index.html  0:53.44          愣住的脸（双眼圆睁 + 平嘴）
 *               html/S5/index.html  0:87.59–0:91.10 某角色笑脸 + 眨眼（ry 62→8→62）
 *               html/S4、S6         眼镜落在脸上／同一张脸多一副眼镜
 *
 * 命名空间 FX（Face eXpressions），与 B(bloom) / FP(figure-parts) / NP(narrative props) / SC(stage) 不冲突。
 *
 * 依赖：GSAP 3（timeline 由调用方传入）。**不依赖 bloom.js**，可单独复制。
 * 契约：
 *   ① 状态对象 S + draw()：tween 只改数字，draw() 写几何属性（与叙事元件库同契约）。
 *   ② 元件只造形、不排时序；排时序的只有 FX.act.* 动作预设。
 *   ③ 确定性：无 Date.now / Math.random / rAF 累积，全部时间由 tl 的 at 决定，逐帧 seek 可复现。
 *   ④ 元件初始不自动隐藏；要"由虚到实"用 FX.act.reveal，内部用 tl.set（不用 fromTo 的 immediateRender）。
 *   ⑤ 默认 1080×1920 竖屏坐标；o.local=true 时切 120×240 火柴人骨架局部坐标。
 *
 * ⚠️ 三个从成片里换来的坑，别改回去：
 *   · 眨眼纯改 attr:ry 不产生包围盒位移（分镜核对器 moves 断言不过），必须同时给眼组 y 位移 lidLift。
 *   · 瞳孔用 <circle> 不要用 ellipse，否则 `#eyeGroup ellipse` 的 ry 补间会把瞳孔一起压扁。
 *   · SVG 子元素禁用 px transformOrigin（会被算成另一套坐标系把瞳孔甩出画面）；本库一律走 S + draw()。
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var FX = global.FX = global.FX || {};
  var ACT = FX.act = FX.act || {};
  var gsap = global.gsap;

  function n(v, d) { return (v === undefined || v === null) ? d : v; }
  function el(parent, tag, a) {
    var e = document.createElementNS(NS, tag), k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) e.setAttribute(k, a[k]);
    parent.appendChild(e);
    return e;
  }
  function set(e, a) {
    var k; for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) e.setAttribute(k, a[k]);
    return e;
  }
  function host(parent, o, w, h) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('class', o.cls || 'face-svg');
    s.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';
    if (o.cid) s.setAttribute('data-cid', o.cid);   // 只在显式传 cid 时挂，避免核对器抓错元素
    parent.appendChild(s);
    return s;
  }

  /* ── 表情预设（改状态，不排时序） ───────────────────────────── */
  FX.EXPR = {
    neutral:  { ery: 78, prx: 17, pry: 31, mDrop: 72, mFlat: 0, browAlpha: 0 },
    surprise: { ery: 96, prx: 13, pry: 22, mDrop: 12, mFlat: 0, browAlpha: 0 },  // 双眼圆睁
    stun:     { ery: 66, prx: 20, pry: 34, mDrop: 0,  mFlat: 1, browAlpha: 0 },  // 愣住：平嘴
    smile:    { ery: 70, prx: 17, pry: 31, mDrop: 110,mFlat: 0, browAlpha: 0 },  // 嘴角拉开
    glare:    { ery: 58, prx: 15, pry: 28, mDrop: 0,  mFlat: 1, browAlpha: 0.9 } // 压眉怒目
  };

  /* ── 元件 1：极简大脸（脸壳 + 双眼 + 嘴线） ─────────────────── */
  FX.face = function (parent, o) {
    o = o || {};
    var L = !!o.local;
    var svg = host(parent, o, L ? 120 : 1080, L ? 240 : 1920);
    var g = el(svg, 'g', {});
    var S = {
      cx: n(o.cx, L ? 60 : 540), cy: n(o.cy, L ? 34 : 800),
      rx: n(o.rx, L ? 34 : 336), ry: n(o.ry, L ? 38 : 392),
      ex: n(o.ex, L ? 9 : 136), ey: n(o.ey, L ? -3 : -74),
      erx: n(o.erx, L ? 4.5 : 52), ery: n(o.ery, L ? 6 : 78),
      prx: n(o.prx, L ? 2.2 : 17), pry: n(o.pry, L ? 2.2 : 31),
      pdy: n(o.pdy, L ? -1 : -14), gazeX: 0, gr: n(o.gr, L ? 0.6 : 4),
      gx: n(o.gx, L ? -1 : -6), gy: n(o.gy, 6),
      mY: n(o.mY, L ? 16 : 210), mDrop: n(o.mDrop, L ? 6 : 72), mFlat: 0,
      lidLift: 0, pupilAlpha: 1, browAlpha: 0, browDrop: 0,
      shellAlpha: n(o.shellAlpha, 0.80), shellW: n(o.shellW, L ? 1.2 : 4.2),
      whiteA: n(o.whiteA, 0.88), darkA: n(o.darkA, 0.85)
    };
    var stroke = o.stroke || '#E8E4DA';
    var white  = o.white  || '#E8E4DA';
    var dark   = o.dark   || '#14161A';

    var shell = el(g, 'ellipse', { fill: o.fill || 'rgba(232,228,218,0.10)', stroke: stroke, 'stroke-linecap': 'round' });
    var eyes = [];
    for (var i = 0; i < 2; i++) {
      var eg = el(g, 'g', {});
      eyes.push({
        g: eg,
        white: el(eg, 'ellipse', { fill: white }),
        pupil: el(eg, 'ellipse', { fill: dark }),
        glint: el(eg, 'circle',  { fill: white })
      });
    }
    var brows = [];
    for (var j = 0; j < 2; j++) {
      brows.push(el(g, 'line', {
        stroke: stroke, 'stroke-width': L ? 0.8 : 5, 'stroke-linecap': 'round',
        'stroke-dasharray': L ? 4 : 12, 'stroke-dashoffset': L ? 4 : 12, opacity: 0
      }));
    }
    var mouth = el(g, 'path', { fill: 'none', stroke: stroke,
      'stroke-width': L ? 1.2 : 5, 'stroke-linecap': 'round', 'stroke-opacity': 0.9 });

    function draw() {
      set(shell, { cx: S.cx, cy: S.cy, rx: S.rx, ry: S.ry,
        'stroke-width': S.shellW, 'stroke-opacity': S.shellAlpha });
      for (var i2 = 0; i2 < 2; i2++) {
        var sgn = i2 === 0 ? -1 : 1, E = eyes[i2], x = S.cx + sgn * S.ex + S.gazeX;
        E.g.setAttribute('transform', 'translate(0,' + (-S.lidLift) + ')');
        set(E.white, { cx: x, cy: S.cy + S.ey, rx: S.erx, ry: S.ery, 'fill-opacity': S.whiteA });
        set(E.pupil, { cx: x, cy: S.cy + S.ey + S.pdy, rx: S.prx, ry: S.pry,
          opacity: S.pupilAlpha, 'fill-opacity': S.darkA });
        set(E.glint, { cx: x + S.gx, cy: S.cy + S.ey + S.pdy - S.gy,
          r: S.gr, opacity: S.pupilAlpha * 0.9 });
        var b = brows[i2], by = S.cy + S.ey - S.ery - (L ? 2 : 18);
        set(b, { x1: x - sgn * (L ? 2 : 7), y1: by + (L ? 1 : 4) - S.browDrop * (L ? 1 : 6),
                 x2: x + sgn * (L ? 7 : 17), y2: by - S.browDrop * (L ? 2 : 10) });
        /* 眉毛 opacity 由 setBrow() 走内联通道独占，draw() 不碰它：
           否则与 FX.act.glare 的 DOM tween 混用两个通道（叙事元件库坑表第 8 条） */
      }
      var xl = S.cx - S.ex, xr = S.cx + S.ex, my = S.cy + S.mY;
      mouth.setAttribute('d', S.mFlat
        ? 'M ' + xl + ' ' + my + ' L ' + xr + ' ' + my
        : 'M ' + xl + ' ' + my + ' Q ' + S.cx + ' ' + (my + S.mDrop) + ' ' + xr + ' ' + my);
    }
    function setBrow(a) {
      for (var i3 = 0; i3 < brows.length; i3++) brows[i3].style.opacity = a;
      S.browAlpha = a;
    }
    function setExpr(name) {
      var p = FX.EXPR[name]; if (!p) return f;
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) S[k] = p[k];
      draw(); setBrow(p.browAlpha); return f;
    }
    brows.forEach(function (b) { b.style.opacity = 0; });
    var f = { svg: svg, g: g, shell: shell, eyes: eyes, brows: brows, mouth: mouth,
              S: S, draw: draw, setBrow: setBrow, setExpr: setExpr };
    draw();
    return f;
  };

  /* ── 元件 2：双眼（可单独挂进火柴人头环 gHead，不建新 svg） ──── */
  /* 对应第1集 v1 B5：瞳孔 r2.2、骨架 120×240 坐标 (60±9, 33) */
  FX.eyePair = function (parent, o) {
    o = o || {}; o.local = (o.local !== false);
    var g = el(parent, 'g', {}), i;
    var S = { x: n(o.x, 60), y: n(o.y, 33), ex: n(o.ex, 9),
              r: n(o.r, 2.2), alpha: 0, color: o.color || '#BFE0FF' };
    var pupils = [], brows = [];
    for (i = 0; i < 2; i++) {
      pupils.push(el(g, 'circle', { r: S.r, fill: S.color, opacity: 0 }));
      brows.push(el(g, 'line', { stroke: S.color, 'stroke-width': n(o.sw, 1.3),
        'stroke-linecap': 'round', 'stroke-dasharray': 12, 'stroke-dashoffset': 12, opacity: 0 }));
    }
    function draw() {
      for (var k = 0; k < 2; k++) {
        var sgn = k === 0 ? -1 : 1, x = S.x + sgn * S.ex;
        set(pupils[k], { cx: x, cy: S.y, opacity: S.alpha });
        set(brows[k], { x1: S.x + sgn * 7, y1: 27, x2: S.x + sgn * 17, y2: 23 });
      }
    }
    var ep = { g: g, pupils: pupils, brows: brows, S: S, draw: draw };
    draw();
    return ep;
  };

  /* ── 元件 3：眼镜五件套（两镜片 + 鼻桥 + 两条镜腿） ─────────── */
  /* 镜腿是「眼镜」的身份件，缺一不可（第1集 v1 B14 教训：没镜腿只是两个圈） */
  FX.glasses = function (parent, o) {
    o = o || {};
    var compact = (o.view === 'compact');
    var W = compact ? 120 : 1080, H = compact ? 120 : 1920;
    var svg = host(parent, o, W, H), g = el(svg, 'g', {});
    var S = {
      cx: n(o.cx, compact ? 60 : 540), cy: n(o.cy, compact ? 60 : 712),
      gap: n(o.gap, compact ? 22 : 48), r: n(o.r, compact ? 20 : 40),
      sw: n(o.sw, compact ? 4 : 7),
      legLen: n(o.legLen, compact ? 30 : 100),
      legAngle: n(o.legAngle, 24), legDy: n(o.legDy, compact ? -10 : null),
      color: o.color || (compact ? '#C8A24A' : '#E8E0C8')
    };
    var lenses = [], legs = [], i;
    for (i = 0; i < 2; i++) lenses.push(el(g, 'circle', { fill: 'none', stroke: S.color }));
    var bridge = el(g, 'line', { stroke: S.color, 'stroke-linecap': 'round' });
    for (i = 0; i < 2; i++) legs.push(el(g, 'line', { stroke: S.color, 'stroke-linecap': 'round' }));

    function draw() {
      var k, sgn, x;
      for (k = 0; k < 2; k++) {
        sgn = k === 0 ? -1 : 1; x = S.cx + sgn * S.gap;
        set(lenses[k], { cx: x, cy: S.cy, r: S.r, 'stroke-width': S.sw });
        var outer = x + sgn * S.r;   /* 镜片外缘＝镜腿起点：B14 540±88→452/628；B15 60±42→18/102 */
        var dy = (S.legDy === null)
          ? -S.legLen * Math.sin(S.legAngle * Math.PI / 180)
          : S.legDy;
        set(legs[k], { x1: outer, y1: S.cy,
          x2: outer + sgn * (S.legDy === null
                ? S.legLen * Math.cos(S.legAngle * Math.PI / 180) : S.legLen),
          y2: S.cy + dy, 'stroke-width': S.sw });
      }
      /* 镜片别相切：相切时鼻桥长度为 0，画出来只剩一个点 */
      set(bridge, { x1: S.cx - (compact ? 2 : 8), y1: S.cy,
        x2: S.cx + (compact ? 2 : 8), y2: S.cy, 'stroke-width': S.sw });
    }
    var gl = { svg: svg, g: g, lenses: lenses, bridge: bridge, legs: legs, S: S, draw: draw };
    draw();
    return gl;
  };

  /* ── 动作预设：全部签名 (tl, 元件, o)，o.at 为时间码秒 ──────── */

  /* 脸浮出来：脸壳由虚到实 + 双眼错相位出现 + 嘴线由断到连（v2 S1 B1，6 秒那张脸） */
  ACT.reveal = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0);
    tl.set(f.g, { opacity: 0 }, at);
    tl.to(f.g, { opacity: 1, duration: n(o.dur, 1.20), ease: 'power2.out' }, at);
    f.eyes.forEach(function (E, i) {
      tl.set(E.g, { opacity: 0 }, at);
      tl.to(E.g, { opacity: 1, duration: 0.35, ease: 'power1.out' },
            at + n(o.eyeDelay, 2.45) + i * n(o.eyeStagger, 1.15));
    });
    tl.set(f.mouth, { attr: { 'stroke-dasharray': 300, 'stroke-dashoffset': 300 } }, at);
    tl.to(f.mouth, { attr: { 'stroke-dashoffset': 0 },
      duration: n(o.mouthDur, 0.40), ease: 'power1.inOut' }, at + n(o.mouthAt, 5.58));
    return f;
  };

  /* 双眼错相位缓慢环视（v2 S1 3.90–8.1s：每 1.9s 换一次视线方向） */
  ACT.lookAround = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0), amp = n(o.amp, 9), dur = n(o.dur, 1.90);
    tl.to(f.S, { gazeX: amp, duration: dur, ease: 'sine.inOut',
      yoyo: true, repeat: n(o.repeat, 1), onUpdate: f.draw }, at);
    return f;
  };

  /* 眨眼：眼睑收 + 整组上抬 + 瞳孔同步隐现（v2 S5 0:90.71，1:28 那个笑脸眨眼） */
  ACT.blink = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0), S = f.S, ry0 = S.ery;
    var close = n(o.close, 0.14), open = n(o.open, 0.16);
    tl.to(S, { ery: n(o.minRy, 8), lidLift: n(o.lift, 26), pupilAlpha: 0,
      duration: close, ease: 'power2.in', onUpdate: f.draw }, at);
    tl.to(S, { ery: ry0, lidLift: 0, pupilAlpha: 1,
      duration: open, ease: 'power2.out', onUpdate: f.draw }, at + close);
    return f;
  };

  /* 单点瞳孔放大＝瞪大眼睛／愣住（v1 B8 42.24–43.52：r 6→24→72→82） */
  /* 用法：配大特写推近（头 scale 6.2、transformOrigin 钉头心），单点瞳孔落在屏幕头心 */
  ACT.eyePop = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0);
    if (!f.pop) f.pop = el(f.svg, 'circle', {
      cx: n(o.cx, f.S.cx), cy: n(o.cy, f.S.cy), r: 6,
      fill: o.color || '#CFE6FF',
      filter: 'drop-shadow(0 0 26px rgba(122,184,230,.95))', opacity: 0 });
    var p = f.pop;
    tl.set(p, { opacity: 0, attr: { r: 6 } }, at);
    tl.to(p, { opacity: 1, attr: { r: 24 }, duration: 0.30, ease: 'back.out(2.0)' }, at);
    tl.to(p, { attr: { r: 72 }, duration: 0.55, ease: 'power2.out' }, at + 0.32);
    tl.to(p, { attr: { r: 82 }, duration: 0.95, ease: 'sine.inOut' }, at + 0.86);
    tl.to(p, { opacity: 0, duration: 0.45 }, at + 1.28);
    return f;
  };

  /* 惊讶／双眼圆睁开（v2 S3 0:53.44 老王惊讶；也可用于 D2 峰值） */
  ACT.surprise = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0), p = FX.EXPR.surprise;
    tl.to(f.S, { ery: n(o.ery, p.ery), prx: n(o.prx, p.prx), pry: n(o.pry, p.pry),
      mDrop: p.mDrop, mFlat: 0, duration: n(o.dur, 0.35),
      ease: 'power2.out', onUpdate: f.draw }, at);
    return f;
  };

  /* 笑：嘴角曲线下拉（v2 S5 镜中笑脸） */
  ACT.smile = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0);
    tl.to(f.S, { mDrop: n(o.mDrop, FX.EXPR.smile.mDrop), mFlat: 0,
      duration: n(o.dur, 0.40), ease: 'power2.out', onUpdate: f.draw }, at);
    return f;
  };

  /* 愣住：平嘴 + 瞳孔定住 + 微抖（v1 B8 / v2 S3 组合） */
  ACT.stun = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0);
    tl.to(f.S, { mFlat: 1, mDrop: 0, duration: n(o.dur, 0.30),
      ease: 'none', onUpdate: f.draw }, at);
    if (o.shake !== false) tl.to(f.g, { rotation: n(o.shakeDeg, 0.6),
      duration: 0.11, ease: 'sine.inOut', yoyo: true, repeat: 3,
      svgOrigin: f.S.cx + ' ' + f.S.cy }, at + n(o.shakeAt, 1.10));
    return f;
  };

  /* 压眉怒目／皱眉（v1 B5 16.98–19.91：两道倒八眉，dashoffset 12→0 拉一次） */
  ACT.glare = function (tl, f, o) {
    o = o || {}; var at = n(o.at, 0);
    /* 眉毛显隐走内联 opacity（与 setBrow 同一通道），几何走 S + draw() */
    tl.set(f.brows, { opacity: n(o.alpha, 0.9) }, at);
    tl.to(f.S, { browDrop: 1, ery: n(o.ery, 58),
      duration: 0.18, ease: 'none', onUpdate: f.draw }, at);
    f.brows.forEach(function (b, k) {
      tl.set(b, { attr: { 'stroke-dashoffset': 12 } }, at);
      tl.to(b, { attr: { 'stroke-dashoffset': 0 },
        duration: 0.22, ease: 'power2.out' }, at + k * 0.08);
      /* 只做明暗呼吸，别让 dashoffset 循环 —— 眉毛每轮缩回去会读成抽搐 */
      tl.to(b, { opacity: 0.45, duration: 0.26, ease: 'sine.inOut',
        yoyo: true, repeat: 3 }, at + 0.30 + k * 0.08);
    });
    return f;
  };

  /* 火柴人头环里加两只眼 + 压眉（v1 B5 22 秒那次「用 2 只眼睛表达面部表情」） */
  ACT.eyesOnStick = function (tl, ep, o) {
    o = o || {}; var at = n(o.at, 0);
    tl.to(ep.S, { alpha: 0.95, duration: 0.30, ease: 'power1.out', onUpdate: ep.draw }, at);
    ep.brows.forEach(function (b, k) {
      tl.set(b, { attr: { 'stroke-dashoffset': 12 } }, at);
      tl.to(b, { opacity: 0.9, duration: 0.18 }, at + 0.07 + k * 0.08);
      tl.to(b, { attr: { 'stroke-dashoffset': 0 },
        duration: 0.22, ease: 'power2.out' }, at + 0.07 + k * 0.08);
      tl.to(b, { opacity: 0.45, duration: 0.26, ease: 'sine.inOut',
        yoyo: true, repeat: 3 }, at + 0.37 + k * 0.08);
      tl.to(b, { opacity: 0, duration: 0.25 }, at + n(o.life, 2.50));
    });
    tl.to(ep.S, { alpha: 0, duration: 0.28, onUpdate: ep.draw }, at + n(o.life, 2.50) + 0.10);
    return ep;
  };

  /* 戴眼镜：自上方落下 + 轻微弹一下（v1 B14 78.62–79.44 / 1:23–1:29） */
  ACT.glassesOn = function (tl, gl, o) {
    o = o || {}; var at = n(o.at, 0);
    tl.set(gl.g, { y: n(o.fromY, -300), opacity: 0 }, at);
    tl.to(gl.g, { y: 0, opacity: 1, duration: n(o.dur, 0.46), ease: 'power2.out' }, at);
    tl.to(gl.g, { scale: 1.05, duration: 0.14, ease: 'power1.out',
      transformOrigin: '50% 50%' }, at + 0.54);
    tl.to(gl.g, { scale: 1.00, duration: 0.14, ease: 'power1.in',
      transformOrigin: '50% 50%' }, at + 0.68);
    if (o.fadeAt !== undefined) tl.to(gl.g, { opacity: 0, duration: 0.60 }, o.fadeAt);
    return gl;
  };

})(window);
