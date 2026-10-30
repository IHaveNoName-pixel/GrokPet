# 问答气泡与待办滑动操作

2026-10-30。

## 修复与交付

- 根因：快捷问答完成后 say(answer) 与 applyState(sleeping/drowsy/waking) 共用气泡，空闲提示无优先级地覆盖答案。现在思考/回答保护期间，普通通知、歌词和空闲提示不能覆盖，重要提醒仍可显示。答案重显、复制、完整回答继续按所选回合 ID 访问原归档。
- 输入框新增本次运行对话记录，可收起，固定高度滚动，展示问题、回复、失败或停止状态；向上浏览时不自动跳到底部。最多 20 轮、每问题 8000 字/回复 100000 字，仅保存在运行内存，不写入长期项目记忆，不额外调用模型。
- 历史回复的“显示此回复”会同步切换重显/复制/完整回答/朗读的目标，不混用最新回复。
- 待办使用官方 UIArc Swipe Actions（MIT）源码，沿用已有 React/Motion/Radix 本地 bundle。右滑显示完成，左滑显示稍后/删除；保留更多操作菜单。禁用滑到底直接删除，所有动作仍走原 reminderAction 校验，并阻止重复提交。回弹期间显式菜单一击可用。

官方说明：https://uiarc.dev/components/swipe-actions 。原始 JSON 位于 ui/vendor/arc/reference/swipe-actions.json；运行源码位于 registry/components/swipe-actions。

## 验证

- 单元测试覆盖气泡优先级、问题/回复合并、作用域、终态不回退、失败/停止、记录上限。
- Electron 专项使用模拟模型返回，验证休眠状态不覆盖思考/答案；原生 Chromium 鼠标滚轮滚动历史、浏览位置保持、回复 ID 绑定、展开/收起；真实指针拖动官方滑动行、菜单完成进入已完成状态。
- 截图 artifacts/chat-history-fixed.png 与 artifacts/reminder-swipes.png；模型返回为测试夹具，不消耗用户模型额度。原生指针自动化不代表物理鼠标、多屏和 DPI 的用户验收。
- 162 项自动测试、完整打包与重启回归、最终打包专项通过。正式版已更新并重启，逐文件 SHA256 与验证包一致，data 未替换。回滚文件 artifacts/chat-history-backup-20261030-105323；部署记录 artifacts/chat-history-deployment.json。

测试脚本等待窗口焦点、布局和 compositor 输入投递完成；先初始化待办夹具再打开窗口，避免上一轮持久化测试项的退出动画干扰。未修改用户数据。打包退出有既有 Chromium GPU 日志，主进程重启验证通过。
