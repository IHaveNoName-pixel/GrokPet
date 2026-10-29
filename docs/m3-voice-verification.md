# 对话框与 M3 按键语音（2026-10-29）

## 当前实现

- 对话框在快捷区顶部保持输入形态；统一主列宽度，环绕快捷控制按钮占右侧独立列。模式选择采用通用“智能对话”，显示当前后端或模型。发送、停止生成、重显、复制、完整回答仍绑定原有回合与入口。
- 默认文字后端为 Codex；Windows 本地 STT/TTS 无需 API 密钥。先录音，再校对文字、点击发送；命令沿用 M2 执行器，不让识别或模型绕过白名单。浏览器搜索仍显式打开搜索结果。
- 默认系统识别器优先中文；固定常用命令语法与自由听写并存。录音先在浏览器内存中转为 16kHz 单声道 PCM WAV，再交给 Windows System.Speech。音频与文本通过固定 PowerShell 脚本的标准输入交换，不拼接命令，不持久保存录音，不启用 SAPI 麦克风输入。PowerShell 窗口隐藏，取消会结束子进程。
- 录音仅在点击按钮或配置快捷键时开始；最多 60 秒，设备请求 15 秒、服务处理 45 秒超时。结束录音后立即释放设备；取消或晚到响应不会填入新一轮输入。隐藏、休眠、退出时释放录音并取消服务。
- TTS 返回 WAV 在桌宠播放；API 模式返回 MP3。新录音会停止合成或播放；可手动停止。播报最多 600 字，跳过代码、URL 与 Markdown 控制符；自动播报默认关闭。麦克风、录音、识别、生成、播报有对应状态与动画。
- 可选 OpenAI 兼容音频 API：STT/TTS 分别配置后端、地址、模型及密钥，TTS 另有音色；与聊天配置分开。密钥通过 Electron safeStorage 加密，不返回渲染进程；HTTPS（本机回环可 HTTP）、拒绝重定向、体积限制、超时与取消。未知服务错误不回显服务响应正文。

## 已验证

- 122 项单元测试通过。新增覆盖空识别、HTTP 失败、超时、取消、晚到结果、连续开始、旧录音 stop 事件、长回答过滤、设备拒绝、录音时限、WAV 格式，以及默认本地后端不调用 HTTP。
- 默认 GPU 的模拟服务端到端：虚拟麦克风录音→释放设备→识别文字留在草稿→显式发送创建提醒；普通 API 聊天完成后自动播报；取消录音与取消合成。未调用计费接口。
- 本地真实 System.Speech 合成音频→浏览器 16kHz WAV 重采样→中文引擎识别，样例结果为“十分钟后提醒我喝水”。这属于合成音频验证，不是真实麦克风识别。
- Chromium 点击事件命中麦克风，原生可点击区域覆盖按钮；虚拟设备开始与取消后流为 null。对话框与场景卡片的 x/width 相同，快捷按钮在独立列，失焦后保留输入框。
- 卡片节点持续刷新、趋势曲线、分页、关闭中重开及四角避让回归通过。

- 实际 Codex 登录的只读文本通道返回“语音对话连接成功。”，Windows 本地 TTS 生成 RIFF/WAV 117508 字节；此检查未播放音频，不能作为扬声器听感验收。
- 最终运行包本地语音专项、系统环绕专项与四角动画专项均退出码 0；正式程序持续运行。默认配置已确认 Codex / Windows STT / Windows TTS，自动播报关闭。更新前备份位于 `artifacts/local-voice-backup-20261029-162627`，既有 API 配置保留。

## 待真实设备验收

使用者本次表示暂时不方便测试，保留为待验收项，不启动真实麦克风。

使用者实际麦克风说“十分钟后提醒我喝水”，校对后发送；普通 Codex 对话回复并播报；录音取消；播报中再次录音。需检查准确度和听感，不能用合成录音、虚拟麦克风或成功生成 WAV 代替此验收。实际多屏与混合 DPI 也未完成设备验收。

Windows 本地识别的准确度取决于系统引擎与输入音质，所有识别文本都需要确认；音频文件测试不保证真实口音、噪声环境下准确。系统缺少语音组件时显示原因并继续文字输入。Codex 实时语音的本机协议处于实验接口，本版没有将其作为默认语音依赖。

## 使用入口与参考

麦克风：点击开始／结束；Escape 或“取消”放弃。回复后“朗读”播报同一条回复。“＋”→“语音输入与播报 · M3”可配置本地／API、自动播报及快捷键。默认不需要填写语音 API。

- [Microsoft System.Speech 输出 WAV](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer.setoutputtowavestream)
- [OpenAI STT 音频接口](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
- [OpenAI TTS 音频接口](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)
- [Electron 权限处理](https://www.electronjs.org/docs/latest/api/session)
