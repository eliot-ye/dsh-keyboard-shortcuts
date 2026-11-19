# ask-popup-digit-select 提案

## Why

DSH 的 ask 弹窗（`ask_user_question` 问答卡片，多用于 `/td-explore` 的 frontier 轮次问答）目前只能用鼠标逐个点击选项；而 bundle 已有 Alt+数字的会话切换快捷键，数字键在两种场景下语义撞车——弹窗打开时按 Alt+数字会去切会话，正是最想用键盘选选项的时刻。需要让 Alt+数字在 ask 弹窗打开时转为"选中第 N 个选项"，弹窗未开时仍保持会话切换，消除语义冲突并覆盖高频问答路径。

## What Changes

- ask 弹窗打开时（DOM 中存在 `[data-question-key]` 容器），Alt+1..3 转为点击当前显示问题的第 1..3 个选项按钮（`[data-option-row]` 内的 `button.option`），不再触发会话切换。
- 数字映射在 web 的 registry `resolve`、desktop 的 registry `resolve`、desktop 的捕获 DOM 监听三个执行点统一前置"弹窗是否打开"判断，保持单一判定语义。
- 单选选项复刻鼠标点击：选中即自动跳下一题（末题仅选中、不自动提交）；多选为 toggle 勾选、不跳题；末题选完后不自动提交。
- 按住修饰键时，提示角标目标从"会话 1-9 + 输入框"切换为 ask 弹窗打开时的"当前问题选项 1-N"，保持提示 UX 一致。
- IME 组合进行中跳过快捷键（与弹窗自身的 `isComposing` 守卫一致）。

## Capabilities

### New Capabilities

（无——本 change 不引入新分系统，仅扩展现有快捷键分系统的行为分支。）

### Modified Capabilities

- `shortcut-core`：数字键（`keyboard.session-<n>`）在 web 与 desktop 两个 `resolve` 路径上，新增"ask 弹窗打开时优先选中弹窗选项、否则切会话"的前置分支；`openSessionAt` 的会话切换语义在弹窗未开时保持不变。
- `desktop-executor-hints`：desktop 捕获 DOM 监听对 `Digit1..3` 同样前置弹窗优先分支；提示角标目标在弹窗打开时改为标注当前问题的选项，且角标目标解析需与选项选择动作使用同一批元素。

## Impact

- 受影响代码：仅 `client.js` 一个文件——新增 ask 弹窗容器/选项定位辅助函数、三执行点的前置判断、角标目标的弹窗分支。不修改 DSH 内部 API，不新增依赖。
- 受影响 spec：`openspec/specs/shortcut-core/spec.md`、`openspec/specs/desktop-executor-hints/spec.md`（各追加行为分支需求，无破坏性变更——弹窗未开的老路径行为不变）。
- 依赖关系：无新增；仍只依赖 DOM 选择器 `[data-question-key]` / `[data-option-row]` / `button.option` 与现有 `isDesktop`/`gestureMatches`/`getService` 约定。
- 部署：bundle 为本地 profile 链接的 npm 包，改动随 `dsh.client.immediately` 在页面加载时生效；无迁移。

## 系统工程影响评估

- **影响哪些分系统**：仅 `shortcut-core`（数字键分发）与 `desktop-executor-hints`（desktop DOM 监听 + 角标）两个分系统；不触及 `bundle-manifest`。
- **整体性能预期变化**：无负向变化。每次数字键 keydown 多一次 `document.querySelector('[data-question-key]')` 的存在性检查（单次 O(1) DOM 查询，key-down 事件频率低）；角标仅在弹窗打开时枚举当前问题的 1-3 个选项，规模不大于原会话 9 行枚举。用户可观察行为：弹窗打开时按 Alt+数字"选中选项"的响应与鼠标点击同级（<100ms 量级的即时反馈），无可见延迟。
- **这是局部优化还是全局协调**：局部优化——针对 ask 弹窗这一具体交互面的数字键重映射；不改变 bundle 的全局架构（仍是注册表 + 捕获监听双机制、仍按 profile 区分修饰键）。
- **局部优化对全局失调的风险**：低，已收敛。风险点是"弹窗打开时数字键语义漂移"——通过把判断收敛到三个执行点共用的同一谓词（`askPopupOpen()`）规避，避免 web/desktop 两条路径判定不一致；弹窗未开时走原路径，会话切换老契约（baseline `shortcut-core`）不被破坏。
- **预期行为模型**：给定 ask 弹窗打开且当前问题有 N≥1 个选项——(1) Alt+1 点击第 1 个选项按钮，效果等同鼠标点击该选项；(2) 单选选中后自动前进到下一题，末题选中不提交；(3) 多选按 Alt+数字 toggle 该项勾选、停留当前题；(4) 末题选完后需显式确认提交。验证方式：在 DSH web client 加载改动后的 bundle，用 `ask_user_question` 发起含单选与多选题的弹窗，按 Alt+1/2/3 观察选项选中状态与题目前进/提交行为是否符合上述四条；弹窗关闭后再按 Alt+1/2/3 验证仍切换侧边栏会话。
- **与既有架构/风格的遵循关系**：完全遵循既有架构——沿用注册表 + 捕获监听双执行机制、`isDesktop`/`gestureMatches`/`getService` 防御性约定、复用 DSH 自身交互路径（`button.click()` 对应 `openSessionAt` 的 `row.click()` 同一哲学）、角标与动作共用同一批目标元素（对应 baseline"角标与切换动作行序一致"）。唯一新增是"弹窗优先"这一上下文分支谓词，属既有"运行时检测 MUST 防御性降级"风格的延伸（弹窗不存在即降级为原路径），非偏离。
- **跳过架构 review**：tier-small 且未引入新分系统切分或偏离既有架构——仅在同一分系统内增加上下文分支，按 `td-propose` 步骤 7 跳过完整架构 review，做一行自检即可。
- **caller impact 分析（跳过说明）**：无四类变更点——未改动公共符号、装配点、包边界或外部契约；改动限于 `client.js` 内部行为分支，且弹窗未开路径行为不变。tier-small 提醒性质，跳过。
- **scenario→test 覆盖账本（跳过说明）**：本 bundle 无可执行测试面（无 tests/ 无测试框架，见 README「Development」节），tier-small 仅当 `applyRequires` 含 specs 且含可执行测试面时强制——此处不满足，跳过；行为验证由 tasks 3.2 的端到端手动验证承载。

## 实际系统工程影响 vs 预期（archive 复盘，2026-11-18）

> 本复盘对照 proposal「系统工程影响评估」节与 `openspec/specs/` baseline，是 `/td-system-audit`「实际 vs 预期」审计的数据来源。

| proposal 侧（预期） | archive 侧（实际） |
|---|---|
| 影响哪些分系统：仅 `shortcut-core`（数字键分发）与 `desktop-executor-hints`（desktop DOM 监听 + 角标） | **一致**。实际改动仅 client.js 内 `askPopupTargets()` 谓词 + 三执行点前置分支 + 角标分支，未触碰 `bundle-manifest`；`openspec show --diff` 确认 delta 仅落在 shortcut-core 与 desktop-executor-hints 两个 capability（纯 ADDED，无其他 capability 变更） |
| 整体性能预期变化：无负向变化，每次 keydown 多一次 O(1) DOM 查询 | **一致**。实测（tasks 3.2 用户目测）Alt+数字响应与鼠标点击同级、无可见延迟；谓词仅在 keydown 时执行一次 `querySelector`，角标枚举 ≤9 项，无缓存失效风险 |
| 这是局部优化还是全局协调：局部优化 | **一致**。针对 ask 弹窗交互面的数字键重映射，bundle 全局架构（注册表 + 捕获监听双机制、按 profile 分修饰键）未变 |
| 局部优化对全局失调的风险：低，已收敛（统一谓词规避 web/desktop 判定分叉） | **一致**。三执行点（web/desktop registry resolve + desktop DOM 监听）经 grep + 代码走查确认共用同一 `askPopupTargets()`；弹窗未开回落 `openSessionAt`，baseline 会话切换契约（`openspec/specs/shortcut-core`「Web 运行时 MUST 由注册表 resolve 直接执行动作」「Desktop 运行时 MUST 由注册表 resolve 驱动数字切换」等既有 requirement）未被破坏 |
| 预期行为模型：4 条（Alt+1 点第 1 选项/单选自动前进+末题不提交/多选 toggle 不跳/末题需显式确认） | **验证通过**。tasks 3.2 用户目测验收（2026-11-18）：弹窗打开时 Alt+1/2/3 选中选项，单选自动前进、末题不提交、多选 toggle 不跳；角标弹窗打开标选项、关闭标会话；弹窗关闭后数字键仍切会话——四条全部成立，**预期行为模型已验证** |

### 补充字段

- **预期之外的副作用**：无。唯一实施期发现（CSS Module 哈希类 `css.option` 不可用、定位器按 ARIA role 修正，见 tasks.md 6.2 验证记录）为**任务内定位器缺陷**，行为契约不变、design 与 spec 已同步回写，非预期外副作用。
- **scenario→test 覆盖账本状态**：本 change 未产出过账本（proposal 已声明 bundle 无可执行测试面、账本跳过）——不适用。
- **需求权衡处置**：proposal「系统工程影响评估」节无"留待 archive 对照"标注的矛盾；设计阶段（design D1 Alternatives、D2 rationale、Risks）已闭合所有权衡——无遗留矛盾。
- **模型修正建议**：预期行为模型验证通过，无偏差——**无需修正**，模型成立并沉淀为 baseline 事实。唯一沉淀的教训是定位器选择：**CSS Module 哈希类（`css.option` 类）不可用，DSH 内部组件的选项按钮须按 ARIA role（`button[role="radio"], button[role="checkbox"]`）定位**——此条应记入本 change 的 reverse-spec/baseline 认知，供后续 propose 直接沿用（避免再踩 `button.option` 字面类选择失效的坑）。

### baseline 契约对照（对照源 2）

`openspec show "ask-popup-digit-select" --diff`（OpenSpec CLI 1.12.0 ≥ v1.11）确认本 change 对主 spec 的 delta 为**纯 ADDED**（shortcut-core 新增 1 条 requirement + desktop-executor-hints 新增 2 条 requirement，均为追加行为分支），**无修改/删除行**——baseline `openspec/specs/shortcut-core/spec.md` 与 `openspec/specs/desktop-executor-hints/spec.md` 声明的全部既有契约与不变量（注册 10 条命令、profile 修饰符区分、desktop resolve 驱动数字切换、会话顺序与角标行序一致、动作复用 DSH 自身交互路径、角标隐藏时机、overlay 先注册、运行时防御性降级）均未被触碰。
