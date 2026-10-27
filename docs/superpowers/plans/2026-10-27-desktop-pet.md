# Desktop Pet Implementation Plan

> **For agentic workers:** Execute inline using executing-plans. User has requested immediate implementation of the approved first-version scope.

**Goal:** 将现有 SVG 角色变成可运行的 Windows 桌宠。

**Architecture:** Electron 管理窗口、托盘和存储；受限 preload 桥接；pet 页面复用 replica 引擎。纯函数核心处理优先级、休眠及边界。

**Tech Stack:** Electron 41, JavaScript, Node built-in test runner.

**Spec:** ../specs/2026-10-27-desktop-pet-design.md

## Global Constraints

- Windows x64；不修改原角色外观与学习素材声明。
- 不启用开机启动，不联网，不请求全局键盘权限。
- 在用户指定 checkout 新增文件，保留未提交修改供审阅，不推送或发布。

## Task 1: Behavior and persistence

Files: desktop/core.js, desktop/settings.js, tests/core.test.cjs, tests/settings.test.cjs.
Interfaces: PetBrain.interact/tick; clampBounds; SettingsStore.load/save.

- [x] 先测试拖动压过睡眠、互动后恢复、闲置睡眠、关闭漫游、负坐标多屏、配置损坏回退。
- [x] 执行 `node --test tests/*.test.cjs` 观察失败。
- [x] 实现核心和原子设置保存，重新执行测试。

## Task 2: Desktop integration

Files: package.json, desktop/main.cjs, desktop/preload.cjs, pet/index.html, pet/pet.css, pet/pet.js.
Consumes: Task 1 APIs. Produces: npm start, tray/context-menu controls and persisted desktop pet.

- [x] 创建受限 IPC、单实例、透明窗口、托盘、拖动、光标定位及工作区钳制。
- [x] 实现宠物页，绑定抚摸、自主行为、菜单及隐藏降耗。
- [x] 执行真实 Electron smoke，验证渲染、设置保存重开和边界。

## Task 3: Delivery

Files: scripts/package.cjs, Start-Pet.cmd, README.md, docs/desktop-pet-verification.md.

- [x] 创建 Windows 应用目录，保留 Electron 许可证和素材说明。
- [x] 实机运行自动验证与自身页面截图，执行全量单测与语法检查；原生鼠标拖拽和托盘逐项操作的人工验收列入验证边界。
- [x] 整体代码审查，修复问题并记录验证范围与限制。
