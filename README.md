# vibe-animation-library

> **可发布的动画元件镜像** —— 从一套自研动画库里挑出四个可独立调用的纯元件，
> 附索引与读法。这是**代码资产项目**，不是方法论项目。
>
> A publishable mirror of four reusable, deterministic Canvas/JS animation primitives.

**中文定位**：Vibe 动画库 —— 一套 Canvas 2D 伪 3D 确定性动画元件（火柴人/深度层/表情/肢体），并附带 Three.js + SwiftShader 真 3D 渲染管线。适用于 **AI 动画 · 伪 3D · 三维渲染 · 定格动画 · 创意编程**。OpenFilm 产线资产，MIT 许可。

[![status](https://img.shields.io/badge/status-v0.1%20open-orange)](#迭代)
[![primitives](https://img.shields.io/badge/primitives-4-blue)](#四个元件)
[![license](https://img.shields.io/badge/license-MIT-green)](#许可)

---

## 这是什么

一组**能直接引入项目的 JS 元件**：造形、表情、局部肢体、2D 造 3D 观感的纯函数。
全部是 vanilla JS、零构建、确定性（不持有时间、`Math.random` 或 `rAF`）。

它们是姊妹项目 `vibe-world-deduction`（另一个仓库，发布上线后在此补链接）里
`library-bridge` 那份 skill 的**实物对应**：

| | 管什么 |
|---|---|
| `library-bridge`（方法论） | **怎么找到、怎么接上**现成资产（清点、接入四式、喂样式不喂流程） |
| **本项目（代码资产）** | **被接的那个东西本身** |

> 一句话：`library-bridge` 说「别从零造椭圆」，这里给出可以拿来用的那几个元件。

## 四个元件

| 文件 | 能干什么 | 原库位置（溯源） |
|---|---|---|
| [`assets/depth2d.js`](assets/depth2d.js) | **2D 造 3D 观感的纯函数集** `D2.*`：圆头笔触体积、画家排序、z 灰阶雾、1/z 视差、射线墙高、方向选帧、序列帧环拍、风格 DNA 字段 | `2D伪3D造法/_core/depth2d.js` |
| [`assets/bloom.js`](assets/bloom.js) | 火柴人骨架与 15 个动作 API（含专治「人站着不动」的那一组），`120×240` viewBox | `火柴人动画/_core/bloom.js` |
| [`assets/face.js`](assets/face.js) | 整张脸／双眼／眼镜 + 10 个表情动作预设，挂 `window.FX` | `火柴人动画/_core/face.js` |
| [`assets/figure-parts.js`](assets/figure-parts.js) | **只要一只手／一只眼／一道视线**：三段手臂、抓取手、单眼、窄视锥、单向视线、思维光、姿态数值表 | `火柴人动画/_core/figure-parts.js` |

完整索引（含未镜像的库与选型表）见 [INVENTORY.md](INVENTORY.md)。

## 3D 渲染管线（真 3D）

除上面的 Canvas 2D 伪 3D 元件外，本仓库另收一套 **Three.js 无头渲染管线**
（目录 [`3d/`](3d/)），用于把**真 3D** 场景离线渲成视频：

- 方案 A · **SwiftShader 软件渲染**（本机无 GPU 加速时的主路径）：`--enable-unsafe-swiftshader`，约 **1.45 帧/秒**（1080×1920）。
- 方案 B · **硬件 GPU 加速**：`RENDER_GL=gpu`，速度数倍提升；或改用 `CAPTURE=jpeg` 取图提速约 2~5 倍。

两种模式是同一套管线（`render.mjs` + `scene.html`）切 Chrome GL 参数，
实测速度、运行步骤、与伪 3D 元件的区别，见
[`references/3D渲染方案.md`](references/3D渲染方案.md)。

> 一句话分工：**伪 3D 元件解决"平面上的东西看起来立体"，真 3D 管线解决"真的有个三维物体在转"**，按「准入三问」择一。

## 快速开始

```html
<script src="assets/depth2d.js"></script>
<script>
  // 元件只造形，不排时序：时间由调用方以参数传入
  const p = D2.project(/* x, y, z, cam */);
</script>
```

```html
<script src="assets/bloom.js"></script>
<script src="assets/face.js"></script>
<script src="assets/figure-parts.js"></script>
```

**挂进所属坐标系**：子元件（眼睛／眼镜／局部肢体）要挂在它所属的变换组里，
不要画在屏幕绝对坐标——机位一动就漂。

## 库规（不是判据，是这些元件能成立的前提）

摘自源元件头部注释与库 README：

1. **命名中性**：只用几何／物理名，不出现项目专名、角色名。
2. **元件只造形，不排时序**：没有一个函数持有 `t`、启动计时器或注册 `rAF`；
   时间一律由调用方以参数传入，返回值只依赖参数（**可乱序逐帧 seek**）。
3. **确定性**：禁 `Math.random` / `Date.now` / `performance.now` / `rAF` / 跨帧可变状态。
4. **`act` 与 `e` 成对**：上肢补间只给 `act` 会让肘部绕成整圈。
5. **源工程一字不动**：镜像里改的是公开副本，原库不因发布而被修改。

> 第 2、3 条正好对应 `film-qa/references/02_确定性自检.md`：
> 逐帧独立求值的渲染范式里，**同 `t` 必画同图**。

## 自包含程度

| 项 | 状态 |
|---|---|
| 四个 JS 元件 | ✅ 已镜像，机器路径已脱敏 |
| CSS（`stage.css` / `forms.css` 等） | ❌ 未镜像；需要时去源库取 |
| 第三方 `gsap.min.js` | ❌ **刻意不搬**（第三方许可另计，按需自行引入） |
| 最小样本 `index.html` | ❌ 未镜像；见 [`references/读序与自包含.md`](references/读序与自包含.md) |
| 703 份外部提示词 | ❌ 不搬；只给读法与索引方法 |

**这是镜像，不是完整库。** 需要全量资产请回源库；本项目只保证这四个元件能独立读、独立引。

## 目录

```
vibe-animation-library/
├── README.md
├── INVENTORY.md                  ← 元件索引与选型表
├── .gitignore
├── references/
│   ├── 造法层_2D伪3D.md          ← D2.* 八族造法摘要
│   ├── 读序与自包含.md           ← 怎么读、依赖什么、怎么接
│   └── 3D渲染方案.md             ← Three.js 无头渲染：软件/硬件两模式与速度实测
├── assets/                      ← 四个可调用 Canvas 2D 假 3D 元件
└── 3d/                          ← 真 3D 渲染管线（Three.js 无头抽帧）
    ├── scene.html               ← Three.js 场景，暴露 window.__render(i,total)
    ├── render.mjs               ← 无头抽帧
    ├── encode.mjs               ← 帧序列 → MP4
    ├── package.json
    └── run-render.ps1
```

## 迭代

> 动画库还在继续收集。

| 已知不足 |
|---|
| 只镜像了 4 个元件 |
| 没有最小可跑 demo |
| 没做元件兼容性标签（SVG / Canvas / WebGL） |
| 来源库仍在长 |

## 许可

**MIT** —— 全文见根目录 [`LICENSE`](LICENSE)。

四个元件均为自研实现，可自由下载、参考，商用请联系作者；唯一要求是保留版权声明。
`2D伪3D造法` 抽取自 9 个外部引擎的**方法**（不是复制其源码），
逐项对账记录见源项目文档。第三方 `gsap.min.js` 未包含在本仓库内，
本许可不覆盖它；按需自行引入时遵循其自身许可即可。

## 作者 / Author

抖音 · 视频号 · 公众号 · 知乎 · 小红书，全网通名 **狮道深度推演**。
本仓库元件所出自的已发布成片链接，统一列在姊妹项目 `vibe-world-deduction` 的
README「作者与成片」一节 —— 只维护一份，避免双头更新不一致。

---

> 姊妹项目：`vibe-world-deduction`（五个核心 + 三个辅助 Skill，另一个仓库）
