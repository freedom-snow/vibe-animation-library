/* ============================================================
   Bloom Cover 共享工具 · 全部确定性（无 Math.random）
   ============================================================ */
(function (w) {
  var B = {};

  /* ---------- 确定性伪随机（同一 seed 每次一致） ---------- */
  B.rnd = function (seed) {
    var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  /* ---------- 字幕挂到时间轴 ----------
     lines: [{t,s,e}] 相对镜头起点；淡入淡出 0.18s，行短则压缩
  */
  B.mountSubs = function (tl, wrap, lines, cls) {
    var FI = 0.18;
    lines.forEach(function (L) {
      var d = document.createElement('div');
      d.className = 'sub' + (cls ? ' ' + cls : '');
      d.textContent = L.t;
      wrap.appendChild(d);
      var dur = L.e - L.s;
      var fi = Math.min(FI, dur * 0.35);
      var fo = Math.min(FI, dur * 0.30);
      tl.set(d, { opacity: 0, y: 10 }, 0);
      tl.to(d, { opacity: 1, y: 0, duration: fi, ease: 'power2.out' }, Math.max(0, L.s));
      tl.to(d, { opacity: 0, duration: fo, ease: 'power1.in' }, Math.max(0, L.e - fo));
    });
  };

  /* ---------- 粒子工厂 ----------
     opts: {n, cx, cy, spreadX, spreadY, from:{x,y}, cls, size}
     返回 [{el, ex, ey, ang}]，由调用方写 tl
  */
  B.particles = function (layer, opts) {
    var n = opts.n || 16, out = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var el = document.createElement('div');
      el.className = 'pt' + (opts.cls ? ' ' + opts.cls : '');
      if (opts.size) { el.style.width = opts.size + 'px'; el.style.height = opts.size + 'px'; }
      layer.appendChild(el);
      out.push({ el: el, ang: a, i: i });
    }
    return out;
  };

  /* ---------- 光晕 ---------- */
  B.halo = function (parent, o) {
    var d = document.createElement('div');
    d.className = 'halo';
    d.style.left = o.x + 'px';
    d.style.top = o.y + 'px';
    d.style.width = o.w + 'px';
    d.style.height = o.w + 'px';
    d.style.marginLeft = (-o.w / 2) + 'px';
    d.style.marginTop = (-o.w / 2) + 'px';
    d.style.background = 'radial-gradient(circle, ' + o.color + ' 0%, rgba(0,0,0,0) 66%)';
    if (o.blur) d.style.filter = 'blur(' + o.blur + 'px)';
    parent.appendChild(d);
    return d;
  };

  /* ---------- 光带 ---------- */
  B.band = function (parent, o) {
    var d = document.createElement('div');
    d.className = 'band ' + (o.cls || 'red');
    d.style.left = o.x + 'px';
    d.style.top = o.y + 'px';
    d.style.width = o.w + 'px';
    d.style.height = o.h + 'px';
    d.style.marginLeft = (-o.w / 2) + 'px';
    d.style.marginTop = (-o.h / 2) + 'px';
    parent.appendChild(d);
    return d;
  };

  /* ---------- 火柴人 ---------- */
  B.person = function (parent, o) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'person' + (o.cls ? ' ' + o.cls : ''));
    svg.setAttribute('viewBox', '0 0 120 240');
    svg.style.left = o.x + 'px';
    svg.style.top = o.y + 'px';
    svg.style.width = (o.w || 120) + 'px';
    svg.style.height = (o.w ? o.w * 2 : 240) + 'px';
    var parts = [
      ['circle', { cx: 60, cy: 34, r: 22 }],
      ['line', { x1: 60, y1: 56, x2: 60, y2: 148 }],
      ['line', { x1: 60, y1: 82, x2: 26, y2: 118 }],
      ['line', { x1: 60, y1: 82, x2: 94, y2: 118 }],
      ['line', { x1: 60, y1: 148, x2: 34, y2: 216 }],
      ['line', { x1: 60, y1: 148, x2: 86, y2: 216 }]
    ];
    parts.forEach(function (p) {
      var e = document.createElementNS(ns, p[0]);
      for (var k in p[1]) e.setAttribute(k, p[1][k]);
      svg.appendChild(e);
    });
    parent.appendChild(svg);
    return svg;
  };

  /* ============================================================
     火柴人 · 四段关节骨架（大臂+小臂 / 大腿+小腿）
     规范来源：腿用「脚点 + 膝盖外顶」反推；肢体比例与「关节必须被看见」为硬约束

     ⚠️ 为什么肢体不用 transform 旋转：
     Chrome 对 SVG <g> 的 transform-origin 在大角度（举手 >90°）会按
     fill-box 解析，整条胳膊被甩出身体；GSAP 的 svgOrigin 也会因 bbox
     为空算错补偿平移。所以每一节肢体都是 <line>，每帧直接把算好的端点
     写进 x1/y1/x2/y2 —— 零浏览器差异，且肘/膝是两个真关节（各自转向）。
     只有「整个人」的平移 / 小角度倾 / 侧身翻转走 transform。
     ============================================================ */
  var DEG = Math.PI / 180;

  function mkSeg(par, ns) {
    var e = document.createElementNS(ns, 'line');
    par.appendChild(e);
    return e;
  }
  function segTo(el, a, b) {
    el.setAttribute('x1', a[0].toFixed(2)); el.setAttribute('y1', a[1].toFixed(2));
    el.setAttribute('x2', b[0].toFixed(2)); el.setAttribute('y2', b[1].toFixed(2));
  }
  function dotTo(el, p) {
    /* 关节是 <g>（光晕+核一起平移），别退回 cx/cy —— 那样只有核会动 */
    if (el.tagName === 'g') {
      el.setAttribute('transform',
        'translate(' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + ')');
      return;
    }
    el.setAttribute('cx', p[0].toFixed(2)); el.setAttribute('cy', p[1].toFixed(2));
  }

  /* ---------- 骨架（viewBox 0 0 120 240，1 单位 = w/120 px） ---------- */
  var G = {
    hip: [60, 148], sh: [60, 82], neck: [60, 56],
    /* ★ 所有幅度常量必须挂在 viewBox 单位上（120×240），**不是**像素。
       踩过的坑：idle/jump 曾写 var H = st.s || 240，而 st.s 是 svg 像素高
       （w=420 → 840），呼吸振幅被放大 3.5 倍 —— 人整体上飘、脚离地。
       凡「幅度」一律用 G.boxH / viewBox 单位，与 o.w 无关。 */
    boxW: 120, boxH: 240,
    footY: 216, stance: 24,
    upArm: 25.5, loArm: 24,
    leg: 36.5,                     /* 大腿=小腿=36.5；直腿 73 > 髋脚距 72 → 静止微屈，抬脚才明显弯 */
    armBase: 40, armElbow: -12,   /* 度：0=垂直向下，正=顺时针（朝画面左）。肘向内收 */
    /* 2026-11-03 新增两段末端骨骼（借第二座山 walker 的 rig 思路）：
       脚掌 = 踝 → 脚尖；手掌 = 腕 → 掌根。
       没有这两段，走路像拄拐、摆手像甩棍 —— 手脚有了「形」才有灵魂。 */
    sole: 14.5,                    /* 脚掌长（默认水平朝外，sole 角度控制跖屈/背屈）
                                      11 太短、配上 stroke-width 6 像穿了鞋；14.5 才是「脚」 */
    palm: 11.5,                    /* 手掌长（沿前臂延长，palm 角度控制掌心翻转） */
    palmIn: 42                     /* 手掌相对前臂的内偏角（度）。0 = 与前臂同一直线，
                                     视觉上只是「末端变细」，不像手。
                                     ⚠️ 别按小角度取值：手臂自然下垂时 a2≈28°（斜向外下），
                                     偏角扣掉 28° 才归零 —— 26 会让手掌几乎垂直于前臂延长线、
                                     等于没偏。42 才能在画面上读成「手朝身体垂着」 */
  };

  B.stick = function (parent, o) {
    o = o || {};
    var ns = 'http://www.w3.org/2000/svg';
    var W = o.w || 120, H = W * 2;

    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'person' + (o.cls ? ' ' + o.cls : ''));
    svg.setAttribute('viewBox', '0 0 120 240');
    svg.style.left = (o.x || 0) + 'px';
    svg.style.top = (o.y || 0) + 'px';
    svg.style.width = W + 'px';
    svg.style.height = H + 'px';

    var gRoot = document.createElementNS(ns, 'g');
    svg.appendChild(gRoot);

    /* 头：空环（头用 ring 不用实心圆）+ 绕颈根的独立旋转层 */
    var gHead = document.createElementNS(ns, 'g');
    gRoot.appendChild(gHead);
    var head = document.createElementNS(ns, 'circle');
    head.setAttribute('cx', 60); head.setAttribute('cy', 34); head.setAttribute('r', 22);
    gHead.appendChild(head);

    var trunk = mkSeg(gRoot, ns);
    segTo(trunk, G.neck, G.hip);

    /* 四段肢体：每条两节，中间是真关节 */
    var aUL = mkSeg(gRoot, ns), aLL = mkSeg(gRoot, ns);
    var aUR = mkSeg(gRoot, ns), aLR = mkSeg(gRoot, ns);
    var lUL = mkSeg(gRoot, ns), lLL = mkSeg(gRoot, ns);
    var lUR = mkSeg(gRoot, ns), lLR = mkSeg(gRoot, ns);

    /* 第三段末端：手掌（腕→掌根）、脚掌（踝→脚尖）。刻意画在肢体之后 = 压在上面 */
    var mPL = mkSeg(gRoot, ns), mPR = mkSeg(gRoot, ns);
    var mSL = mkSeg(gRoot, ns), mSR = mkSeg(gRoot, ns);
    mPL.setAttribute('class', 'palm'); mPR.setAttribute('class', 'palm');
    mSL.setAttribute('class', 'sole'); mSR.setAttribute('class', 'sole');

    /* 状态：所有动作只改这些数字，draw() 每帧重算几何 */
    var S = {
      btx: 0, bty: 0, tilt: 0,        /* 待机：重心横移 / 呼吸起伏 / 绕脚底倾 */
      turnTilt: 0,                    /* 转身专用倾角：独立通道，别和待机 tilt 抢同一属性 */
      sxBase: 1,                      /* 基础侧身度：1=正对观众；0.58=侧身走（解决「螃蟹步」）
                                         与 turn 的 sx 相乘，两者互不抢属性 */
      tx: 0, ty: 0, bob: 0, sx: 1,    /* 位移层：走 / 跳 / 步频起伏 / 侧身翻转 */
      flip: 0,                        /* 空翻角（度）：绕身体重心转，见 B.flip
                                         单独一个通道，绝不能和 svg 的 rotation 混用 ——
                                         rotation 的原点被各镜写成 '50% 90%'（脚底），
                                         且 scale≠1 时改原点会让人瞬移 */
      hIdle: 0, hNod: 0, hTurn: 0,    /* 头：左右倾 / 上下点 / 水平转（转头张望用这层） */
      aL: { rot: 0, act: 0, e: 0, palm: 0 },   /* rot=待机摆 / act=动作 / e=额外屈肘 / palm=掌翻转 */
      aR: { rot: 0, act: 0, e: 0, palm: 0 },
      lL: { fx: 60 - G.stance, fy: G.footY, sole: 0 },   /* sole=脚掌角，0=平贴地面 */
      lR: { fx: 60 + G.stance, fy: G.footY, sole: 0 }
    };

    function draw() {
      /* 变换链顺序即语义：先位移，再绕脚底倾，再侧身压窄，最后绕重心空翻。
         空翻必须排在 scale 之后 —— 先压窄再转，转出来的还是一个窄人绕着轴转；
         排在前面的话 scale 会把已经转过的坐标系一起压扁，翻到一半人会被拉斜。 */
      gRoot.setAttribute('transform',
        'translate(' + (S.btx + S.tx).toFixed(2) + ',' + (S.bty + S.ty + S.bob).toFixed(2) + ') ' +
        'translate(60,216) rotate(' + (S.tilt + (S.turnTilt || 0)).toFixed(2) + ') ' +
        'scale(' + (S.sx * (S.sxBase || 1)).toFixed(3) + ',1) translate(-60,-216)' +
        (S.flip ? ' translate(60,120) rotate(' + S.flip.toFixed(2) + ') translate(-60,-120)' : ''));

      /* 头：hTurn 是水平位移（模拟左右转头张望，纯倾角做不出「看向那边」） */
      /* 头要抵消转身的 sx 压窄：侧身时身体变窄是对的，头是球体不该变椭圆。
         父级 scale(sx,1) 绕 (60,216)，这里在头部基点补 scale(1/sx,1) 抵回来。 */
      var _sx = S.sx * (S.sxBase || 1);
      var hk = (Math.abs(_sx) < 0.05) ? 1 : 1 / _sx;
      gHead.setAttribute('transform',
        'translate(60,56) scale(' + hk.toFixed(3) + ',1) ' +
        'rotate(' + (S.hIdle + S.hNod).toFixed(2) + ') ' +
        'translate(' + (S.hTurn || 0).toFixed(2) + ',0) translate(-60,-56)');

      /* ---- 手臂：肩 → 肘 → 手 → 掌 ---- */
      [[S.aL, aUL, aLL, 1, mPL], [S.aR, aUR, aLR, -1, mPR]].forEach(function (q) {
        var st = q[0];
        var a1 = G.armBase * q[3] + st.rot + st.act;              /* 大臂角（度） */
        var a2 = a1 + G.armElbow * q[3] + st.e;                   /* 小臂角：肘是第二个关节 */
        var el = [G.sh[0] - Math.sin(a1 * DEG) * G.upArm,
                  G.sh[1] + Math.cos(a1 * DEG) * G.upArm];
        var hd = [el[0] - Math.sin(a2 * DEG) * G.loArm,
                  el[1] + Math.cos(a2 * DEG) * G.loArm];
        segTo(q[1], G.sh, el);
        segTo(q[2], el, hd);
        /* 手掌：腕 → 掌根。基础内偏 palmIn（朝身体），palm 角度可再翻转（招手/托腮时用） */
        var pa = a2 * DEG + ((st.palm || 0) - G.palmIn * q[3]) * DEG;
        segTo(q[4], hd, [hd[0] - Math.sin(pa) * G.palm,
                         hd[1] + Math.cos(pa) * G.palm]);
      });

      /* ---- 腿：给定脚点，用「两节等长」反推膝 ---- */
      [[S.lL, lUL, lLL, 1, mSL], [S.lR, lUR, lLR, -1, mSR]].forEach(function (q) {
        var st = q[0];
        var fx = st.fx, fy = st.fy - (st.dip || 0);
        var dx = fx - G.hip[0], dy = fy - G.hip[1];
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var dmax = G.leg * 2 - 0.6;
        if (d > dmax) {                     /* 脚伸得太远：拉回可达圈，避免腿被拉长 */
          var k = dmax / d;
          fx = G.hip[0] + dx * k; fy = G.hip[1] + dy * k;
          d = dmax; dx = fx - G.hip[0]; dy = fy - G.hip[1];
        }
        var half = d / 2;
        var h = Math.sqrt(Math.max(0, G.leg * G.leg - half * half));   /* 膝盖外顶量 */
        var mx = (G.hip[0] + fx) / 2, my = (G.hip[1] + fy) / 2;
        var ux = dx / d, uy = dy / d;
        var kn = [mx - uy * h * q[3], my + ux * h * q[3]];
        var ft = [fx, fy];
        segTo(q[1], G.hip, kn);
        segTo(q[2], kn, ft);
        /* 脚掌：踝 → 脚尖。正面视角脚尖朝身体外侧；sole 控制跖屈（正）/背屈（负） */
        var so = (st.sole || 0) * DEG;
        segTo(q[4], ft, [ft[0] - q[3] * Math.cos(so) * G.sole,
                         ft[1] + Math.sin(so) * G.sole]);
      });
    }

    /* ⚠️ 子对象也必须挂着 draw：tw() 靠 node.__draw 触发重绘。
       只挂 S 的话，改 arm/leg 的 tween 只改数字不重画几何 —— 画面会
       停在"上一次有人动 S"的那一帧（典型症状：跳完腿一直收着）。 */
    S.__draw = draw;
    S.aL.__draw = draw; S.aR.__draw = draw;
    S.lL.__draw = draw; S.lR.__draw = draw;
    parent.appendChild(svg);
    draw();

    return { svg: svg, w: W, s: H, _s: S, rider: S, body: S, head: S, draw: draw };
  };

  /* tween 一个状态对象，每帧顺手重画一次几何 */
  function tw(tl, node, vars, at) {
    if (node && node.__draw) vars.onUpdate = node.__draw;
    return tl.to(node, vars, at);
  }

  /* ---------- 呼吸待机 ----------
     呼吸 0.30Hz（0.0185H）+ 重心横移 0.18Hz（0.027H）+ 绕脚底倾 1.5°
     + 手臂 ±6° 反相 + 头 2.4° + 膝随重心微屈。
     多人必须传 phase（0..1）错开，否则一圈人整齐摆动像复制粘贴。
  */
  B.idle = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0;
    var dur = (o.dur == null) ? 6 : o.dur;
    var amp = (o.amp == null) ? 1 : o.amp;
    var ph = (o.phase || 0) % 1;
    var H = G.boxH;   /* viewBox 高，与像素宽无关 —— 见 G 上的陷阱注释 */

    var P_BR = 3.34, P_SW = 5.56, P_HD = 4.30;
    function loops(P) { return Math.max(1, Math.round(dur / P)); }

    var t0 = at + ph * 1.1;
    var br = 0.0185 * H * amp;
    var sw = 0.027 * H * amp;

    tw(tl, S, { bty: -br, duration: P_BR / 2, ease: 'sine.inOut',
                yoyo: true, repeat: loops(P_BR) * 2 - 1 }, t0);
    tw(tl, S, { btx: sw, duration: P_SW / 2, ease: 'sine.inOut',
                yoyo: true, repeat: loops(P_SW) * 2 - 1 }, at + (1 - ph) * 1.6);
    tw(tl, S, { tilt: 1.5 * amp, duration: P_SW / 2, ease: 'sine.inOut',
                yoyo: true, repeat: loops(P_SW) * 2 - 1 }, at + (1 - ph) * 1.6);

    /* 手臂随呼吸极小摆动（±6°），左右反相 */
    if (o.arms !== false) {
      tw(tl, S.aL, { rot: 6.0 * amp, duration: P_BR / 2, ease: 'sine.inOut',
                     yoyo: true, repeat: loops(P_BR) * 2 - 1 }, t0);
      tw(tl, S.aR, { rot: -6.0 * amp, duration: P_BR / 2, ease: 'sine.inOut',
                     yoyo: true, repeat: loops(P_BR) * 2 - 1 }, t0 + P_BR / 2);
    }
    tw(tl, S, { hIdle: 2.4 * amp, duration: P_HD / 2, ease: 'sine.inOut',
                yoyo: true, repeat: loops(P_HD) * 2 - 1 }, at + ph * 0.6);

    /* 膝：重心压到哪边，哪边腿伸直、另一边微屈（没有这一下，人像立在滑板上） */
    tw(tl, S.lL, { dip: 3 * amp, duration: P_SW / 2, ease: 'sine.inOut',
                   yoyo: true, repeat: loops(P_SW) * 2 - 1 }, at + (1 - ph) * 1.6 + P_SW / 2);
    tw(tl, S.lR, { dip: 3 * amp, duration: P_SW / 2, ease: 'sine.inOut',
                   yoyo: true, repeat: loops(P_SW) * 2 - 1 }, at + (1 - ph) * 1.6);
    tw(tl, S.lL, { dip: 0, duration: .45, ease: 'sine.out' }, at + dur);
    tw(tl, S.lR, { dip: 0, duration: .45, ease: 'sine.out' }, at + dur);
    return st;
  };

  /* ---------- 行走：交替迈腿 + 对侧摆臂 + 2× 步频起伏 ---------- */
  var GAIT = { stride: 21, lift: 13, armSwing: 13 };

  /* 第二座山 gait 的核心：膝只在「摆动相」折叠，支撑相伸直。
     flex = (0.10 + 0.62 · max(0, −sin(ph−0.6))^1.15)
     —— 0.10 是常驻微屈（腿永不僵直），后半段的 1.15 次幂让折叠来得快、
     到位缓，比半波正弦更像真人的收腿。抬脚高度由折叠角反推。 */
  function gaitLift(ph) {
    var flex = 0.10 + 0.62 * Math.pow(Math.max(0, -Math.sin(ph - 0.6)), 1.15);
    return (G.leg * 2) * (1 - Math.cos(flex)) * 0.62;
  }

  function applyGait(S, p, amp) {
    var TAU = Math.PI * 2;
    /* 骨盆起伏：先算，因为下面支撑脚要拿它做反向补偿 */
    S.bob = -0.022 * G.boxH * Math.abs(Math.sin(TAU * p)) * amp;
    [[S.lL, 0, -1], [S.lR, 0.5, 1]].forEach(function (q) {
      var st = q[0], ph = TAU * (p + q[1]);
      var c = Math.cos(ph);
      var lift = gaitLift(ph) * amp;
      st.fx = 60 + q[2] * G.stance + GAIT.stride * c * amp;
      /* ★ 必须减 S.bob：bob 把整个人往上提，脚若不反向补偿就会离地。
         画面上"走起来脚在飘"十有八九是漏了这一项。 */
      st.fy = G.footY - lift - S.bob;
      st.sole = (lift / GAIT.lift) * -18;     /* 抬起→脚尖上翘，落地→平贴地面 */
    });
    /* 手臂与异侧腿同相（同相会顺拐） */
    S.aL.act = GAIT.armSwing * Math.cos(TAU * (p + 0.5)) * amp;
    S.aR.act = -GAIT.armSwing * Math.cos(TAU * p) * amp;
    S.__draw();
  }

  B.walk = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, dur = o.dur || 1.6;
    var amp = (o.amp == null) ? 1 : o.amp;
    var dx = (o.dx == null) ? 0 : o.dx;
    var p0 = (o.p0 == null) ? 0 : o.p0;

    /* 侧身走（解决「螃蟹步」）：正面朝观众横向迈步，读起来像螃蟹。
       把整身横向压窄到 side≈0.58，两腿的左右开合在视觉上就变成「前后错开」，
       读作「侧着走」；头有反向缩放补偿，仍是正圆。
       ⚠️ 构建期不要写 S.sxBase —— 那会让 tween 的起始值等于终值，人一帧都不动。 */
    if (o.side != null) {
      tw(tl, S, { sxBase: o.side, duration: (o.sideDur == null) ? 0.26 : o.sideDur,
                  ease: 'sine.inOut' }, at);
    }

    /* ★ 必须用相对量 "+="：连续两段 walk（踱步来回）时，若写绝对 tx=S.tx+dx，
       第二段在构建期读到的 S.tx 还没被第一段 tween 改，起点会错、人会往回跳。 */
    if (dx) {
      tw(tl, S, { tx: '+=' + dx, duration: dur, ease: o.ease || 'sine.inOut' }, at);
      S.tx = (S.tx || 0) + dx;
    }

    var gait = { p: 0 };
    tl.to(gait, {
      p: 1, duration: dur, ease: 'none',
      onUpdate: function () { applyGait(S, p0 + gait.p, amp); }
    }, at);
    /* 收尾：手臂归零 + 双脚收回站立位（p=1 时两脚会挤在中线，不收就是菱形腿） */
    tw(tl, S.lL, { fx: 60 - G.stance, fy: G.footY, sole: 0, duration: .34, ease: 'sine.inOut' }, at + dur);
    tw(tl, S.lR, { fx: 60 + G.stance, fy: G.footY, sole: 0, duration: .34, ease: 'sine.inOut' }, at + dur);
    tw(tl, S.aL, { act: 0, duration: .3, ease: 'sine.out' }, at + dur);
    tw(tl, S.aR, { act: 0, duration: .3, ease: 'sine.out' }, at + dur);
    tw(tl, S, { bob: 0, duration: .3, ease: 'sine.out' }, at + dur);
    if (o.side != null && o.sideBack) {
      tw(tl, S, { sxBase: 1, duration: .3, ease: 'sine.inOut' }, at + dur + .04);
    }
    return st;
  };

  /* ---------- 跳跃：蹲 → 弹 → 落 → 压 → 回 ---------- */
  B.jump = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0;
    var h = (o.h == null) ? 0.30 : o.h;
    var H = G.boxH;   /* viewBox 高，与像素宽无关 —— 见 G 上的陷阱注释 */
    var up = h * H;

    tw(tl, S, { ty: 0.055 * H, duration: .16, ease: 'power2.in' }, at);
    tw(tl, S, { ty: -up, duration: .30, ease: 'power2.out' }, at + .16);
    tw(tl, S, { ty: 0, duration: .28, ease: 'power2.in' }, at + .46);
    tw(tl, S, { ty: 0.05 * H, duration: .10, ease: 'power1.out' }, at + .74);
    tw(tl, S, { ty: 0, duration: .20, ease: 'power2.out' }, at + .84);

    /* 收腿：脚跟着身体上去一点（膝就自然弯了），落地再放下 */
    tw(tl, S.lL, { fy: G.footY - 16, duration: .34, ease: 'power2.out' }, at + .16);
    tw(tl, S.lR, { fy: G.footY - 16, duration: .34, ease: 'power2.out' }, at + .16);
    tw(tl, S.lL, { fy: G.footY, duration: .32, ease: 'power2.in' }, at + .52);
    tw(tl, S.lR, { fy: G.footY, duration: .32, ease: 'power2.in' }, at + .52);

    tw(tl, S.aL, { act: -26, duration: .32, ease: 'power2.out' }, at + .16);
    tw(tl, S.aR, { act: -26, duration: .32, ease: 'power2.out' }, at + .16);
    tw(tl, S.aL, { act: 0, duration: .34, ease: 'sine.inOut' }, at + .55);
    tw(tl, S.aR, { act: 0, duration: .34, ease: 'sine.inOut' }, at + .55);
    return st;
  };

  /* ---------- 空翻（后空翻/前空翻） ----------
     和 jump 的区别：jump 只有上下，空翻要「腾空 + 自转 + 抱膝」三件事同时发生，
     少任何一样都读不出"翻过去"，只像"跳起来抖了一下"。

     为什么不用 svg 的 rotation 做翻转：
     · 各镜把 lao.svg 的 transformOrigin 钉在 '50% 90%'（脚底当轴，站立才不飘）；
       空翻要绕身体重心，改 origin 会在 scale≠1 时让人瞬移几十像素。
     · rotation 这个属性还要留给 B8 的僵直微抖，两边抢同一条通道会互相覆盖。
     所以翻转角做成骨架内部的 S.flip，写进 draw() 的变换链末端，绕 (60,120) 转。

     ⚠️ 每翻转一次 flip 会累计 ±360。下一次翻转开头用 tl.set 归零（此时角度本来就是
     360 的整数倍，归零在视觉上是恒等变换，不会看到跳帧）。
     ---------- */
  B.flip = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0;
    var dur = (o.dur == null) ? 0.88 : o.dur;
    var dir = (o.dir == null) ? -1 : o.dir;   /* -1 后空翻 / +1 前空翻 */
    var H = G.boxH;
    var up = (o.h == null ? 0.44 : o.h) * H;

    tl.set(S, { flip: 0, onUpdate: S.__draw }, at);
    /* 自转：power1.inOut 起收慢、中段快 —— 真实空翻就是顶点附近转速最高 */
    tw(tl, S, { flip: 360 * dir, duration: dur, ease: 'power1.inOut' }, at);

    /* 腾空：蹲 → 起 → 顶 → 落 → 压 → 回（13 个单位的下蹲足够读出"蓄力"） */
    tw(tl, S, { ty: 0.055 * H, duration: .13, ease: 'power2.in' }, at);
    tw(tl, S, { ty: -up, duration: dur * 0.40, ease: 'power2.out' }, at + .13);
    tw(tl, S, { ty: 0, duration: dur * 0.40, ease: 'power2.in' }, at + .13 + dur * 0.40);
    tw(tl, S, { ty: 0.06 * H, duration: .10, ease: 'power1.out' }, at + dur + .13);
    tw(tl, S, { ty: 0, duration: .18, ease: 'power2.out' }, at + dur + .23);

    /* 抱膝：脚收到髋前上方（fy 大幅上抬），落地再放回 —— 不抱膝就是"直挺挺地转"，
       看着像被风吹翻的木板 */
    var tuckY = G.footY - 78, tuck1 = at + .16, tuck2 = at + dur * 0.72;
    tw(tl, S.lL, { fx: 44, fy: tuckY, sole: -34, duration: dur * 0.34, ease: 'power2.out' }, tuck1);
    tw(tl, S.lR, { fx: 76, fy: tuckY, sole: -34, duration: dur * 0.34, ease: 'power2.out' }, tuck1);
    tw(tl, S.lL, { fx: 60 - G.stance, fy: G.footY, sole: 0, duration: dur * 0.26, ease: 'power2.in' }, tuck2);
    tw(tl, S.lR, { fx: 60 + G.stance, fy: G.footY, sole: 0, duration: dur * 0.26, ease: 'power2.in' }, tuck2);

    /* 手臂：向后摆 → 抱膝 → 落地张开稳身 */
    tw(tl, S.aL, { act: -52, e: 26, duration: dur * 0.30, ease: 'power2.out' }, at + .14);
    tw(tl, S.aR, { act: -52, e: 26, duration: dur * 0.30, ease: 'power2.out' }, at + .14);
    tw(tl, S.aL, { act: -14, e: 4, duration: dur * 0.34, ease: 'sine.inOut' }, at + dur * 0.70);
    tw(tl, S.aR, { act: -14, e: 4, duration: dur * 0.34, ease: 'sine.inOut' }, at + dur * 0.70);
    tw(tl, S.aL, { act: 26, e: 0, duration: .16, ease: 'power2.out' }, at + dur + .10);
    tw(tl, S.aR, { act: 26, e: 0, duration: .16, ease: 'power2.out' }, at + dur + .10);
    tw(tl, S.aL, { act: 0, duration: .3, ease: 'sine.out' }, at + dur + .30);
    tw(tl, S.aR, { act: 0, duration: .3, ease: 'sine.out' }, at + dur + .30);
    return st;
  };

  /* ---------- 原地转身（侧身翻转；不能用 rotation，会和摆动抢属性） ---------- */
  B.turn = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, d = o.dur || 0.66;
    /* ★ 构建期朝向用独立变量追踪，绝不写 S.sx。
       旧写法 `var s0 = S.sx || 1; ...; S.sx = -s0;` 在构建期就改了状态，
       结果第一帧就被镜像（seek(0) 时人已经左右反了）；pace 调用 4 次则整片翻 3 次。 */
    var dir = (st.__facing == null) ? 1 : st.__facing;
    var nd = -dir;
    st.__facing = nd;
    var k = o.narrow || 0.6;              /* 侧身最窄处：0.6 = 读到「侧过身」，不是被压成一根线 */
    var t1 = at + d * 0.40;               /* 压窄 */
    var t2 = t1 + d * 0.16;               /* 保持侧身 */
    /* ① 压窄到侧身（朝向不变） */
    tw(tl, S, { sx: k * dir, duration: d * 0.40, ease: 'power2.in' }, at);
    /* ② 在「窄处」换向：宽度不变（0.6→-0.6 只翻符号），视觉无跳变。
       必须用 tl.set 而不是 tl.call —— hyperframes 逐帧 seek 会跳过 call。 */
    tl.set(S, { sx: k * nd, onUpdate: S.__draw }, t1);
    /* ③ 侧身稍停，别让转身一闪而过 */
    tw(tl, S, { sx: k * nd, duration: d * 0.16 }, t1);
    /* ④ 从侧身展开回正面 */
    tw(tl, S, { sx: nd, duration: d * 0.44, ease: 'power2.out' }, t2);
    /* ⑤ 重心跟随：转身时身体朝转的方向倾一下，否则只是"变窄"没有"转" */
    tw(tl, S, { turnTilt: 9 * dir, duration: d * 0.40, ease: 'power2.in' }, at);
    tw(tl, S, { turnTilt: -5 * dir, duration: d * 0.28, ease: 'sine.inOut' }, t2);
    tw(tl, S, { turnTilt: 0, duration: d * 0.32, ease: 'sine.out' }, t2 + d * 0.28);
    return st;
  };

  /* ---------- 抬手 / 指向 / 自托 / 双臂上举 ----------
     deg 正 = 左臂顺时针（举向画面左上）；负 = 右臂逆时针（举向画面右上）
  */
  B.raise = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, d = o.dur || 0.6;
    var arm = o.right ? S.aR : S.aL;
    var deg = (o.deg == null) ? -105 : o.deg;
    var back = (o.back !== false);
    var eo = o.right ? 8 : -8;      /* 举起时抵消基础屈肘并留一点弯，别像根棍子 */
    tw(tl, arm, { act: deg, e: eo, duration: d * 0.55, ease: 'power2.out' }, at);
    if (back) tw(tl, arm, { act: 0, e: 0, duration: d * 0.45, ease: 'sine.inOut' }, at + d * 0.55);
    return st;
  };

  /* ---------- 点头（正角度=低头，负角度=仰头） ---------- */
  B.nod = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, deg = (o.deg == null) ? 7 : o.deg;
    tw(tl, S, { hNod: deg, duration: .22, ease: 'power2.inOut' }, at);
    tw(tl, S, { hNod: 0, duration: .34, ease: 'sine.inOut' }, at + .26);
    return st;
  };

  /* ---------- 整体位移（替代直接 tl.to(st.rider,{ty})） ---------- */
  B.slide = function (tl, st, o) {
    o = o || {};
    var v = { duration: (o.dur == null) ? 1 : o.dur, ease: o.ease || 'power2.inOut' };
    if (o.tx != null) v.tx = o.tx;
    if (o.ty != null) v.ty = o.ty;
    return tw(tl, st._s, v, o.at || 0);
  };


  /* ============================================================
     2026-11-03 新增 · 「让火柴人不闲着」的七个动作 + 一个编排器
     ------------------------------------------------------------
     动机：单段合成片里，火柴人常常一站在画面中间就是十几秒，只有
     呼吸待机 —— 观众感觉"人没了"。这一组动作专门填那些空档。

     全部确定性：只改 S / S.aL / S.lL 上的数字，靠 tw() 的 onUpdate
     触发 draw() 重算几何。无 CSS 动画、无 Math.random、无 Date.now，
     seek(t) 逐帧渲染结果完全可复现。
     ============================================================ */

  /* ---------- ① 踱步：左右来回走，每个端点自动转身 ----------
     这是「人站在中间不肯闲着」最有效的一招 —— 位移 + 转身 + 步态三件套，
     观众的眼睛会自动跟着人走，画面就不再是"静止 + 呼吸"。
     dx 正 = 向右；laps = 来回几趟（一趟 = 去 + 回）。 */
  B.pace = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0;
    var dx = (o.dx == null) ? 130 : o.dx;
    var laps = o.laps || 2;
    var dur = o.dur || (laps * 2 * 1.4);
    var amp = (o.amp == null) ? 1 : o.amp;
    var leg = dur / (laps * 2);          /* 单程时长 */
    var side = (o.side == null) ? 0.58 : o.side;
    var i, t0, dir;
    /* 全程保持侧身（走的时候侧身、站定转身时更侧），收尾回正身 */
    tw(tl, S, { sxBase: side, duration: .3, ease: 'sine.inOut' }, at - .02);
    tw(tl, S, { sxBase: 1, duration: .34, ease: 'sine.inOut' }, at + dur + .2);
    for (i = 0; i < laps * 2; i++) {
      t0 = at + i * leg;
      dir = (i % 2 === 0) ? 1 : -1;
      /* 走动只占单程的 60%：留 40% 给转身。
         早先 walk 占 0.74、转身只剩 0.2·leg（≈0.28s），转得太快等于没转。 */
      B.walk(tl, st, { at: t0, dur: leg * 0.60, dx: dir * dx,
                       amp: amp, p0: (i % 2) * 0.5, side: side });
      /* 已经侧身时转身不再压到 0.6（瘦成一根线），只微收到 0.92 */
      if (i < laps * 2 - 1) B.turn(tl, st, { at: t0 + leg * 0.68, dur: leg * 0.34,
                                             narrow: 0.92 });
    }
    return st;
  };

  /* ---------- ② 摆手（打招呼 / 说"不不不"） ----------
     抬手到肩上方，前臂来回甩 n 次。用 e（额外屈肘）当摆幅，
     因为手掌在前臂末端，摆 e 的手就自动跟着摆。 */
  B.wave = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, dur = o.dur || 1.5;
    var right = !!o.right;
    var arm = right ? S.aR : S.aL;
    var sg = right ? -1 : 1;                 /* 左臂正向 / 右臂负向 */
    var deg = (o.deg == null) ? 100 : o.deg;
    var n = o.times || 3;
    var q = dur * 0.22;
    var w = (dur - q * 2) / (n * 2);
    tw(tl, arm, { act: deg * sg, e: 10 * sg, palm: -10 * sg,
                  duration: q, ease: 'power2.out' }, at);
    tw(tl, arm, { e: -22 * sg, duration: w, ease: 'sine.inOut',
                  yoyo: true, repeat: n * 2 - 1 }, at + q);
    tw(tl, arm, { act: 0, e: 0, palm: 0, duration: q, ease: 'sine.inOut' }, at + dur - q);
    return st;
  };

  /* ---------- ③ 转一圈（两次侧身翻转 = 视觉 360°） ----------
     不能用 rotate：sx 是"正面↔侧面"的镜像轴，翻两次正好转一圈，
     且和 idle 的摆动互不抢属性。附带双臂外张 + 双脚交替点地做离心感。 */
  B.spin = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, d = o.dur || 1.2;
    var q = d / 2;
    B.turn(tl, st, { at: at, dur: q });
    B.turn(tl, st, { at: at + q, dur: q });
    tw(tl, S.aL, { act: 34, duration: q * 0.45, ease: 'power2.out' }, at);
    tw(tl, S.aR, { act: -34, duration: q * 0.45, ease: 'power2.out' }, at);
    tw(tl, S.aL, { act: 0, duration: q * 0.6, ease: 'sine.inOut' }, at + q * 1.1);
    tw(tl, S.aR, { act: 0, duration: q * 0.6, ease: 'sine.inOut' }, at + q * 1.1);
    tw(tl, S.lL, { fy: G.footY - 9, sole: -20, duration: q * 0.35, ease: 'sine.out' }, at + q * 0.15);
    tw(tl, S.lR, { fy: G.footY - 9, sole: -20, duration: q * 0.35, ease: 'sine.out' }, at + q * 0.65);
    tw(tl, S.lL, { fy: G.footY, sole: 0, duration: q * 0.35, ease: 'sine.in' }, at + q * 0.6);
    tw(tl, S.lR, { fy: G.footY, sole: 0, duration: q * 0.35, ease: 'sine.in' }, at + q * 1.1);
    return st;
  };

  /* ---------- ④ 叉腰（姿态语言：笃定 / 不服 / 等着看） ----------
     大臂只外张一点点、前臂向内折回髋骨 —— 不是"举",是"扶"。
     keep:true 表示不自动收回（配合 B.idle 长期保持叉腰站立）。 */
  B.hip = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, dur = o.dur || 1.2;
    var right = !!o.right;
    var arm = right ? S.aR : S.aL;
    var sg = right ? -1 : 1;
    var q = Math.min(0.5, dur * 0.3);
    tw(tl, arm, { act: -26 * sg, e: -30 * sg, palm: 22 * sg,
                  duration: q, ease: 'power2.out' }, at);
    if (o.keep !== true) {
      tw(tl, arm, { act: 0, e: 0, palm: 0, duration: q, ease: 'sine.inOut' }, at + dur - q);
    }
    return st;
  };

  /* ---------- ⑤ 沉思（托腮）：头低一点、重心压到一侧、点头两次 ----------
     差别不在"手放在哪"，在"重心移开了" —— 只抬手不挪重心，看着像挠脸。 */
  B.think = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, dur = o.dur || 1.8;
    var q = dur * 0.2;
    var side = o.right ? -1 : 1;
    tw(tl, S.aR, { act: -70, e: 104, palm: 16, duration: q, ease: 'power2.out' }, at);
    tw(tl, S, { hNod: 5, hTurn: -3 * side, hIdle: -4 * side,
                btx: -4 * side, tilt: -1.2 * side,
                duration: q * 1.4, ease: 'sine.out' }, at);
    tw(tl, S, { hNod: 2, duration: dur * 0.14, ease: 'sine.inOut',
                yoyo: true, repeat: 3 }, at + dur * 0.42);
    B.hip(tl, st, { at: at + q * 0.6, dur: dur - q * 1.6, right: !o.right, keep: false });
    tw(tl, S.aR, { act: 0, e: 0, palm: 0, duration: q, ease: 'sine.inOut' }, at + dur - q);
    return st;
  };

  /* ---------- ⑥ 顿足（强调 / 不耐烦）：抬脚 → 砸下 → 全身一顿 ----------
     一次 d=0.42s，times 可连跺。手臂反甩是为了让"砸"有反作用力。 */
  B.stomp = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0;
    var h = (o.h == null) ? 14 : o.h;
    var t = o.times || 1;
    var leg = o.right ? S.lR : S.lL;
    var i, t0, d = 0.5;                       /* 单次占 0.43s，留 0.07s 呼吸，连跺不叠 */
    for (i = 0; i < t; i++) {
      t0 = at + i * d;
      tw(tl, leg, { fy: G.footY - h, sole: -22, duration: .16, ease: 'power2.out' }, t0);
      tw(tl, S, { bty: -3, duration: .16, ease: 'power2.out' }, t0);
      tw(tl, leg, { fy: G.footY, sole: 6, duration: .09, ease: 'power3.in' }, t0 + .16);
      tw(tl, S, { bty: 4, duration: .09, ease: 'power3.in' }, t0 + .16);
      tw(tl, S, { bty: 0, duration: .17, ease: 'sine.out' }, t0 + .25);
      tw(tl, S.aL, { act: -16, duration: .12, ease: 'power2.out' }, t0 + .16);
      tw(tl, S.aR, { act: 16, duration: .12, ease: 'power2.out' }, t0 + .16);
      tw(tl, S.aL, { act: 0, duration: .2, ease: 'sine.out' }, t0 + .28);
      tw(tl, S.aR, { act: 0, duration: .2, ease: 'sine.out' }, t0 + .28);
      tw(tl, leg, { sole: 0, duration: .18, ease: 'sine.out' }, t0 + .25);
    }
    return st;
  };

  /* ---------- ⑦ 转头张望（最轻的一下"活着"） ----------
     头只有 hIdle（左右倾）和 hNod（上下点），做不出"看向那边"，
     所以加 hTurn = 头的水平位移。dir 1=看画面右，-1=看画面左。 */
  B.look = function (tl, st, o) {
    o = o || {};
    var S = st._s;
    var at = o.at || 0, dur = o.dur || 1.0;
    var dir = (o.dir == null) ? 1 : o.dir;
    var q = dur * 0.3;
    tw(tl, S, { hTurn: 6 * dir, hIdle: 2.5 * dir, duration: q, ease: 'power2.out' }, at);
    tw(tl, S, { hTurn: 0, hIdle: 0, duration: q * 1.2, ease: 'sine.inOut' }, at + dur - q * 1.2);
    return st;
  };

  /* ---------- ⑧ 编排器：把一段空档自动填满 ----------
     ★ 这是这一组里最该用的一个。分镜里凡是"这段没人动"的地方，
       直接 B.live(tl, st, {at, dur}) 即可 —— 它在 dur 内按 gap 上限
       自动排布小动作，保证任何连续 gap 秒内一定有人在动，
       正好对上分镜那条「空中段上限 ≥1.2s 必须有新元素启动」的铁律。

     用法：B.idle(...) 铺底（呼吸不断）+ B.live(...) 插事件（每隔约 1.1s）。
     pool 可自定义；默认取最轻的几个，重动作（pace/spin）留给人自己安排。 */
  B.live = function (tl, st, o) {
    o = o || {};
    var at = o.at || 0, dur = o.dur || 6;
    var gap = o.gap || 1.0;                   /* 上界锁死：1.0×(0.82~1.18) → 实际间距 ≤1.18s */
    var amp = (o.amp == null) ? 1 : o.amp;
    var quiet = o.quiet || 0;                 /* 前段留白，让别的元素先说话 */
    var pool = o.pool || ['look', 'nod', 'stomp', 'hip', 'wave', 'shift'];
    var S = st._s;
    var end = at + dur - 0.5;
    var t = at + quiet;
    var i = 0, k, left;
    while (t < end) {
      k = pool[Math.floor(B.rnd(i * 3.7 + 1.1) * pool.length) % pool.length];
      left = end - t;
      if (k === 'look') {
        B.look(tl, st, { at: t, dir: (i % 2 ? -1 : 1), dur: Math.min(0.9, left) });
      } else if (k === 'nod') {
        B.nod(tl, st, { at: t, deg: (i % 2 ? -6 : 7) });
      } else if (k === 'stomp') {
        B.stomp(tl, st, { at: t, right: (i % 2 === 0), h: 9 * amp });
      } else if (k === 'hip') {
        B.hip(tl, st, { at: t, dur: Math.min(1.3, left), right: (i % 2 === 0) });
      } else if (k === 'wave') {
        B.wave(tl, st, { at: t, dur: Math.min(1.2, left), right: (i % 2 === 1), times: 2 });
      } else {                                  /* shift：换个重心站，最轻的「活着」 */
        tw(tl, S, { btx: (i % 2 ? -5 : 5) * amp,
                    tilt: (i % 2 ? -1.4 : 1.4) * amp,
                    duration: 0.55, ease: 'sine.inOut' }, t);
      }
      t += gap * (0.82 + 0.36 * B.rnd(i * 7.3 + 2.6));
      i++;
    }
    return st;
  };


  /* ---------- 数字滚动（写 textContent，靠 onUpdate） ---------- */
  B.counter = function (tl, el, from, to, dur, at, suffix) {
    var obj = { v: from };
    suffix = suffix || '';
    tl.set(el, { opacity: 1 }, at);
    tl.to(obj, {
      v: to, duration: dur, ease: 'power1.inOut',
      onUpdate: function () { el.textContent = Math.round(obj.v) + suffix; }
    }, at);
  };

  /* ---------- 环形扩散脉冲 ---------- */
  B.pulseRing = function (tl, parent, o, at) {
    var d = document.createElement('div');
    d.className = 'ring' + (o.cls ? ' ' + o.cls : '');
    d.style.left = o.x + 'px';
    d.style.top = o.y + 'px';
    d.style.width = o.r * 2 + 'px';
    d.style.height = o.r * 2 + 'px';
    d.style.marginLeft = (-o.r) + 'px';
    d.style.marginTop = (-o.r) + 'px';
    parent.appendChild(d);
    tl.set(d, { opacity: 0, scale: 0.25 }, 0);
    tl.to(d, { opacity: o.op || 0.85, scale: 1, duration: o.dur || 0.7, ease: 'power2.out' }, at);
    tl.to(d, { opacity: 0, scale: 1.35, duration: o.dur2 || 0.5, ease: 'power1.in' }, at + (o.dur || 0.7) * 0.6);
    return d;
  };

  /* ---------- 工具：把「秒」转成 tl 可用的位置 ---------- */
  B.at = function (s) { return Math.max(0, s); };

  w.B = B;
})(window);
