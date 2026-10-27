# Grok Bot 角色复刻（仅供学习参考）

> 素材归 xAI / 相应权利人所有。  
> 本仓库仅供学习参考，请勿商用或再分发。

这是对 **Grok Bot.app v0.18.0** 登录页角色动效的学习复刻，用于研究状态机、弹簧动画、多边形眼睛等实现。

## 打开

浏览器打开 [`replica/index.html`](./replica/index.html)。

## Windows 桌宠第一版

### 0.2 · Codex 与系统状态

新增 Codex 额度（每 60 秒刷新）、工作/待审批/完成气泡、实时上传下载、系统代理与 VPN/TUN 状态、CPU/物理内存/GPU 最忙引擎使用率及专用显存已用量。双击桌宠或右键选择“Codex 与网络状态”打开详情面板。

持续高负载 8 秒触发忙碌动画，极高负载触发紧张动画；回落后保持 15 秒再恢复，避免尖峰频繁切换。CPU 高阈值为85%，内存/GPU为90%，极高阈值为97%。不支持或失效的计数器显示不可用。

额度通过已登录的官方 Codex CLI App Server 查询，不发起模型生成；桌宠不直接读取或保存登录令牌。接入任务事件可在面板点击“接入 Codex 工作状态”，或运行 `node scripts/install-codex-hooks.cjs`。它会合并 `~/.codex/hooks.json`，保留原 hooks 并在修改前备份；新聊天或重新打开 Codex 后生效。退出桌宠时 hooks 不会阻塞 Codex，不会自动批准请求。移除接入：`node scripts/uninstall-codex-hooks.cjs`，仅移除本应用标记的处理器。

Windows 其他应用通知需在面板点击“启用 Windows 通知”。首次可能出现本机说明窗口，请自行请求系统权限；已允许时会直接开始读取。仅转发新到达的系统通知，未发出系统通知的应用内消息无法读取。默认不启用、每次启动需手动开启，不上传、不保存通知历史。权限/系统不支持时显示错误；某些系统可能需要有应用标识的安装包。当前尚未完成真实第三方通知端到端验收。

系统指标桥接使用 .NET 10 Windows Desktop Runtime；本机已安装。源码构建桥接：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-bridge.ps1`，再执行 `npm run package`。网速只统计物理网卡，排除 TUN、Hyper-V、过滤驱动，VPN/TUN 状态不代表外网可达，不提供 VPN 开关。

实现与验证见 [第二版验证记录](docs/codex-companion-verification.md)。

本地自用的桌宠入口与原演示页独立，原角色引擎保持不变。

- 已打包时：双击 `dist/BlobPet-win32-x64/BlobPet.exe`，或根目录 `Start-Pet.cmd`。
- 源码运行：安装 Node.js 后执行 `npm install`、`npm start`。本机也可使用 `.runtime/electron` 下的缓存运行包。
- 单测：`npm test`；真实 Electron 冒烟：`npm run smoke`；打包：`npm run package`。

点击角色可以抚摸；按住角色拖动移动；右键角色或系统托盘图标打开设置。托盘双击显示桌宠。菜单包含暂停、隐藏、叫醒、漫游、置顶、气泡、大小、颜色、身形、位置恢复和退出。

无人互动约 60 秒开始犯困、90 秒睡眠，点击可叫醒。漫游仅在清醒空闲时发生，范围约为放置位置左右各 100 DIP；指针靠近时停步，便于点击。没有开机启动或全局键盘监听。

打包版设置保存在 EXE 同目录 `data/settings.json`，移动应用时请保留整个文件夹。开发版保存在 `.runtime/user-data/settings.json`，冒烟使用独立 `artifacts/smoke-data`。隐藏或暂停会停止角色动画；关闭窗口收至托盘，使用菜单“退出桌宠”完全结束。

打包输出是包含 Electron 运行时的应用文件夹，`BlobPet.exe` 需要同目录 DLL 和 resources，不能单独搬走。程序使用 Electron 的可执行文件，首版尚未定制 EXE 图标和数字签名。

后续开源学习前，应确认提取代码与角色素材的许可，并用原创素材替换需要替换的内容；本次新增桌宠功能不改变下方原素材声明。

登录页原参数：`sizePx: 64`、`color: "black"`、`shape: "blob"`。  
`pjn(n) = n%2===0 ? idle : cSe[(n-1)/2]`，间隔 `1200ms`。  
playground 有意从 curious 起播；点「登录轮换」才按 `pjn(0)=idle` 重来。大预览默认开指针跟随，源码默认关。

## 项目结构

| 路径 | 内容 |
|---|---|
| `replica/index.html` | L1 舞台 |
| `replica/src/` | 拆开的引擎：character / pose / tricks / eyes / fx / math / tables |
| `replica/geometry-data.js` | `u3` 25 眼、`Jo` 18 身形、`snt` 11 色 |
| `replica/grok-blob-idle.svg` | 静态 blob + idle `u3[0]` |
| `extracted/` | 从主包抽出的学习参考片段 |
| `extract-asar.js` | 解包辅助脚本（按需使用） |
| `assets/icon.iconset/`、`assets/app-icon-256.png` | Dock / 应用内静态商标（不是角色引擎） |

## 免责声明

- 本仓库仅用于学习参考。
- 所有角色造型、商标、图标、几何数据及从应用包中提取的内容，均归 xAI / 相应权利人所有。
- 请勿用于商业用途，请勿再分发。
- 请勿将本仓库内容当作自己的商标或原创素材发布。
