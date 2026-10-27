# Codex 桌宠助手第二版

用户已通过范围确认：独立桌宠助手，显示 Codex 额度/任务状态、上传下载速度和 VPN/代理状态；任务完成/需要处理时气泡；Windows 通知单独授权接入。不修改 Codex 程序内部文件，不控制 VPN。

## 数据与边界

- 额度通过官方 `codex app-server --stdio` 的 initialize + account/rateLimits/read，每 60 秒刷新。沿用 Codex 登录态，不读取或保存令牌；缺失/超时明确显示未知/上次更新时间。
- 生命周期使用 Codex 官方 hooks：UserPromptSubmit、PermissionRequest、Stop、Interrupt。合并用户 hooks.json 并备份，只增加本应用标记的 hooks。仅传事件、session/turn ID、完成摘要，不传工具输入/完整会话。hook 始终不决定审批，输出空 JSON。
- .NET Windows helper 读取网卡字节累计值、系统代理和 VPN/TUN 网卡状态。网速以物理网卡为主，排除 TUN/Hyper-V 等虚拟口，避免双计数。VPN 与系统代理分别显示，不宣称互联网可达。
- Windows UserNotificationListener：先检查权限，用户点击“授权 Windows 通知”才请求；仅转发授权后新到达的通知，已有通知不补播；不读通知数据库，不上传消息。权限撤销停止读取。
- 通知队列串行显示、重复去重、长度截断。Codex 完成/待处理状态优先于日常动作，拖动优先于工作状态。暂停不主动播放消息。隐藏不强制弹出。

## 界面

桌宠下方显示紧凑状态行；双击或右键“状态面板”打开额度、网速、VPN 和通知授权面板。额度区显示各窗口剩余百分比和重置时间；详细内容在独立面板，避免透明桌宠窗口变大挡操作。

## 验收

用户追加范围：CPU、物理内存、GPU 最忙引擎和专用显存使用量。系统原生 API 每 2 秒采样；CPU ≥85%、GPU/内存 ≥90% 持续 8 秒进入忙碌动画，任一指标 ≥97% 持续 8 秒进入紧张动画；全部已知指标低于75%持续15秒恢复。缺失值显示不可用。拖动/点击反馈与 Codex 审批提醒优先。

Node 测试覆盖额度缺失/多桶、流量重置/热插拔、事件去重/状态优先级、hook 合并幂等和不干预审批。实际官方接口额度读取、Windows helper 构建/指标探测、Electron 面板与气泡自动检查、打包重启。Windows 授权必须由用户在系统界面完成；未授权不得声称消息端到端通过。

参考： https://learn.chatgpt.com/docs/app-server 、https://learn.chatgpt.com/docs/hooks 、https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener
