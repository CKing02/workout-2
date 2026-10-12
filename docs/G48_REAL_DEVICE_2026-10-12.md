# G48 真机验收记录 — 2026-10-12 / 13

实现、自动验证和核心真机取证已完成，本轮停止重复测试并回填结果。**不判定九条 AC 全部通过**：干净 checkout 的品牌引用缺失、主观手感和清单中未覆盖项仍保留。§2 单位换算发现基线缺陷，未扩大 G48 修改范围。

## 提交与自动验证

起点 `master@d07360c`；实现 `bbb49ed`，统计卡与时长修复 `07cb811`，原生入场完成后再播放计数/庆祝 `e06a82f`，均已推送。`202e0fe` 为之前的下班交接记录，本文件替代其过期验收状态。

- 总结入场冻结时长、容量和组数，显式保存才写训练组。容量/最佳组只取已完成、非热身、有限正数的重量与次数；总组数包含全部组。
- 用户批准的组件范围例外：`CountUp.tsx` 最小修复，保持 props 签名，UI→JS 桥接中间值与完成回调、standard easing。
- 本批未修改 ConfettiBurst / haptics / motion / RestTimerOverlay / PlanEditorScreen / 设计系统 primitives / 品牌目录，未增加依赖、schema 或 migration。品牌和通知着色 WIP 未纳入提交或云包。
- 当前工作区 typecheck exit 0；全量 Jest **49 suites / 555 tests / 1 snapshot，exit 0**。日志 `typecheck-entry.log` / `jest-entry-retry.log`。数字含工作区现有未提交测试，不等同干净 checkout 的 suite 数量。
- 首轮 Jest 断言通过，但既有 Expo mock 测试后异步日志使退出码为 1；限制为 2 workers 后全量 exit 0，未修改 mock。
- 干净 checkout typecheck 有两条既有 TS2307：`brand/BootSplash.tsx` 引用未提交的 `BarbellMark` / `markGeometry`。当前工作区 WIP 存在所以通过；AC-7 不报告无条件达成。证据 `clean-typecheck.log`。

## 云 APK 与设备

| 项 | 记录 |
|---|---|
| 最终云构建 | [GitHub Actions 38269640863](https://github.com/CKing02/workout-2/actions/runs/38269640863)，源码 `e06a82f6eb217d99fc933e1ea199e5e972e47893` |
| Artifact | `11757312294`，ZIP CRC通过，APK SHA256与产物清单一致 |
| APK SHA256 | `db1e33734c6550066449f38ff8fde59a2dde1c4e4dc7c54d88d455afefe8c6c4` |
| 本地 APK | `.tmp/g48/apk-e06a82f/android/app/build/outputs/apk/debug/app-debug.apk` |
| 类型 | debug dev-client，arm64-v8a / x86_64，1.0.0 / versionCode 1；需要Metro，不是独立release包 |
| 设备 | OPPO PBEM00 / Android10 / API29，serial `3c66de59` |
| 最终安装 | 2026-10-13 00:09，同证书 `adb install -r` Success；未卸载、未清数据 |
| 最终启动 | 连干净e06a82f Metro后首页正常，截图 `final-e06a82f-ready.png`，已有三条历史仍在 |

**证据来源区别**：核心录屏使用bbb49ed原生dev-client + 干净e06a82f Metro JS。两次修复仅涉及JS/测试。最终e06a82f云APK另做覆盖安装与启动确认，没有重跑整套。SDK已被用户删除，构建使用GitHub云端。

## 九条 AC 对照

| AC | 结论与证据 |
|---|---|
| 1 最佳组 | 核心真机场景及自动测试通过：40×10、60×8、热身100×10、未完成100×20，best=60×8=480；无重量/仅热身为空 |
| 2 三项CountUp | 通过：最终值与快照一致，动作数静态；保存历史核对冻结值 |
| 3 260ms standard | 接入与中间帧确认，无跨线程红屏；配置260ms，debug录屏展示约300ms，**不宣称物理耗时精确260ms** |
| 4 负重庆祝 | 一次粒子与一次heavy调用确认，约2.2s下落淡出；详情/滚动/继续操作无额外入场heavy |
| 5 安静完成 | 无重量自由训练和仅热身均无confetti/heavy，计数和退出正常 |
| 6 按钮落版 | 宽492→529→492（约1→1.075→1），≤184ms，未见overshoot；快速两点只完成一组，末组自动总结 |
| 7 typecheck | 工作区通过；干净checkout两条基线品牌TS2307未修，保留限制 |
| 8 Jest | 当前工作区49/555/1全绿，新增store/CountUp/screen测试；数量边界见上文 |
| 9 真机回归 | 四节核心流程已取证；单位换算失败、主观手感、严格30秒后台/锁屏及其他未覆盖项未全验，不判整条完全满足 |

## 核心真机证据

文件均在 `E:\cccDIV\ideaP\DL-2\.tmp\g48\`，为本地忽略文件，未上传仓库。

| 场景 | 结果 | 文件 |
|---|---|---|
| 负重入场计数 | 入场先0，transitionEnd后播放；容量0→50.9→549.5→696.1→810→871.4→879.6→880；时长0→00:15→02:27→03:05→03:35→03:51→03:53→03:54；总组0→2→3→4 | `final-weighted-entry.mp4`、`final-weighted-entry-contact-13.15.jpg` |
| 庆祝一次性 | heavy最后23:32:12，[0,60]/[0,70]；Sheet/滚动/不保存后继续未新增；粒子约2.2s结束 | `final-weighted-entry-contact-13.0.jpg`、`final-weighted-entry-vibrator.txt`、`final-weighted-late-vibrator.txt` |
| 静态与最佳组 | 2×2卡无截断，最佳卡滚动可见，Sheet详情一致 | `final-weighted-stable.png`、`weighted-best-card.png` |
| 保存冻结 | 另一轮总结停留约2分钟，历史仍415s / 880 / 3完成组；总结总组4；保存前DB未写本次训练组 | `weighted-history-detail.png`、`weighted-saved.png`、只读DB快照 |
| 不保存/取消 | 二次确认、继续、确认不保存及训练取消走通；后续未新增已完成历史 | `final-discard-dialog-stable.png`、`db-after-controlled-cancel/` |
| 完成组与休息 | 按钮≤184ms；+15、折叠/展开、跳过走通；skip后服务无记录、App活跃通知0 | `final-rest-controls.mp4`、`final-rest-controls-button-width.txt`、`final-rest-skipped-service.txt`、`final-rest-skipped-notification.txt` |
| 无重量自由训练 | 00:36 / 0kg / 1动作 / 1总组，无最佳/粒子/heavy；普通完成组震动不计入场heavy | `free-quiet.mp4`、`free-quiet-contact-9.0.jpg`、`free-quiet-summary.png` |
| 仅热身 | 02:43 / 0kg / 1动作 / 4总组，无最佳/粒子，heavy未新增；40.55输入截为40.5 | `warmup-quiet-entry.mp4`、`warmup-quiet-summary-final.png`、`warmup-after-vibrator-final.txt`、`warmup-decimal.png` |
| 关闭震动 | 400容量计数/粒子正常，vibrator未新增；后恢复kg/震动开/跟随系统/默认休息90 | `haptics-off-entry.mp4`、`haptics-off-entry-contact-9.0.jpg`、`off-entry-before-vibrator.txt`、`off-entry-after-vibrator.txt`、`settings-restored-final.png` |
| 后台返回 | HOME约10秒→MAIN返回等待渲染，休息69→54、训练01:15→01:29；Sheet正常，foregroundId1001 | `bg-controlled.mp4`、`bg-controlled-before.png`、`bg-controlled-return.png`、`bg-controlled-return-service.txt` |
| 锁屏返回 | 约10秒锁屏，休息60→44、训练02:08→02:25；不是严格30秒测试 | `lock-controlled-before.png`、`lock-controlled-after.png` |
| 后台到点 | 单条休息结束替换倒计时，service停止；两次不同休息到点各alarm×1+notification×1，未观察同次重复 | `bg-expire-start.png`、`bg-expire-end.png`、`bg-expire-end-service.txt`、`bg-expire-end-notification.txt`、`bg-expire-end-vibrator.txt` |

录屏已取得，旧交接“没有录屏”过期。未对准入场的 `warmup-quiet.mp4` / `haptics-off-weighted.mp4` 不作入场证据。过早后台返回截图曾缺Sheet，受控等待渲染未复现，不记确定缺陷；深链会reload，不用于正常后台恢复。

## 发现与未覆盖项

**P1基线单位问题（§2.7.4）**：切lb后上次显示100.0/60.0/40.0 lb，DB实际100/60/40 kg，应为220.5/132.3/88.2 lb。证据 `lastdata-lb-confirmed.png`；`formatWeight`直接拼单位，d07360c已有同样逻辑和调用。部分输入/非活动行单位也不一致。本轮仅记录，未修复、未保存错误单位数据，已恢复kg。

通知进度条仍系统teal，42.5～42.7旧失败保持，未混入着色WIP。channel dump核实rest_timer importance4/HIGH、震动pattern[0,250,250,250]，未长按系统设置。API29非首次授权，未验API33+首次允许/拒绝。

未覆盖：§2.7.3新自定义动作无历史、§2.7.5/2.8.4训练override保存、§2.8.2杀进程处方持久化、§2.8.5自由负重0/0；严格30秒后台/锁屏及Doze；休息展开/折叠/归零每段精确动效时长；主观手持触感。无重量自由训练不代替自由负重输入测试。保持待验，不再为补齐这些重复整套。

## 数据与交接

最终首页历史容量880 / 2880 / 960，总容量4720。核心保存ID `732028f4-11d9-4a13-9b22-857e239cfddb`，415秒。后续无重量/仅热身/震动关闭/后台测试均UI不保存或取消。错误深链reload留下未结束训练 `032234c3-0077-43cf-a036-f41af41fbe6f`，非历史，未raw-delete；快照保留。

无关WIP原样保留。干净Metro worktree `C:\Users\Ring\.codex\worktrees\g48-device\DL-2` 在e06a82f，8082；设备最终停首页，无待保存训练。后续先读本记录，避免重新实现或重复已通过测试。
