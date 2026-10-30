# UIArc 控件替换与验收 · 2026-10-29

## 范围

按用户指定组件源接入实际 React / Motion / Radix 控件，编译后本地加载。保留 SVG 宠物、透明窗口命中检测、已有命令校验与数据。

| UIArc 组件 | 当前用途 |
| --- | --- |
| [Dropdown Menu](https://uiarc.dev/components/dropdown-menu) | 主窗口、设置、问一问中的 select；操作选项 |
| [Split Button](https://uiarc.dev/components/split-button) | 快捷输入与问一问发送、停止及附加操作 |
| [Icon Morph](https://uiarc.dev/components/icon-morph) | 下拉箭头、播放暂停、复制反馈、展开和关闭等状态图标 |
| [Number Field](https://uiarc.dev/components/number-field) | 时长、负载阈值等数字输入 |
| [Elastic Slider](https://uiarc.dev/components/elastic-slider) | 音量、亮度、活跃度等 range 控件 |
| [Time Picker](https://uiarc.dev/components/time-picker) | 作息与提醒时间；日期仍用系统日期输入 |
| [Expandable Card](https://uiarc.dev/components/expandable-card) | 专注、负载、设置折叠区 |
| [Tooltip](https://uiarc.dev/components/tooltip) | 带 title 的操作按钮提示 |
| [Countdown](https://uiarc.dev/components/countdown) | 专注剩余时间，暂停冻结，状态取原后端 |

Windows 原生右键菜单继续使用 Electron Menu；系统环绕详情保留现有同窗口避让控制器，避免改变窗口行为。

## 修复

- 发送图标改用 SVG，分离主操作与下拉命中区，保持在输入框内。
- 下拉使用真实 SVG 变形箭头，不再依赖字符基线。浮层 Portal 到 body，发布可点击区域，非模态菜单避免锁住透明窗口。
- 时间按分钟选择，每次最多渲染 36 项；滚动与键盘定位分离，避免滚动时被拉回选中项。
- 原表单控件保留为隐藏代理，校验与事件沿用；组件异常时恢复原控件。
- 数据刷新按值差异更新，不重复播放组件入场；不增加录音或模型调用。

## 验证

- npm test：122 项通过。
- arc-smoke：发送图标边界、本地命令不调用模型、下拉与浮层、数字增减、展开、暂停倒计时、设置无水平溢出、时间选择与手动滚动、滑块提交、三个窗口接入。
- local-voice-smoke：Windows 离线合成语音识别、模拟录音取消；未采集真实麦克风。
- corner-motion-smoke：四角平滑移动与展开中断清理。
- ui-controls-smoke：四次系统详情展开关闭、所有下拉适配、浮动选择面板、三次 Chromium 首次右键均通过。
- system-orbit-smoke：同窗口环绕详情、折线图、分页、关闭恢复和快速重开通过。
- 正式运行目录 BlobPet-win32-x64 的打包版 arc-smoke 通过，9 个替换文件 SHA256 与源码输出一致；已重启。
- 更新前程序文件备份：artifacts/uiarc-backup-20261029-215029。data 目录未覆盖。

截图：artifacts/arc-main.png、arc-settings.png、arc-time-picker.png。自动化包含 Chromium 鼠标/键盘事件与原生命中区域检查；不等同于真实多屏、不同 DPI 或物理鼠标全面验收。
