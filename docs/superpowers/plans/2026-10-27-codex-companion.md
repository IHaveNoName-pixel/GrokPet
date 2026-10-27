# Codex Companion Implementation Plan

> Execute inline with executing-plans, test-driven-development and verification-before-completion. User approved the scope on 2026-10-27.

**Goal:** 可直接运行的 Codex 额度、网络状态与通知桌宠助手。
**Architecture:** Electron 主进程管理 Codex RPC、事件与状态；.NET Windows helper 读取系统指标及经授权通知；renderer 只展示净化后的数据。
**Tech Stack:** Electron 41.10.6, Node built-in tests, .NET 10 WPF / Windows SDK 26100.
**Spec:** ../specs/2026-10-27-codex-companion-design.md

## Constraints

保持第一版全部能力；不修改 Codex 程序、不代办审批、不控制 VPN、不读取认证令牌、不上传通知；授权只由用户操作。

## Tasks

- [ ] Tests first: tests/companion.test.cjs for quota, throughput, lifecycle queue, hook merging. Run failing tests, implement desktop/companion-core.cjs.
- [ ] Codex RPC: desktop/codex-client.cjs with spawn/init/timeout/cancellation, read-only refresh and surfaced errors.
- [ ] Native helper: native/BlobPetBridge with metrics, permission check/request, fresh notification polling and hook relay. Build and run safe metric/status probes.
- [ ] Main integration: desktop/companion.cjs, hook installer, isolated panel IPC, activity priority, status HUD, queued bubbles; add pet/panel.html/css/js.
- [ ] Test actual Electron panel/HUD/bubble, quota refresh, native metrics and restart. Independent code review, fix regressions, package, preserve evidence and note notification permission boundary.

## Ledger

Approved independent companion scope. Live proof: CLI 0.154.0 official read-only rateLimits RPC worked; physical WLAN byte counters and active FlClash Meta Tunnel / enabled proxy were observed. No global hooks.json existed at inspection. Windows SDK and .NET 10 are available locally.
