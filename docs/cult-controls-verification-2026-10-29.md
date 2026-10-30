# 计时器、选择框与浮动详情修复

## 实现

- 专注卡片移除可见进度条，采用 Cult UI Timer 的时钟图标、胶囊显示与等宽倒计时。时间仍由现有持久化 FocusTimer／情境提醒驱动，没有新增独立计时状态；暂停不重置时间。
- 主桌宠、设置页、问答／服务页全部单选下拉采用 Halo Select 的视觉与交互适配，保留原 select 的值与 input/change 事件。动态创建的电源选择器也会自动适配。浮层使用浏览器顶层，不受卡片滚动容器裁切；按可用高度向上或向下布局，支持键盘选择、Escape、外部点击关闭、禁用项和程序更新后的标签同步。浮层矩形加入原生鼠标交互区域，展开时保留悬停状态。
- Wi-Fi／蓝牙／电池详情采用 Floating Panel 从来源卡片变形展开、返回时回到来源的交互。按实际内容计算高度，避免稀疏列表占满整列；返回／刷新 40px 点击高度，返回按钮至少 76px 宽，卡片展开入口覆盖标题行。
- 原生右键菜单统一经过聚焦、防重入口；保留键盘和 Chromium context-menu 后备路径。指针进入可交互区域时通知主进程及时接收鼠标事件。

## 已复现并修复的原因

系统详情关闭时，原生窗口先恢复 480px 高度。主进程把接收到的控制区域按这个暂时较小的窗口截断；随后窗口重新展开，但渲染器因矩形值未变而不重新发送，导致可见的系统卡片落在被裁掉的区域。新增专项中的区域覆盖断言在旧实现失败。修复为保留校验过的完整矩形，命中范围不依赖接收时的暂时窗口大小；仍由窗口自身边界约束操作范围。

视觉验收另外发现来源详情面板的 flex 列表 scrollHeight 包含填充空白，导致稀疏列表高度过大；改为按子项实际高度计算。调整环绕容器层级，避免角色覆盖浮动详情内容。

## 验证

- 122 项原有及语音单元测试通过。
- `--pet-ui-controls-smoke`：系统详情开关 4 次，恢复后原生矩形覆盖系统按钮；计时开始、暂停后时钟稳定；三个窗口全部 select 适配；程序修改值后标签同步；选项浮层位于视口内并具有原生可点击矩形；选择值回写；Wi-Fi 只读列表、详情高度和返回按钮尺寸；展开与返回；连续 3 次 Chromium 右键事件均首次弹出 Electron 原生菜单并关闭。
- 原生音量和快捷设备状态接口在最终正式包返回有效数据。没有切换 Wi-Fi、蓝牙或修改音量。
- 已检查 `artifacts/halo-select-open.png`、`floating-choice-open.png`、`cult-controls.png`。
- Windows 实际指针测试没有完成：命令注入未落到目标位置；桌面控制工具报告坐标被微信小程序窗口命中，聚焦后仍无法确认目标。因此不把 Chromium 事件路径验证记为完整 Windows 物理鼠标验收，偶发首击问题仍需用户实际桌面观察。

## 正式运行目录

本轮发现实际运行的是 `dist/BlobPet-win32-x64/BlobPet.exe`，与此前更新的 `BlobPet-corner-stage` 不同。正式目录原生桥接 DLL 也较旧，返回了空音量结果。已停止验证副本，备份并同步正式目录的 desktop、pet 与原生 bridge 文件；用户 data 未替换。音量响应解析增加空／无效 JSON 后备处理。

正式目录备份：`artifacts/production-controls-backup-20261029-201436`（含旧 desktop、pet、bridge）。最终正式包控件专项退出码 0，无旧桥接解析错误；正式程序已重启。

## 组件来源

用户指定的三个免费组件官方 registry 原始源码保留在 `ui/vendor/cult/reference/`，许可沿用 `third-party/CULT-UI-LICENSE.txt`。当前实现是保留 DOM 表单和 Electron 穿透生命周期的适配，不重新引入此前撤下的 React 输入组件运行时。

- [Timer](https://www.cult-ui.com/docs/components/timer)
- [Halo Select](https://www.cult-ui.com/docs/components/halo-select)
- [Floating Panel](https://www.cult-ui.com/docs/components/floating-panel)
