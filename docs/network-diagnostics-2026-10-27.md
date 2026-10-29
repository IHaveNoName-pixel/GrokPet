# 2026-10-27 Codex 间歇断流诊断

现象：`stream disconnected before completion: Transport error: network error: error decoding response body`。

已确认本机 FlClash/Mihomo 正在运行，系统代理为回环端口7890，WLAN、FlClash TUN均启用。Codex日志检索到连接关闭记录。TLS校验保持开启；Windows curl另遇证书吊销服务器不可达，该错误不能直接认定为Codex断流的同一根因。

使用正常证书校验的Node客户端访问公开Codex端点可收到405（未认证GET不支持，证明公开HTTP链路可达，不代表认证生成流成功）。npm公开元数据曾完整读取约4.29MB，也曾在HTTP200后发生ECONNRESET或被截断。

测试现有故障转移和自动选择组，均未稳定通过完整响应读取。因此已恢复原手选 `US 联通优选[197ms]`，没有保留更差的出口。通过本机控制接口清理了49条仅属于codex.exe、目标chatgpt.com域、超过10分钟且累计流量小于64KiB的陈旧连接；其他应用连接未清理。

没有改订阅、节点凭据、DNS、MTU或关闭TLS/证书校验。控制接口凭据仅在内存用于回环访问，没有输出或保存到项目。非敏感变更记录保存在`artifacts/network-repair/route-change.json`。

结论：本机基础访问可用，但间歇性的上游连接/大响应重置仍未消除，不能宣称网络彻底修复。剩余需要与不同上游出口或独立网络对比，并验证实际Codex长流；本轮未伪造生成流测试结果。项目构建和实际EXE验证已继续完成。
