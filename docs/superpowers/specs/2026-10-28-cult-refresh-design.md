# Cult UI 0.7

用户批准：保留SVG引擎，胶囊框做简单搜索；普通问答默认复制问题并打开ChatGPT官网，由用户粘贴发送；Codex只读项目问答单独保留并标注额度；统一设置、气泡、状态和对话界面。

以Cult UI MIT的CollabToolbar作为实际胶囊工具条，React只在构建时渲染静态组件，Tailwind生成其本地样式，保留现有Electron原生DOM交互，避免重写角色引擎与已验证IPC。UI其他部分共用石墨/雾白/淡蓝主题、细边框、柔和阴影和统一圆角。不会下载付费AI SDK Agents代码、接入新AI计费后端或购买产品。

收起时聊天/搜索/完整窗口三个图标，展开为单行表单。普通问答和搜索都不进入Codex连接；ChatGPT模式仅在用户提交时复制文本、打开固定官网URL，不携带问题进URL，不读Cookie和登录令牌，不自动发送。用户仍受ChatGPT自身额度约束。Mic未接入，不添加假语音按钮。最大字号和最大宠物尺寸的下方布局仍需完整容纳。

setup技能已按用户命令安装到项目.agents/skills/setup；本次安装不等于执行其生成AGENTS/CONTEXT/DESIGN的初始化流程，现有用户文档保留。
