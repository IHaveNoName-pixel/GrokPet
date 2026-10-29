# Codex 动作和优先级 0.5（2026-10-28）

用户明确要求接入既有 thinking/searching/writing/proud/celebrate/confused/sad 动画，并让高负载仅在空闲时显示。本版复用角色原有 SVG 动画，不改原引擎造型。

## 规则

直接交互优先；其后为 Codex、播放中的音乐。没有这些外部活动时保留自主动作；只有基础状态为 idle 时允许高负载动画，故不会覆盖睡觉、叫醒、好奇等动作。音乐音符不再受硬件负载标记压制。

Codex UserPromptSubmit 后显示 thinking，表示分析/等待下一步，并不读取内部思考内容。PreToolUse 依据工具名和有限 shell 命令分类：apply_patch/Edit/Write 类为 writing，搜索工具和 rg/grep/Select-String 类为 searching，未知工具为 working。并行工具按调用ID保留，工具结束后回到剩余工具阶段，否则回 thinking。待审批仍为 alerting。

PostToolUse 中明确 isError、success:false、非零 exit_code/exitCode、error 或标准进程退出标记表示工具失败，显示 confused；后续工具成功会更新最后工具状态。Stop 到达时，若最后一次工具仍失败则 sad，否则 proud 1.5秒后 celebrate，总计5秒。正常结束不等于整个项目或测试成功；无结构化状态时不靠回答文字猜测失败。Interrupt 只提示中断。

## 接入与边界

通过官方 hooks 增加 PreToolUse，保留已有配置并在修改前备份。仅归一化转发 session/turn/tool ID、phase、failed 和原有最多240字符的完成摘要；工具原始参数、命令、响应和文件内容不发送到桌宠，也不保存。hooks 继续返回空对象，不作审批决定。

官方说明部分 hosted/specialized 工具不经过 hooks，不能保证所有搜索和编辑都有动作事件；普通 shell 中复杂脚本也可能只能归为 working。现有事件格式没有独立最终项目成功标志，完成动画表示回合结束。

参考：[官方 Codex Hooks](https://learn.chatgpt.com/docs/hooks)。

## 验证

- Node 40项测试通过，包括高负载只在idle、阶段切换、并行工具、乱序回合、失败恢复、已完成工具的迟到/重复事件保护。
- 原生 Release 构建0警告0错误；`node scripts/verify-hook-payload.cjs` 十组原生归一化用例通过，检查未转发原始工具参数。
- 打包 Electron 完整检查与进程重启检查通过。同用户原生管道实际转发了 PreToolUse 搜索/编辑和 PostToolUse 失败事件；动画注入场景确认 thinking/searching/writing/confused/sad/proud/celebrate 均高于模拟99%负载，音乐音符正常，负载只在idle出现，sleeping/waking也不被覆盖。
- 报告为 `artifacts/activity-report.json`、`artifacts/companion-report.json`；动画截图只捕获本应用，不截取其他应用或真实任务内容。未通过模型请求制造真实失败；分类与渲染使用构造事件验证。
- 本机已有桌宠 hooks 已合并升级为6个处理器（新增PreToolUse），保留其他处理器并生成原配置备份。新聊天中加载更新的配置；当前已打开聊天是否热更新不作保证。
