# 0.7 Cult UI / ChatGPT 网页入口（2026-10-28）

## 界面

使用 Cult UI 免费 MIT CollabToolbar 原始源码（ui/vendor/cult/collab-toolbar.tsx）构建胶囊工具条。React只在构建时生成静态HTML，Tailwind生成约12KB本地CSS，renderer不引入React/Shader常驻运行时。原SVG角色引擎与用户配色、尺寸、显示设置保留。工具条取chat/compass/desktop图标组，不渲染头像或访问外部头像服务。来源和许可在third-party/。

气泡、状态卡、音乐控制、输入胶囊、设置页和问答窗口统一雾白/石墨/淡蓝语义色、细边框、柔和层次与圆角。设置页新增分类跳转，Codex会话缩短初始消息区以保持发送按钮可见。最大192宠物、16字和四行状态+42px胶囊仍保持在360×480内；气泡高度按上方剩余空间限制。

## 问答路径

默认普通问答为ChatGPT网页模式：只有用户提交时，打开固定 https://chatgpt.com/ 并复制所输入的问题。由用户在官网粘贴发送；不使用Codex模型，不在URL携带问题，不读Cookie/登录令牌，也不自动操纵官网表单。ChatGPT自身计划和模型限制仍然适用。这不是内嵌ChatGPT回复API。

搜索直接打开选定引擎；Codex项目只读问答是独立显式模式，清楚标注使用Codex额度，沿用0.6权限边界。模式切换不会重复提交或清空新草稿。主进程全局防重入锁覆盖两个输入入口，避免迟到请求覆盖新问题的剪贴板；UI独立提交锁不会被后台消息或模式变化解开。浏览器打开失败不覆盖剪贴板。

## 用户指定技能

已执行 `npx --yes skills add https://www.aisdkagents.com/skill/setup --skill setup --agent codex --yes`，安装在`.agents/skills/setup/`，并记录skills-lock.json。它是项目规范初始化技能，不是Cult UI组件安装器；本轮没有运行其生成/改写AGENTS.md等文档的初始化引擎。

## 验证

- Node51项通过，包括官网固定URL、无效输入、失败保护、跨入口并发交接。
- Electron专项检查通过：普通问答不调用Codex、搜索分流、剪贴板/浏览器stub、切模式提交锁、胶囊展开/收起与Esc、大尺寸边界、项目问答流式回归、设置和旧功能。
- 已检查设置、音乐设置、折叠/展开胶囊、气泡、ChatGPT模式、Codex模式实际页面截图。浏览器与剪贴板测试不操作真实应用或读取实际剪贴板；没有额外模型问答请求。官网登录/粘贴发送未代用户操作。
- 最终0.7完整打包与进程重启验证通过，记录在artifacts/smoke-report.json、smoke-reopen-report.json、assistant-ui-report.json。源码复核发现的并发问题已修复并回归确认。
- 视觉检查覆盖静态、展开/收起、焦点和提交；未在浏览器Animations面板进行10%速度回放。

参考：[Cult UI安装](https://www.cult-ui.com/docs/installation)、[ChatGPT登录第三方应用的额度说明](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites)、[ChatGPT自身使用限制](https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt)。
