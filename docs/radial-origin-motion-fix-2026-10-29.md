# 环绕面板起点与展开修复 · 2026-10-29

## 原因与修改

- 原先 individual scale 与 transform: translate(-50%,-50%) 叠加，使卡片缩放后的中心偏离宠物。统一使用同一个 transform 链，保留居中基准，再平移/缩放。
- 原先展开时每帧调整 Windows 窗口，同时播放渲染层动画；在角落、首绘耗时时，中间帧会被跳过。改为原生画布只提交一次，先补偿宠物屏幕坐标，再由同一渲染层展开/收回。
- 受限 radialCommit 只接受本窗口、当前准备 ID；尺寸来自主进程。同步提交仅用于短暂的 native setBounds，不做 IO/模型/子进程操作。
- 动画按实际渲染帧推进、长帧最多前进 32ms，防止一次长绘制直接跳到终点。正常展开 320ms（卡片最多 60ms 错峰）、收起 200ms；慢机器可稍延长，计时业务不受影响。
- 保留窗口角落避让、收回原位、快速开关代次隔离、reduce-motion 设置和宠物最前层。

## 验证

已复现旧版：首帧卡片中心与宠物偏离，且 20 多毫秒后已跳过大量动画进度。新 radial-motion-smoke 验证首帧重合、展开/收起可见中间帧、非主窗口几何 IPC 拒绝。四角轨迹和中断清理、系统环绕数据/分页/关闭重开、原 UI 控件回归均通过。

这些是本机自动化和渲染坐标验证，不是人工多屏/DPI 全面验收。性能采样和轨迹保存在 artifacts/radial-motion-*。

## 运行版交付

- npm test：122 项通过。
- 暂存包 dist/BlobPet-motion-20261029 构建通过，完整 packaged smoke 与真实进程重启检查通过。退出时日志含 Chromium GPU command-buffer 警告；未导致断言失败或启动失败，保留日志供后续跟踪。
- 打包版 radial-motion-smoke 和 arc-smoke 均通过。
- 正式目录 dist/BlobPet-win32-x64 的 desktop/pet 与已验证暂存包逐文件 SHA256 一致，已重启。
- 程序文件回滚备份：artifacts/radial-motion-backup-20261029-225640；data 未覆盖。
- 同时修复 UIArc 初次挂载时 legacy 表单节点短暂脱离 document 的竞态（初次 scan 同步提交），完整渲染错误检查通过。
- 旧冒烟断言已按常驻输入框、自适应窗口和 3 秒 hover 宽限更新；漫游夹具重设测试专用心情，避免重复测试积累的开心状态抑制漫游。

## 追加：快捷卡片先收起，再展开环绕卡片

用户复测指出缺少先后顺序：旧的 radial-preparing 直接 visibility:hidden。已增加独立 collapseShortcuts 阶段：整组快捷卡片向宠物中心收拢并淡出（正常 180ms），其间 radial 保持隐藏；完成后才提交画布并播放原 320ms 环绕展开。减少动态效果时跳过视觉过渡。

准备代次与动画取消共同防止快速关闭后旧回调重新打开，取消恢复原快捷卡片不残留透明。新增专项先在旧代码上失败，再验证源代码及打包版通过；四角和系统环绕回归通过。打包日志 artifacts/shortcut-first-packaged.log。正式运行版三个替换文件逐一 SHA256 匹配，data 未覆盖；回滚备份 artifacts/shortcut-first-backup-20261029-230600。
