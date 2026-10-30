# GrokPet 工作伙伴里程碑 · 阶段 0 审计

审计日期：2026-10-29。依据本地工作树，不把计划书中的 GitHub 快照当成当前实现。当前 package.json 为 0.8.0；“工作伙伴 v0.3”是产品里程碑，不回退版本号。

## 工作区结论

- 本地分支 dev，HEAD 0ca4e3e；本次检查时与本地 origin/dev 同提交。未 fetch，不能据此断言远端此刻没有更新。
- origin 为 IHaveNoName-pixel/GrokPet，upstream 为 blessonism/grok-icon-study。
- 工作树已有 UIArc、环绕面板和验证文档等未提交修改及文件删除。保留现状，不执行 npm ci、强制合并、reset、clean 或自动提交/推送。计划中“干净工作区后建分支”的前提不成立。后续功能开发从当前已核对内容增量进行，不能直接切换 origin/dev 丢掉本地成果。
- 未发现适用的 AGENTS.md，本阶段已添加项目开发约定。

## 功能矩阵

| 能力 | 当前结论与依据 | 下一步 |
| --- | --- | --- |
| Codex 额度 | Companion.refresh → CodexClient.readLimits → quotas；已有失败状态 | 复用 |
| Hooks 阶段动作 | native HookEvent / Program → Companion.receive → Activity → main.tick / selectAnimation | 扩展事件与项目身份，保留原监听器 |
| 事件去重与过期 | Activity 按 session/turn/tool 去重、30 分钟活动过期；NoticeQueue 有界队列与 ID 去重 | 缺跨来源规范、事件时间乱序及每项目状态视图 |
| 完成语义 | Stop 目前产生“任务已完成”，并默认 proud / celebrate；测试也锁定此行为 | 优先拆分 turn.completed 与 task.verified，未知不庆祝 |
| 只读问答 | 两个 Assistant 实例隔离快捷和完整窗口；owner/request/turn 校验；Codex read-only/never，禁用外部工具并检查清单 | 复用会话隔离；项目列表独立于问答参考目录 |
| API 文本聊天 | ApiStore 多配置、safeStorage 密钥、流式响应、停止与上限；仅 chat/completions 文本 | 后续单独声明视觉能力；当前不发送图片 |
| 回复查看/复制 | ReplyArchive 按 scope/request 保存内存内的成功回复 | 不是长期项目记忆，不能挪作自动保存聊天 |
| 本地操作 | parseCommand → createCommandExecutor；SystemCommands/LaunchStore 白名单 | 工作 UI 继续调用同一执行器，不让模型编造启动目标 |
| 提醒/专注 | ReminderStore、FocusTimer 持久化、到期确认、重启恢复；NoticeQueue 专注期仅放行 urgent | 接入工作事件，保留去重和暂停规则 |
| 指标/媒体/下载 | Windows bridge / MusicClock / TransferTracker；一分钟 MetricHistory | 复用；模拟检查不替代各真实来源验收 |
| 养成 | PetLife、personality/wellbeing 设置及保存 | 不是跨项目记忆或模型人格系统 |
| M3 语音 | 默认 Windows 本地 STT/TTS、可选独立 API、显式录音/取消/确认文本 | 真实麦克风验收由用户暂缓，不能标为通过 |
| Windows 通知 | 单独授权入口，桥接新通知进 NoticeQueue | 第三方通知真实端到端仍待验收 |
| Git 状态 | 未发现登记项目后的只读 git status 监测模块 | 新增有界 execFile、超时、项目路径校验与 clean/dirty/conflict/unavailable |
| VS Code | 无 VS Code 扩展或状态接入；已有 browser/extension 是下载扩展 | 新增独立轻量扩展与鉴权本机协议，不传源码 |
| 长期项目记忆 | 无 MemoryService/项目记忆 CRUD；设置和回复归档不能等同此能力 | 本地 JSON、用户确认、项目隔离、保留策略及损坏备份 |
| 桌面截图问答 | 无 desktopCapturer/视觉模型发送流程；capturePage 只用于测试截图 | 显式授权 → 来源选择 → 预览 → 确认后发送，默认不落盘 |
| 工作伙伴 UI | 无项目列表、统一工作事件视图和记忆管理 | 复用当前 UIArc 控件和现有卡片，不重写 SVG 引擎 |

## 调用链与集成位置

### Hooks 与动画

用户点击安装 Hooks → hook-config.installHooks 合并 hooks.json 并备份原文件 → 桥接 hook Relay → 带用户 SID 和项目 channel 的 CurrentUserOnly 命名管道 → metrics 进程输出 JSON 行 → Companion.receive(kind=codex) → Activity.event → activity.state → main.tick → selectAnimation → pet:state → pet/pet.js → replica SVG。

HookEvent 当前保留 session、turn、toolId、phase、failed、message；未保留 cwd/projectId，工作项目识别需扩展规范化层。不要创建第二个管道服务或 Codex 监听进程。

### 通知与效率工具

Companion 接收系统/媒体/下载与提醒事件 → NoticeQueue.push（清洗文本、ID 去重、最多 20 条、urgent 优先）→ main.tick / nextNotice → pet:notice 气泡。专注中的普通通知暂缓，结束合并；FocusTimer 和 ReminderStore 沿用 dataDir。

### 问答与执行

输入 → main assistant-action → 先尝试 localCommand → createCommandExecutor → 白名单系统/提醒/专注/媒体；无明确命令再进入所选 Assistant（Codex 或 ApiClient）。两个入口使用不同实例、scope/request 回复归档；关闭完整问答仅取消 window owner。

API 模型当前不会自动读取项目文件。新记忆注入必须单独选择范围并预览；不能把原参考项目路径和新项目工作区身份混为一谈。

### IPC、存储与清理

preload 只公开命名方法；main.trustedSender 检查已创建窗口，重要写操作还限定设置/问答窗口。sandbox/contextIsolation 开启、禁用 Node、拒绝页面导航和新窗。环绕画布提交仅允许主宠物窗口、匹配当前准备 ID，并使用主进程预先计算的 bounds，渲染层不能传任意窗口尺寸。

SettingsStore 使用 tmp + rename，损坏 JSON 备份 .broken。API/语音密钥经 safeStorage；public() 不返回密钥。新 MemoryStore 可复用这些写入约定，不能复用凭据对象。

before-quit → 取消语音、注销快捷键、关闭环绕、Companion.stop、两个 Assistant.stop、停止 ticker、保存设置。Companion.stop 清理指标/媒体/通知/下载探测子进程和重启定时器。新 watcher 必须加入同一生命周期。

## 分阶段执行顺序

1. **阶段 0（本报告）**：审计、矩阵、调用链、开发约定、测试基准；不新增业务权限。
2. **阶段 1**：WorkEvent 校验与 source/project/session/type/status/timestamp；有界去重和每会话序列/过期规则；适配现有 Hooks 与 Activity，先纠正 Stop 语义。等待审批/错误优先级继续流入现有调度，禁止第二套状态机。测试重复、旧 turn、乱序、重连、取消、过期和未知。
3. **阶段 2A**：显式登记项目，fs.realpath 校验目录；git -C 使用 execFile 参数数组、超时与 maxBuffer；status porcelain -z、branch 与最近提交。非 Git/被移除目录降级 unavailable，不推测 clean。UI 先提供项目选择和状态。
4. **阶段 2B**：VS Code workspace/session 唯一身份、摘要诊断、调试状态、心跳过期与断线；鉴权本机通道，默认不含源代码。无扩展零依赖运行。与浏览器下载扩展隔离。
5. **阶段 3**：全局/项目记忆 CRUD、关键词查询、保留期限、损坏备份、清除；仅主动保存，发送前预览勾选，删除后不再检索。
6. **阶段 4**：视觉后端能力设置 + 单次截图授权/预览/取消；当前 ApiClient 是文本协议，不应先发图片再猜兼容。
7. **阶段 5/6**：按阶段添加工作卡片/事件/隐私 UI，并完成源码、暂存打包、退出清理、性能和真实 Windows 验收；最后使用 release 切换并保留 data。

计划书中的“每阶段提交”不覆盖用户现有脏工作树；本阶段不自动混合提交。全部任务按验收阶段推进，不一次性改写所有业务模块。

## 测试基准与限制

- 当前 npm test：122 项通过；git diff --check 无空白错误（仅既有换行格式提示）。执行结果见 artifacts/work-v03-audit-tests.log。
- 完整暂存打包 smoke 与进程重启通过，含实际额度/系统指标读取、模拟 hooks/媒体和问答 UI 检查；这不证明真实用户录音或第三方通知验收。日志见 artifacts/motion-package-smoke.log。
- 本轮动画专项：radial-motion-smoke 检查首帧卡片/宠物重合、展开和收起中间帧、非法几何提交拒绝；corner-motion-smoke 检查四角屏幕像素连续与中断清理；system-orbit-smoke、ui-controls-smoke 通过。
- 打包版动画专项和程序文件匹配另见 docs/radial-origin-motion-fix-2026-10-29.md。
- 本阶段未执行真实录音、系统开关、第三方下载或截图上传；真实第二显示器/系统 DPI/第三方通知验收仍待设备验证。
- 阶段 0 是已完成的审计交付，不代表六个阶段的业务功能已经实现。

## 阶段进度

阶段 1 的实现、状态语义及本轮验证见 [工作事件中心交付记录](work-stage1-verification.md)。新增 Git/VS Code、长期记忆和截图问答仍是后续阶段。

阶段 2A 已实现 Git 项目登记与只读状态监测，见 [交付记录](work-stage2a-verification.md)。阶段 2B VS Code 为下一阶段。

2026-10-30 最新检查与下一轮执行顺序见 [下一阶段开发清单](next-stage-plan-2026-10-30.md)：先补通知投递完整性与工作卡片，再实施阶段 2B。
