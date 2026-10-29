# Codex 桌宠助手 0.3 验证记录

2026-10-27，Windows x64，Electron 41.10.6，.NET 10，Codex CLI 0.154.0。

## 已完成

- 官方 Codex App Server 额度读取，显示剩余百分比、窗口和重置时间；60秒刷新，失败显示错误及最后更新时间。
- 官方 hooks 接入工作、等待审批、工具恢复、中断、完成。保留既有 hooks，安装前备份，可撤销。不决定审批，不向其他聊天发送消息。
- 当前用户 ACL 的 Windows 命名管道，按应用路径隔离；测试通道独立。桥接监控父进程退出，避免残留进程截走事件；失效时清除硬件数据并退避重连。
- 物理网卡速率、系统代理、活动 VPN/TUN 网卡。排除 Hyper-V、过滤驱动等重复接口。本机实测物理 WLAN 与 FlClash Meta Tunnel 可识别。
- CPU GetSystemTimes、物理内存 GlobalMemoryStatusEx、GPU Windows PDH 最忙引擎、专用显存已用量，每2秒刷新。缺失指标不显示0。
- 持续高负载8秒进入 humming，极高负载8秒进入 scared；低于75%持续15秒恢复。用户拖动/点击与Codex待审批优先。
- Windows 通知授权入口和经授权的新通知轮询转发；默认关闭，需用户手动启用。不补播已有通知，不上传或保存消息历史。

## 实测证据

- `node --test tests/*.test.cjs`：23/23通过。
- `dotnet build native/BlobPetBridge/BlobPetBridge.csproj -c Release -o .runtime/bridge -p:NuGetAudit=false --no-restore`：0警告、0错误。
- `node scripts/smoke.cjs --packaged`：完整最终EXE验证通过，含第一版互动/漫游/睡眠/位置恢复、第二版实际官方额度RPC、真实系统指标、隔离面板、实际native hook→管道→主进程→中文摘要气泡。
- 高负载动画通过注入模拟99% CPU样本并断言渲染状态scared验证；没有真实压测电脑。
- 关闭后重新创建进程验证位置、大小、身形、颜色、漫游和置顶恢复。
- 只使用应用自身capturePage检查面板，不截取其他应用或桌面内容。
- 独立代码审查发现并修复缺失/混合turn_id与迟到完成事件问题、管道隔离和桥接退出后硬件值失效问题；最终复审未发现新的重要问题。

JSON报告和面板图片由自检写入`artifacts/`（打包自检时位于resources/app/artifacts），整理后保留于项目根artifacts目录。

## 验证边界

0.3增量实测：14/16px字号，六项内容筛选，hover移入移出、永久显示、永久隐藏、全关闭、四种宠物尺寸文字框边界、跨进程恢复HUD设置全部通过。面板与托盘新增开机启动开关，实际读取系统启动项状态并验证无效IPC拒绝；未自动开启启动项，也未重启电脑验证登录启动。启动项适配器单测验证只在用户操作时写入当前EXE路径。

网络恢复诊断中确认代理端口和TUN运行，存在间歇性ECONNRESET/响应体截断；切换两条备用路径未通过完整响应测试，已恢复原手选节点并清理49条陈旧低流量Codex连接。没有改订阅、节点凭据、DNS、MTU或关闭证书验证。公开Codex端点可达不等于认证生成流已彻底稳定，网络根因未最终证实。

没有读取真实Windows通知内容，也没有代用户点击系统授权。仅构建并检查权限状态，状态返回Allowed，但仍保持默认关闭。真实第三方新通知端到端转发需要用户在面板启用后验收；不同Windows应用身份/隐私配置可能影响可用性。

任务事件使用真实原生relay和固定测试事件验证；全局hooks安装后，既有聊天可能需重新打开才能加载。未将当前桌宠注册成Codex内置宠物：它是独立助手，可自行隐藏内置宠物。

原生鼠标拖拽位移、托盘菜单逐项人工验收与实机多屏尚未覆盖，自动检查覆盖拖动事件链和真实窗口漫游。

GPU总体采用最忙引擎口径，不等同于将所有引擎百分比相加；CPU采样口径与任务管理器的处理器性能口径可能有差异。

## 资料

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Windows notification listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener)
- [GetSystemTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getsystemtimes)
- [Windows GPU最忙引擎口径](https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/)
