# GrokPet 文档入口

当前功能说明以 2026-10-30 核对版为准：

- [使用说明](USER_GUIDE.md)：启动、快捷卡片、聊天/API、本地指令、提醒/专注、设备、下载、剪切板及排错。
- [VS Code 配对步骤](USER_GUIDE.md#9-vs-code-配对配对文件怎么用)：安装 VSIX、生成和导入一次性配对文件、检查连接。
- [开发文档](DEVELOPMENT.md)：架构、模块职责、数据/安全、构建、测试、发布和后续边界。
- [项目开发约定](../AGENTS.md)：开发时须遵守的工作区与安全规则。

## 实现及验收记录

这些文件保留各阶段的事实，较早记录中的“尚未实现”“下一阶段”不一定代表当前状态。

| 主题 | 记录 |
| --- | --- |
| 性能测量、优化与边界 | [性能记录](performance-2026-10-30.md) |
| 当前卡片/剪切板/通知/VS Code 和鼠标修正 | [交付记录](dock-clipboard-work-verification-2026-10-30.md) |
| 环绕设备与系统详情 | [同窗口环绕](integrated-radial-verification.md) |
| 本地 Windows 命令 | [M2](m2-windows-commands.md) |
| 语音及真实设备待验收 | [M3](m3-voice-verification.md) |
| 场景与提醒 | [场景记录](scenes-verification.md) |
| 工作事件与结果语义 | [工作中心](work-stage1-verification.md) |
| Git 只读监测与安装器限制 | [阶段 2A](work-stage2a-verification.md) |
| 长回答/历史与待办滑动 | [聊天历史](chat-history-and-swipes-2026-10-30.md) |
| 后续阶段规划及进度补记 | [下一阶段清单](next-stage-plan-2026-10-30.md)、[工作伙伴方案](work-companion-v03.md) |

素材与第三方许可仍以 [README](../README.md) 和 `third-party/` 为准；新增文档不改变素材的再分发边界。
