# 工作伙伴阶段 1：统一工作事件中心

日期：2026-10-29。基于 docs/work-companion-v03.md 的阶段 0 设计增量实现；未改写 SVG 引擎，未新增 Codex 监听进程，未安装/修改全局 Hooks、登录或发送真实模型问题。

## 当前交付

- desktop/work/work-events.cjs：WorkStatus、来源/类型/身份/时间/序列校验、文本长度与元数据白名单、项目路径哈希。Windows 目录大小写/分隔符归一；POSIX 目录保留大小写。不读取项目文件。
- desktop/work/codex-adapter.cjs：适配现有六类 Hooks，补齐 legacy 合成轮次，允许后续显式轮次绑定；拒绝事件不会改变适配器的当前轮次。
- desktop/work/work-controller.cjs：复用传入的 Activity；按 source/project/session/turn 隔离，处理去重、旧轮次、已完成工具、过期、断线、取消和显式验收。最多 100 会话、200 条内存事件、1000 条去重/终态/工具记录；窗口关闭退出清空。
- native/BlobPetBridge/HookEvent.cs：既有 hook Relay 增加 ID、桥接接收时间和 cwd；命名管道及当前用户 ACL 沿用原实现。工作中心只保留路径哈希，摘要与事件列表不含路径全文/工具参数/回复正文。
- Companion.receive → work.receiveCodex → 原 Activity → main.tick/selectAnimation。NoticeQueue 继续统一提示，过期或已失效的工作提醒在弹出前移除。
- 设置页新增“工作”分类、接收开关、连接/会话摘要与最近事件；仅设置窗口可提交 boolean 开关。关闭清空工作状态与排队提示，不卸载 Hooks，也不停止系统指标/媒体等已有服务。

## 状态语义

普通 Stop = turn.completed / idle：标题为“本轮对话已结束（任务结果未验收）”，不触发任务成功庆祝。明确工具失败仍 confused，未解决失败结束保留 sad；Interrupt = cancelled，断线/超时 = unknown，不伪造任务完成。

仅 type=task.verified、status=succeeded/failed、metadata.verification=explicit 且有 evidence 的可信内部事件允许触发验收反应；同一轮验收只接受一次。没有将此发布入口暴露给 preload/模型/命名管道原始消息，不能凭模型文本或任意 hook 字段伪造验收。当前尚未接入自动测试结果判定器。

优先级仍由 Activity/selectAnimation 决定：待审批先于明确错误/普通工作；用户交互、语音、音乐、负载沿用原入口。成功反应不盖过另一项正在执行的工作。独立问答的流式 busy/回复交付状态继续由 Assistant 管理；本阶段不重复订阅其 App Server，以免与现有 Hooks 重复。

## 兼容性和边界

- 缺少 cwd 的旧桥接消息进入 unassigned 项目，不猜测其属于另一个项目。不同项目的相同 session/turn/事件 ID 不串联。新桥接传递 cwd 后，同一路径会得到稳定哈希；正式项目登记/显示名称留给阶段 2A。
- 有来源时间或 sequence 时拒绝旧值；曾被新轮次替代的旧轮次也不能凭较新的到达时间复活。来源未提供原始时间时采用桥接接收时间，不能推断从未观察过的事件的真实生成顺序；缺少原始轮次/事件 ID 的旧协议只能就近推断，无法提供完整乱序保证。
- 活动超过 30 分钟没有新事件转 unknown。重连只恢复连接标志，等待新工作事件才恢复工作状态；已明确的验收结果不会因断线被改写。
- 本阶段事件/会话历史不写磁盘，不是长期记忆；仅工作开关保存在原 settings.json。重启重新等待真实事件。

## 验证方法与证据

- tests/work-events.test.cjs、work-controller.test.cjs：来源/身份/时间校验、只显式验收成功、重复/乱序/旧轮次/并行工具、legacy 转换、断线恢复、取消、过期、失效提醒、容量、项目隔离及关闭。新增测试先复现缺失或错误行为后修复。
- desktop/work-stage1-smoke.cjs：经现有 Windows 命名管道实际运行桥接与测试 Hooks，验证阶段映射、cwd 哈希、普通 Stop 不庆祝、重复消息、设置/非法 IPC、重连与拥有的原生/Codex 子进程退出；成功验收使用明确标记的内部夹具，未声称真实开发任务通过验收。
- UI 截图 artifacts/work-stage1-panel.png；单元日志 artifacts/work-stage1-tests.log。
- .NET 桥接构建为零错误、零警告。完整暂存打包和运行验证结果在本轮完成后追加。

## 待验收与下一阶段

真实用户任务跨多个 Codex 会话、真实多屏/DPI、麦克风与第三方通知不由上述夹具证明。下一阶段为 Git 项目登记和只读 clean/dirty/conflict/unavailable 监测；不在本阶段新增 VS Code 扩展、记忆或截图权限。

工作区保留此前 UI/动画未提交修改，未自动混合提交、强制切分支或推送。

## 本轮阶段交付结果

- 阶段 0 的已有能力矩阵仍适用：复用 Hooks、指标、通知、问答、语音和动画，只新增统一事件校验/汇总与设置视图。
- 原生桥接已构建，零错误/零警告；现有全局 Hooks 只做只读核对，六类宠物处理器都指向当前正式运行实例的 channel，未更改配置。
- 完整暂存打包 smoke 与进程重启通过，日志 artifacts/work-stage1-packaged-smoke.log。其中旧动画夹具已改为显式验收后才测试 proud/celebrate，普通 Stop 在临界负载下让出动作，验证新语义与既有优先级。
- 退出时出现既有 Chromium GPU command-buffer 警告，未使测试或重启失败，保留原日志。
- 仍待真实用户跨项目工作及多屏/DPI 验收。下一阶段可直接依赖 WorkEvent/WorkController 和原 settings/dataDir 接入 Git 只读状态，不需要再次重建 Codex 事件链。

## 正式运行版更新（2026-10-30）

- 最终 npm test：148 项通过；git diff --check 无空白错误。
- 暂存打包版工作中心、环绕时序、UIArc 控件专项通过；日志 artifacts/stage1-packaged-work-stage1-smoke.log、stage1-packaged-radial-motion-smoke.log、stage1-packaged-arc-smoke.log。
- 正式目录 dist/BlobPet-win32-x64 已更新并重启，14 个程序文件和 7 个桥接文件 SHA256 与已验证暂存包一致。
- 回滚程序备份：artifacts/work-stage1-backup-20261030-001141；data 目录未替换，全局 Hooks 未改动。
