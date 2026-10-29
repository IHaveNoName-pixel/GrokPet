# 0.6 输入、状态收起与动作（2026-10-28）

## 已交付

HUD将用户选项和实际数据有效性结合：无网易云会话整行收起；未启用VPN/代理不占位；额度或硬件数据不可用收起。有效零值保留。下方“问一问”按钮不依赖音乐运行，使用原显示模式；永久隐藏时仍可由托盘打开。

独立输入窗口支持Codex只读问答和浏览器搜索二选一、流式纯文本回复、停止、新会话、参考项目目录选择与清除。切换项目重置会话；关闭输入窗口停止进行中的回复，空闲会话在本次进程中保留。窗口重开可继续；桌宠重启后不恢复输入历史。

搜索支持Bing、Google、百度及HTTPS `{query}` 模板。只在发送时打开系统浏览器，文本URI编码，拒绝javascript/file协议与URL账号字段。搜索不调用Codex。配置保存在原settings.json。

## 只读边界

问答使用独立官方CLI App Server连接和当前默认模型，按用户选择只做问答。先读取本机配置元数据，随后在问答工作连接的进程启动覆盖和thread配置中关闭MCP、插件、apps，不写全局Codex配置。首次配置元数据连接不创建thread或模型回合；不据此宣称从未加载插件元数据。模型回合前分页检查该thread外部工具runtimeStatus全部disabled，否则拒绝发送。

thread/start固定sandbox=read-only、approvalPolicy=never；turn/start再次固定readOnly且networkAccess=false。拒绝所有服务端工具、权限及交互请求。JSON-RPC先按method区分双向请求/通知，再匹配响应ID，防止撞号。已取消turn的迟到事件被忽略，取消确认前不接受下一问题；断线/失败停止工作连接，防止遗留生成。

桌宠自身不存消息文件，Codex可能按自己的配置保存历史；当前用户发出的问题和参考项目内容用于其Codex账户问答，发送消耗正常额度。没有自动提问、共享其他聊天、读取浏览器历史或更改全局插件设置。

## 动作

真实事件：输入listening、连接loading、提交sending、流式接收receiving，既有Codex工具thinking/searching/writing等继续保留；音乐dictating+音符、消息notifying/Windows新通知surprised、出现spawning、退出powering-down、媒体控制错误confused、抚摸angry彩蛋。高负载仍只在idle。

39状态限时预览可取消。预览期间推迟自主动作调度，仍允许真实交互；没有真实下载/上传/语音/备份/计时来源的状态仅是预览。进度动画仍是循环特效，不冒充百分比。

## 验证

- Node48项测试通过；包括有效HUD/零值、HTTPS模板、只读策略、外部工具未关闭时拒绝发送、流式线程隔离、取消竞态、双向RPC撞号和预览自主调度保护。
- 原生hooks十组归一化验证通过，原有Native代码本轮未改。
- 真实默认模型两轮问答通过：普通回复、同一会话追问读取选定参考项目fixture.txt；文件内容未变化。没有用模型制造修改或失败。报告：`artifacts/assistant-live-report.json`。
- 打包完整smoke与进程重启通过。输入窗口实际IPC、流式纯文本/XSS字符串、搜索分流、URL拒绝、39预览、关闭窗口后宠物IPC、无效状态隐藏/零值保留均通过。UI服务和浏览器打开器使用stub，不额外请求模型或打开测试网页。报告：`artifacts/assistant-ui-report.json`。
- 检查了实际页面截图`artifacts/assistant-chat.png`。独立源码复核发现的RPC和预览问题已修复并通过回归复核。

手动验证：`node scripts/smoke.cjs --packaged --assistant-only`；真实问答测试需显式`node scripts/verify-assistant.cjs --live`（会发出两条问题）。

协议参考：[官方 App Server](https://learn.chatgpt.com/docs/app-server)。本机安装版本的JSON Schema另在`.runtime/chat-schema`核对，不仅依赖线上示例。
