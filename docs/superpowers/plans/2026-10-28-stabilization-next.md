# 桌宠稳定化与统一发布 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not delegate without explicit authorization.

**Goal:** 完成窗口布局、下载状态和发布基线的收尾，使下一版可稳定自用。

**Architecture:** 保留 Electron、SVG 宠物引擎和 .NET 本机桥接。将用户放置位置、临时避让位置、卡片可见性及详情展开状态分开管理；下载器统一输出可验证的任务状态；从唯一验证包发布。

**Tech Stack:** Electron 41.10.6、Node.js、JavaScript、.NET 10、Windows MSAA/UI Automation、Chromium Native Messaging。

**Spec:** `docs/next-tasks-2026-10-28.md`，本次用户的项目检查与下一步计划请求。

## 当前证据与约束

- 本次重新运行 78 项单元测试，全部通过；这不等于真实鼠标、多屏或完整打包验收通过。
- 抽查 7 个运行文件：`BlobPet-corner-stage` 与源码一致；`BlobPet-win32-x64` 有 6 个文件不同。未据此推断所有文件完全一致。
- 最近完整打包验收仍有窗口复位、几何断言未收尾；最近卡片补位及原版 dictating 专项通过。执行时先重新定位失败，不放宽断言掩盖问题。
- 网易云当前使用原版循环 dictating；音频峰值采样启动已停用。真实频谱不在本轮范围内。
- 百度网盘公开进度、运行、暂停均有历史实测；完成/中断、混合任务和重启恢复尚需完整验证。迅雷与安装器真实验收不足。
- 保留现有设置、歌词及两个问答入口的独立上下文；不修改账号凭据，不自动发送真实模型请求。
- 本轮计划不实施新功能、不替换运行版本、不清理已有备份；执行时仅处理确认为本项目的进程和路径。

## Task 1 — P0：窗口布局与避让复位

**Files:** `desktop/main.cjs`、`desktop/core.js`、`pet/hud-card.js`、`pet/pet.js`；可新增 `desktop/dock-layout.cjs`；测试 `tests/dock-layout.test.cjs`、`desktop/display-smoke.cjs`、`desktop/assistant-smoke.cjs`。

- [ ] 先重现最后一次完整验收的失败，输出原始放置位置、窗口目标位置、当前边界、工作区、可见性、展开状态和动画阶段。
- [ ] 将“HUD 可见”“系统详情展开”“用户放置坐标”“临时避让坐标”“移动中”拆为明确状态。当前 `hud-card.fit()` 传可见性给名为 expanded 的 IPC 参数，应同步调整接口命名。
- [ ] 抽出布局计算；事件到达只更新目标，不重复启动移动；新拖动取消临时避让并建立新的用户位置。
- [ ] 覆盖四角、快速开关、动画中拖动/移开、音乐和下载卡片出现/消失、字体和尺寸变化；收起后返回同一用户放置位置。
- [ ] 断言采用实际窗口与卡片几何关系及最终收敛状态，不仅靠固定等待时间。原生窗口和渲染器坐标分别记录。

**验收:** 隐藏项不占位；详情和输入框可操作；移动不瞬移、不来回抖动；重启保留放置位置。实际鼠标、Windows 缩放、多屏的未覆盖项保持明确标记。

## Task 2 — P0：统一运行版本、测试隔离与安全发布

**Files:** `scripts/smoke.cjs`、`scripts/release.cjs`、`scripts/package.cjs`、`desktop/main.cjs`、`package.json`、`package-lock.json`、README；新增发布恢复测试。

- [ ] 每次冒烟运行创建独立数据目录，首次与重启阶段使用同一运行编号；不同运行互不共用 settings/cache，退出或超时清理本轮子进程。
- [ ] 统一测试入口，纳入卡片布局专项；保留完整流程与专项的区分，报告注明包路径、版本、构建编号和执行范围。
- [ ] 发布生成文件清单和哈希；确认当前用户数据来源后，固定唯一自用目录。禁止继续让 stage 名称成为长期默认入口。
- [ ] 发布前分别备份程序与用户数据；注入文件占用、验证失败、数据迁移失败和目录切换失败，验证回滚。
- [ ] Task 1 与完整回归通过后再统一版本号、README 和运行入口，并建立可追踪的源码基线；不自动提交现有大量改动。

**验收:** 未验证包不能替换成品；失败不丢设置和歌词；启动入口唯一、可识别当前构建；回滚步骤可实际执行。

## Task 3 — P1：下载生命周期闭环

**Files:** `native/BlobPetBridge/BaiduAccessibleProgress.cs`、`TransferProbe.cs`、`desktop/transfer-core.cjs`、`transfer-monitor.cjs`、`companion.cjs`、`browser/extension/background.js`；测试 `tests/transfer.test.cjs` 与适配器专项。

- [ ] 百度网盘读取结果只保留任务数量、公开百分比、明确状态和速度是否为零；界面无关文本不参与暂停判断。
- [ ] 验证运行→暂停→恢复，增加混合任务、0 速度但未暂停、切换页面、最小化、退出、桥接超时和重启场景。
- [ ] 明确区分暂停、等待、未知和失联；记录每来源最近成功观察时间。超时后停止使用过期的 active 状态驱动动作。
- [ ] 同时有多个任务时选取动画依据明确；暂停或过期的任务释放优先级，恢复后重新接入。
- [ ] 浏览器扩展验收真实开始、进度、暂停、恢复、完成、中断和重连；迅雷、安装器分别取得真实证据后再标记支持状态。

**验收:** 每次状态变更都能解释来源；未知不会被当完成；完成/失败提示不重复；下载暂停后音乐或空闲可接替。

## Task 4 — P1：设置与动作决策整合

**Files:** `desktop/core.js`、`desktop/action-catalog.cjs`、`desktop/main.cjs`、`pet/panel.html`、`panel.js`、`pet.js`；测试 settings/activity/layout。

- [ ] 整理“服务启用”“卡片显示”“收起概览指标”三层设置，减少音乐信息的重复开关造成的歧义。
- [ ] 设置预览与实际显示一致，隐藏后无父容器空位；隐藏工具栏仍有清晰的右键恢复入口。
- [ ] 核对动作优先级：交互/问答/Codex → 有效活动下载 → 音乐 → 空闲时负载；预览和通知按现有约定单独验证。
- [ ] 移除或明确隔离已停用的音量采样接口及未加载的 quick-react/shader 产物，先核对引用再清理依赖。

**验收:** 无无效开关、无隐藏服务误停；音乐仍为用户已选择的原版循环 dictating。

## Task 5 — P2：开源准备与可选增强

**Files:** README、第三方许可清单、打包过滤规则、贡献文档与示例配置。

- [ ] 核对角色几何、商标、原始提取内容及 UI 组件的授权；将可发布的新增代码与待替换素材标清。
- [ ] 排除 data、歌词、聊天内容、浏览器桥接登记文件、构建备份和本机路径；提供全新机器的构建和运行说明。
- [ ] 基线稳定后再评估真实频谱（逐频段音频数据）、专注计时器、下载任务列表等增强，每项另立方案和性能验收。

**验收:** 干净目录能构建；拟公开文件经过内容与许可检查，尚未自动发布。

## 推荐执行顺序与命令

执行顺序：Task 1 → Task 2 → Task 3 → Task 4 → Task 5。每项完成后更新证据，而非只勾选“已有代码”。

基础检查：`node --test tests/*.test.cjs`。
桥接构建：`dotnet build native/BlobPetBridge/BlobPetBridge.csproj -c Release -o .runtime/bridge -p:NuGetAudit=false --ignore-failed-sources`。
交互回归：Task 2 完成独立测试目录后运行 `node scripts/smoke.cjs`；使用独立 `BLOBPET_PACKAGE_OUTPUT` 执行打包回归，避免覆盖用户当前版本。
