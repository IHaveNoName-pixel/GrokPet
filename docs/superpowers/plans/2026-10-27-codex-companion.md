# Codex Companion Implementation Plan

> Execute inline with executing-plans, test-driven-development and verification-before-completion. User approved the scope on 2026-10-27.

**Goal:** 可直接运行的 Codex 额度、网络状态与通知桌宠助手。
**Architecture:** Electron 主进程管理 Codex RPC、事件与状态；.NET Windows helper 读取系统指标及经授权通知；renderer 只展示净化后的数据。
**Tech Stack:** Electron 41.10.6, Node built-in tests, .NET 10 WPF / Windows SDK 26100.
**Spec:** ../specs/2026-10-27-codex-companion-design.md

## Constraints

保持第一版全部能力；不修改 Codex 程序、不代办审批、不控制 VPN、不读取认证令牌、不上传通知；授权只由用户操作。

## Tasks

- [x] Tests first: quota, throughput, lifecycle queue, hook merging, HUD persistence, startup adapter. 23 tests passing.
- [x] Codex RPC: spawn/init/timeout/cancellation, read-only refresh and surfaced errors; live RPC verified.
- [x] Native helper: metrics, permission check/request, fresh notification polling and hook relay. Built and safe probes passed; real notification reading remains user-gated and untested.
- [x] Main integration: hook installer, isolated panel IPC, activity priority, HUD and queued bubbles.
- [x] Actual packaged Electron panel/HUD/bubble, quota, native metrics and process restart passed. Independent code review fixes verified.

## Ledger

Approved independent companion scope. Live proof: CLI 0.154.0 official read-only rateLimits RPC worked; physical WLAN byte counters and active FlClash Meta Tunnel / enabled proxy were observed. No global hooks.json existed at inspection. Windows SDK and .NET 10 are available locally.

User additions: CPU/memory/GPU and load animations; readable configurable HUD with hover/always/hidden; optional login startup. Completed with actual UI capture/IPC/restart verification. Startup registration was not enabled on the user's behalf. Existing hook configuration now has five marked handlers; preserved.

Rulings: app-specific same-user pipe channels and parent-exit cleanup avoid stale bridge collisions; UTF8 stdin preserves Chinese completion summaries. Missing/mixed/late turn IDs covered by regressions. System bridge failures invalidate load animations. Synthetic input uses the pet's own renderer protocol so foreground app switching cannot break fixtures.
