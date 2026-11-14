/* ============================================================
   figure-parts.js · 火柴人动画库 · 局部肢体与凝视（2026-11-04 入库）
   ------------------------------------------------------------
   来源：某系列第 2 集 S4 / S6 / S7，已渲片验证。

   为什么单独一层：bloom.js 的 B.stick 画的是「整个人」。
   第2集反复需要的却是「只有一只手」「只有一只眼」「一道视线」——
   画完整的人会变成「某个人在贴标签」，而叙事要的是「人类这个物种在贴标签」。
   这些部件与 B.stick 共存，不替换它，也不改它。

   完全自包含：只依赖 GSAP（做补间）与浏览器 DOM；PRNG 内置，不借 B.rnd。
   契约：元件只造形、返回可写的状态对象；显隐与时序一律由调用方排 tween。
   ============================================================ */
(function (w) {
  var FP = {};
  var NS = 'http://www.w3.org/2000/svg';

  /* 确定性 PRNG：同一 seed 每次渲完全一致，单镜可返工 */
  function rnd(seed) {
    var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function mk(par, tag, at) {
    var e = document.createElementNS(NS, tag);
    for (var k in (at || {})) e.setAttribute(k, at[k]);
    par.appendChild(e);
    return e;
  }
  function box(parent, W, H, o) {
    o = o || {};
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    /* ⚠️ overflow:visible 是硬要求：默认 hidden 会把走出 viewBox 的肢体裁成 U 形再整个人消失，日志零报错 */
    s.style.cssText = 'position:absolute;left:' + (o.x || 0) + 'px;top:' + (o.y || 0) + 'px;' +
                      'width:' + W + 'px;height:' + H + 'px;overflow:visible;';
    if (o.id) s.id = o.id;
    if (o.cid) s.setAttribute('data-cid', o.cid);
    parent.appendChild(s);
    return s;
  }
  function n2(v) { return (+v).toFixed(1); }

  /* ============================================================
     ① arm3 · 三段人类手臂（肩 → 肘 → 腕 → 指）+ 掌垫
     ------------------------------------------------------------
     o: {shoulder:[x,y], from:{elbow:[x,y], wrist:[x,y]},
         to:  {elbow:[x,y], wrist:[x,y]},
         color, widths:[upper,fore,hand], palm:[rx,ry], glow, w,h, cid}
     返回 {svg, S:{k}, draw(), upper, fore, hand, palm}
     S.k 0→1 由调用方补间，每帧 onUpdate 调 draw()。

     ★ 设计判据：
       · 肘弯必须 ≥45°。三段端点若几乎共线，整条胳膊读作「一根棍子」。
       · 掌垫不能省。手不是一根粗线，得有一块「面」观众才认得出是手。
       · 不用 transform 旋转：Chrome 对大角度 transform-origin 按 fill-box 解析，
         整条胳膊会被甩出身体。每节都是 <line>，逐帧写 x1/y1/x2/y2。
     ============================================================ */
  FP.arm3 = function (parent, o) {
    o = o || {};
    var W = o.w || 1080, H = o.h || 1920;
    var svg = box(parent, W, H, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'arm3' });
    var col = o.color || '#E8E0C8';
    var wd = o.widths || [12, 10, 24];
    var g = mk(svg, 'g', { fill: 'none', stroke: col, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    var upper = mk(g, 'line', { 'stroke-width': wd[0] });
    var fore  = mk(g, 'line', { 'stroke-width': wd[1] });
    var hand  = mk(g, 'line', { 'stroke-width': wd[2] });
    var palm  = mk(g, 'ellipse', { fill: col, stroke: 'none' });
    if (o.glow !== false) svg.style.filter = 'drop-shadow(0 0 22px rgba(232,224,200,.35))';

    var SH = o.shoulder || [1030, 1420];
    var F = o.from || { elbow: [1090, 1600], wrist: [1110, 1760] };
    var T = o.to   || { elbow: [726, 1180],  wrist: [706, 812] };
    var PR = o.palmSize || [21, 26];
    var S = { k: 0 };

    function draw() {
      var k = S.k;
      var ex = F.elbow[0] + (T.elbow[0] - F.elbow[0]) * k;
      var ey = F.elbow[1] + (T.elbow[1] - F.elbow[1]) * k;
      var wx = F.wrist[0] + (T.wrist[0] - F.wrist[0]) * k;
      var wy = F.wrist[1] + (T.wrist[1] - F.wrist[1]) * k;
      upper.setAttribute('x1', SH[0]); upper.setAttribute('y1', SH[1]);
      upper.setAttribute('x2', n2(ex)); upper.setAttribute('y2', n2(ey));
      fore.setAttribute('x1', n2(ex)); fore.setAttribute('y1', n2(ey));
      fore.setAttribute('x2', n2(wx)); fore.setAttribute('y2', n2(wy));
      /* 指节：从腕向左上伸出一小段，方向与腕→肘相反 */
      var dx = wx - ex, dy = wy - ey, L = Math.sqrt(dx * dx + dy * dy) || 1;
      hand.setAttribute('x1', n2(wx)); hand.setAttribute('y1', n2(wy));
      hand.setAttribute('x2', n2(wx + dx / L * 58)); hand.setAttribute('y2', n2(wy + dy / L * 58));
      palm.setAttribute('cx', n2(wx + dx / L * 34)); palm.setAttribute('cy', n2(wy + dy / L * 34));
      palm.setAttribute('rx', PR[0]); palm.setAttribute('ry', PR[1]);
    }
    draw();
    return { svg: svg, S: S, draw: draw, upper: upper, fore: fore, hand: hand, palm: palm };
  };

  /* ============================================================
     ② hand2 · 两段抓取手（前臂 + 掌），用于「抓住并扯下」某个东西
     ------------------------------------------------------------
     o: {from:{x,y,ex,ey}, color, width, palm:[rx,ry], w,h, cid}
     返回 {svg, S, draw()}；S = {x,y,ex,ey}，直接补间这四个数。
     比 arm3 轻，适合只有一个抓握动作、不需要整条胳膊入画。
     ============================================================ */
  FP.hand2 = function (parent, o) {
    o = o || {};
    var W = o.w || 1080, H = o.h || 1920;
    var svg = box(parent, W, H, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'hand2' });
    var col = o.color || '#E8E0C8';
    var fore = mk(svg, 'line', {
      stroke: col, 'stroke-width': o.width || 13, 'stroke-linecap': 'round'
    });
    var palm = mk(svg, 'ellipse', { fill: col, rx: (o.palm || [24, 28])[0], ry: (o.palm || [24, 28])[1] });
    var F = o.from || { x: -60, y: 700, ex: -220, ey: 560 };
    var S = { x: F.x, y: F.y, ex: F.ex, ey: F.ey };
    function draw() {
      fore.setAttribute('x1', n2(S.ex)); fore.setAttribute('y1', n2(S.ey));
      fore.setAttribute('x2', n2(S.x));  fore.setAttribute('y2', n2(S.y));
      palm.setAttribute('cx', n2(S.x));  palm.setAttribute('cy', n2(S.y));
    }
    draw();
    return { svg: svg, S: S, draw: draw, fore: fore, palm: palm };
  };

  /* ============================================================
     ③ eye · 单眼（眼睑 / 眼白 / 瞳孔）
     ------------------------------------------------------------
     只给一只：两只眼会变成「一个人」，一只眼才是「人的眼睛」这个抽象物。
     o: {cx,cy,rx,ry,pupil,color,dark,glow,w,h,cid}
     返回 {svg, lid, white, pupil}
     ⚠️ 待显影：lid 的 stroke-opacity / white 的 fill-opacity / pupil 的 opacity
        初始都是 0，调用方补 tween 亮起（见 10-局部肢体与凝视）。
     ============================================================ */
  FP.eye = function (parent, o) {
    o = o || {};
    var W = o.w || 1080, H = o.h || 1920;
    var cx = o.cx == null ? 540 : o.cx, cy = o.cy == null ? 830 : o.cy;
    var rx = o.rx || 156, ry = o.ry || 78, pr = o.pupil || 38;
    var col = o.color || '#E8E0C8', dark = o.dark || '#1A2430';
    var svg = box(parent, W, H, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'eye' });
    var lid = mk(svg, 'ellipse', {
      cx: cx, cy: cy, rx: rx, ry: ry, fill: '#0A0E14', 'fill-opacity': 0.55,
      stroke: col, 'stroke-width': 3, 'stroke-opacity': 0
    });
    var white = mk(svg, 'ellipse', {
      cx: cx, cy: cy, rx: rx - 18, ry: ry - 16, fill: col, 'fill-opacity': 0
    });
    var pupil = mk(svg, 'circle', { cx: cx, cy: cy, r: pr, fill: dark, opacity: 0 });
    if (o.glow) svg.style.filter = 'drop-shadow(0 0 26px rgba(232,224,200,' + o.glow + '))';
    return { svg: svg, lid: lid, white: white, pupil: pupil };
  };

  /* ============================================================
     ④ sightBeam · 窄视锥（「在看」而不是「在照」）
     ------------------------------------------------------------
     o: {points, color, w,h,cid}
     必须窄：一宽就成探照灯，那是在照外面；窄锥才是「视线出去了」。
     第2集 S7 实测 points = '537,830 543,830 906,520 762,470'
     返回 {svg, beam}；beam 的 fill-opacity 由调用方补间。
     ============================================================ */
  FP.sightBeam = function (parent, o) {
    o = o || {};
    var svg = box(parent, o.w || 1080, o.h || 1920, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'sightBeam' });
    var beam = mk(svg, 'polygon', {
      points: o.points || '537,830 543,830 906,520 762,470',
      fill: o.color || '#E8E0C8', 'fill-opacity': 0, stroke: 'none'
    });
    return { svg: svg, beam: beam };
  };

  /* ============================================================
     ⑤ sightLine · 单向虚线视线 + 沿线光点
     ------------------------------------------------------------
     单向：只从上看下来，不从下看上去（反了就变成「被审视」）。
     o: {x1,y1,x2,y2,color,width,dash,dotN,w,h,cid}
     返回 {svg, line, dots[], move(u)}；u∈[0,1] 把光点摆到沿线位置。
     调用方自己排 t / opacity 的 tween，元件不排时序。
     ============================================================ */
  FP.sightLine = function (parent, o) {
    o = o || {};
    var svg = box(parent, o.w || 1080, o.h || 1920, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'sightLine' });
    var x1 = o.x1 || 706, y1 = o.y1 || 620, x2 = o.x2 || 500, y2 = o.y2 || 1160;
    var col = o.color || '#E8E0C8';
    var line = mk(svg, 'line', {
      x1: x1, y1: y1, x2: x2, y2: y2, stroke: col,
      'stroke-width': o.width || 1.6, 'stroke-opacity': 0,
      'stroke-dasharray': o.dash || '4 12', 'stroke-dashoffset': 0
    });
    var dots = [], n = o.dotN || 2;
    for (var i = 0; i < n; i++) {
      dots.push(mk(svg, 'circle', { cx: x1, cy: y1, r: o.dotR || 3, fill: '#EAF6FF', opacity: 0 }));
    }
    function move(dotIdx, u) {
      var c = dots[dotIdx]; if (!c) return;
      c.setAttribute('cx', n2(x1 + (x2 - x1) * u));
      c.setAttribute('cy', n2(y1 + (y2 - y1) * u));
    }
    return { svg: svg, line: line, dots: dots, move: move };
  };

  /* ============================================================
     ⑥ thinkDust · 一小团思维光（缓聚缓散）
     ------------------------------------------------------------
     o: {n,seed,cx,cy,rx,ry,size,color,w,h,cid}
     返回 {g, els[]}；每颗初始 opacity 0，调用方排淡入 + 微位移。
     ============================================================ */
  FP.thinkDust = function (parent, o) {
    o = o || {};
    var W = o.w || 1080, H = o.h || 1920;
    var svg = box(parent, W, H, { x: o.x, y: o.y, id: o.id, cid: o.cid || 'thinkDust' });
    var g = mk(svg, 'g', {});
    var n = o.n || 24, seed = o.seed || 991;
    var cx = o.cx == null ? 760 : o.cx, cy = o.cy == null ? 1180 : o.cy;
    var rx = o.rx || 40, ry = o.ry || 40, size = o.size || 3;
    var col = o.color || '#E8E0C8', els = [];
    for (var i = 0; i < n; i++) {
      var x = cx + (rnd(seed + i * 2.13) - 0.5) * 2 * rx;
      var y = cy + (rnd(seed + i * 4.71 + 2.1) - 0.5) * 2 * ry;
      var r = size * (0.5 + rnd(seed + i * 6.31 + 0.4));
      els.push(mk(g, 'circle', { cx: n2(x), cy: n2(y), r: r.toFixed(2), fill: col, opacity: 0 }));
    }
    return { g: g, svg: svg, els: els };
  };

  /* ============================================================
     ⑦ POSES · 上肢姿态数值表（act / e 必须成对）
     ------------------------------------------------------------
     ⚠️ 血坑：只给 act 不给 e，肘部角度不受控，B.stick.draw() 会把前臂
        甩到反向形成闭环——第2集 S7 腋下出现过一个大圆环。
     用法：tl.to(st._s.aR, {act:P.hold.act, e:P.hold.e, onUpdate:st.draw}, at)
     多人同屏必传不同 phase（B.idle / B.live），否则同步得像复制粘贴。
     ============================================================ */
  FP.POSES = {
    hold:     { act: -104, e: -76 },  // 捧到胸前（配 glassCube）
    release:  { act: -26,  e: -50 },  // 放下，别直接回 0
    gestureA: { act: -42,  e: -18 },  // 比划一个想法
    gestureB: { act: -26,  e: -8  },
    raise:    { act: -70,  e: -12 },  // 抬手（幕上"慷慨"）
    lower:    { act: -12,  e: -6  },
    lastPod:  { act: -70,  e: -12 }   // 五格皮套最后一格抬手
  };

  w.FP = FP;
})(window);
