# 网易云音乐联动 0.4

## 0.4.1 下方信息与播放控制

用户已确认“上方气泡，下方信息和上一首/播放暂停/下一首按钮；随信息栏模式一起显示隐藏”。透明窗口增加到 360×480，宠物中心仍位于 y=216，避免最大 192 尺寸与 16 字号四行信息被裁切。鼠标从宠物到按钮有连续保持显示的区域，仅按钮区域额外接收点击，其余透明区域穿透。

媒体命令通过受信任 IPC、动作白名单、单个在途请求和 4 秒超时送到独立原生桥接。原生桥接只选择 CloudMusic/网易云会话，调用 Windows TrySkipPreviousAsync、TryPlayAsync/TryPauseAsync、TrySkipNextAsync；失败显示原因。换歌命令成功时清除手动校准。不会自动发送播放命令。

本轮验证：35 项 Node 单测通过，原生 Release 构建 0 警告/错误；打包版音乐专项 smoke 通过并检查了真实应用截图，包括最大字号/尺寸、四行信息与上方气泡同时显示、hover 路径与退出隐藏，以及三个按钮从 renderer 经 IPC 到 Companion 的调用。控制末端使用 stub，不改变真实歌曲；本轮没有实测切歌或播放控制。新增源码复核无实质问题。整体 smoke 首次因原有 Codex hook 进程启动超时失败，重跑后整体检查与进程重启检查通过，未修改生产 hook 超时。

专项验证命令：`node scripts/smoke.cjs --packaged --music-only`。当前音乐报告/截图位于根目录 `artifacts/`；下述 0.4 完整验证为先前版本的记录。

## 真实播放器验证（2026-10-27）

本机播放器为 `D:\CloudMusic\cloudmusic.exe`，版本 3.1.41.205564。通过 Windows 系统媒体会话读取到了 CloudMusic 来源、歌名、歌手和暂停状态。经用户明确授权，短暂播放当前歌曲约 5 秒后暂停，确认播放状态变化；测试结束已暂停。

该版本在播放期间也没有发布时间轴：位置和总时长均为 0。桌宠将位置表示为不可用，界面明确显示“未提供时间轴”，隐藏百分比进度。辅助界面读取未获得可用进度控件。没有读取账号、客户端缓存或抓取在线歌词。

用户批准了手动校准后备：导入当前歌曲的本地 LRC，输入当前播放时间（秒或分:秒）后同步。界面标记“手动同步”，不表示真实播放器进度；跟随播放/暂停，切歌清空校准。在播放器里跳转后需要重新校准。若播放器以后提供有效的系统时间轴，真实时间轴优先。

## 实现与边界

- 独立 Windows 媒体桥接仅匹配 CloudMusic/网易云来源，每秒读取；关闭联动会停止该桥接进程，失去更新时清空过期状态。
- 播放时使用 humming 动作与音符，暂停时取消；交互、Codex 待处理、高负载与 Codex 工作动作优先。
- 本地 LRC 支持多时间标签、时间偏移、UTF-8/UTF-16LE/GB18030，以及空行清除。输入最大 1MiB，按歌名和歌手绑定；本地库最多 20 首且保存前限制 5MiB，失败保留原库。
- 歌词气泡让位于通知；歌曲提示独立开关，关闭后清除待发提示。待审批通知优先于普通通知并跳过普通冷却时间。
- 音乐 HUD 默认不显示，可在显示设置里勾选。原有字体、鼠标移入/永久显示/永久隐藏、启动设置保留。

## 验证记录

Node 单元测试 32 项通过，包含歌词解析、真实/缺失时间轴、手动校准暂停恢复、切歌隔离、超限保存保护、关闭提示与通知优先级。Windows 桥接 Release 构建 0 警告、0 错误。真实播放器探测与播放/暂停检查见上文。

完整 Electron 打包场景与进程重启检查通过；检查了实际生成的音乐动作/歌词气泡截图和音乐设置面板截图。验证同时覆盖关闭设置面板后仍可读取设置与重新打开面板，修复了原有已销毁窗口访问问题。源码只读复核未发现剩余实质问题。报告为本地 `artifacts/music-report.json`、`artifacts/companion-report.json` 和 `artifacts/smoke-report.json`，截图为 `artifacts/music-pet-preview.png`、`artifacts/music-panel.png`。

音乐场景自动验证使用注入媒体数据和真实本地 LRC 文件，检验动画、音符、导入、校准 IPC、歌词、暂停、切歌和关闭开关；不将模拟进度宣称为网易云真实时间轴。截图只捕获本应用网页。

## 浏览器下载接入方案（下一步，未安装扩展）

Chrome/Edge 可用 Manifest V3 扩展的 `downloads` 权限接入下载任务，通过 Native Messaging 交给本机桌宠。扩展安装与主机注册作为后续明确操作，不在本轮写入浏览器。

`downloads.onCreated/onChanged` 跟踪任务和完成/中断状态；字节进度需对进行中的任务定时 `downloads.search`，不能假定每次字节变化都会触发 onChanged。总大小未知时使用不定进度。桌宠可显示下载动作、已收字节/总量、完成气泡，多任务显示总览并可展开任务。只转发用户需要的任务名、字节数和状态，不转发下载 URL 或网页历史。网卡速度不能代替下载任务进度。

参考官方接口：[Windows 媒体会话](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager?view=winrt-26100)、[Chrome downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads)。
