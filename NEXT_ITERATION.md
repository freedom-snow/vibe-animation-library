# 下一轮迭代计划 · Next Iteration Plan

> 记录于 2026-11-15。本轮（11-15）只做标签与中文检索词，下面的事项**推迟到下一次工作会话**再实操。
> 建此文档仅为防止遗忘，不代表本轮要执行。

---

## 待办（TODO）

### 1. `3d/` 最小可运行 demo ← 最高优先
- 用 SwiftShader 软件渲染跑 **30 帧试片**，验证脱敏后的 `3d/render.mjs` + `scene.html` 在本机真能出图（相对路径 / 环境变量是否自洽）。
- 产出一段短视频样片，确认：
  - 实测约 **1.45 fps**（软件渲染主路径）；
  - `RENDER_GL=gpu` 提速分支可切换；`CAPTURE=jpeg` 取图提速约 2~5 倍。
- 目的：把"代码看起来对"变成"实测通过"。

### 2. 上传 `vibe-world-deduction`（68 个文件）
- 走 **API（token + Git Data API）**，不走 `git push`（本机 schannel / 代理 `CONNECT tunnel 502`）。
- 仓库设 **public**，默认分支 **main**。
- ⚠️ **标签必须用专用端点** `PUT /repos/{owner}/{repo}/topics`（body `{"names":[...]}`）。
  主 repo PATCH 里的 `topics` 字段已废弃，会**静默忽略**（本轮已踩坑三次）。
- 注意：topics **上限 20 个**，这个仓库的标签另行规划，别照抄本库清单直接塞满。

### 3.（可选）README 补「skill 即 service」定位语
- 把"一个 skill = 一个可被发现 / 可调用 的服务单元（provider / consumer 抽象）"写进 README 或独立文档，
  呼应微服务思想在 Agent 运行时里的落地。dubbo / tomcat 是 2020 年 K8s 旧物，已删，与此无关。

### 4.（待复核）语言徽章 Java 缓存
- 上一轮已推 `.gitattributes` 触发 GitHub 语言重算；下次上线时确认 **Languages 栏已无 "Java"**
  （应为 JavaScript + Markdown）。若仍在，等后台异步重算，或再推一个无关空 commit 强制刷新。

---

## 已定口径（勿回退）

- 仓库 **公开**、默认分支 **main**。
- **topics 已满 20 个**；以后想加英文标签，须先删旧的。
- **中文检索词走 Description + README**（GitHub topics 不支持中文，实测 422 被拒）。
- **脱敏**：本库不出现 `F:\` 绝对路径、内部判据名（`_管线/...`、`L1-i`、`§2.4.x`）、项目编号（如"第2集 S4"）。
- 本库定位：**代码资产项目**，不是方法论项目；与姊妹仓库 `vibe-world-deduction` 互为"实物 / 方法论"。
