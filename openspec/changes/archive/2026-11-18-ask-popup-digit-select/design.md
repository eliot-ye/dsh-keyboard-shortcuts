# ask-popup-digit-select 设计

## Context

See proposal.md - Why。现状：`client.js` 的数字键（`keyboard.session-<n>`）在两个执行点处理会话切换——web/desktop 的 registry `resolve`，以及 desktop 额外的捕获 DOM 监听（见 baseline `desktop-executor-hints`）。ask 弹窗由 DSH 的 `dsh-client-ui-user-questions` 渲染在 composer seat，DOM 锚点为 `[data-question-key]` 容器 + `[data-option-row]` 内的选项按钮（`role="radio"`/`"checkbox"` 的 `button`）；单选选项自身已显示 1..N 序号。

## Goals / Non-Goals

- **Goals**：弹窗打开时数字键（1..3）选中当前问题选项，三执行点判定一致；弹窗未开时行为与改动前逐字节一致；角标随场景切换目标。
- **Non-Goals**：不改弹窗自身提交/导航逻辑（前进、提交、跳过仍由弹窗处理）；不引入对 DSH 内部 service/API 的调用（仍纯 DOM）；不扩展到 4-9 号键（弹窗选项通常 ≤5，1..3 覆盖高频，且 4..9 仍保留会话切换无冲突）。

## Decisions

### D1: 统一谓词 `askPopupTargets()`，三执行点共用

新增模块级函数 `askPopupTargets()`，返回 `{ rows, pick(index) }` 或 `null`：

- `null` = 弹窗未打开 / 无可选选项 → 调用方回落 `openSessionAt`。
- 非空 = 弹窗打开 → `pick(index)` 对第 index 个可见选项按钮（`role="radio"`/`"checkbox"`）执行 `.click()`（复用弹窗自身 `choose` 处理），返回是否成功。

**Rationale**：web resolve、desktop resolve、desktop DOM 监听三处调用同一谓词，避免三条路径对"弹窗是否打开"判定分叉（对应 spec"数字键弹窗优先判断 MUST 在三个执行点统一"）。`.click()` 复用弹窗自身选择逻辑，与 `openSessionAt` 的 `row.click()` 同一哲学，单选自动前进/多选 toggle/末题不提交全部由弹窗原有行为承载，本插件不重复实现选择状态机。

**Alternatives considered**：
- 在 registry 注册独立的新命令（如 `keyboard.ask-option-n`）——被否：数字键在弹窗场景语义唯一，拆成平行命令会让"弹窗开/关"两套命令并存，调用方仍需判断走哪条，未消除分叉；且原生桥只回调已绑定 chord 的命令，新命令要额外绑键更复杂。
- 直接调弹窗内部 `choose` service——被否：违反"复用 DSH 自身交互路径"，且 service 访问脆弱（`getService` 防御性约定的对象是 shortcuts 这类稳定 service，弹窗内部 runtime 不是公开契约）。

### D2: "当前问题"定位用可见选项行而非题号推断

`askPopupTargets()` 不解析 `index`/`questions` 长度，只取**当前可见**的 `[data-option-row]`（复用现有 `isVisible`），顺序即文档顺序。弹窗一次只展示一题，可见选项行天然属于当前题。每个选项行内的**选项按钮按 ARIA role 定位**（`button[role="radio"], button[role="checkbox"]`）——不能用 `button.option` 字面类选择，因为 `css.option` 是 CSS Module 哈希类（构建后为 `ggehTG_option` 之类）；每个选项行内还有一个无 role 的"展开说明"按钮，故按 role 区分。弹窗的 `data-question-key` / `data-option-row` 是字面 data 属性，构建后保留，可安全选择。

**rationale**：与 baseline"会话顺序 MUST 与侧边栏可见展示顺序一致""角标与切换动作使用同一批行"完全同构——不猜内部状态、只信可见 DOM，角标与动作天然一致。多题时隐藏题的选项行不可见，被 `isVisible` 过滤，不误选。

### D3: IME 守卫前置到动作执行点

`askPopupTargets().pick` 与 desktop DOM 监听在执行前检查 `event.isComposing`（复用弹窗自身的 composing 判据语义），组合中不消费按键。

### D4: 角标目标在覆盖层 `findTargets` 内分场景

`findTargets()` 首先调 `askPopupTargets()`：命中 → 目标为当前题选项行、角标标 `1..N`；未命中 → 走既有输入框 `I` + 会话 `1..9`。因角标与动作共用 `askPopupTargets`，编号与选中一致（对应 spec ADDED"角标与选项选中使用同一批目标"）。

## Risks / Trade-offs

- **弹窗选择器 `[data-question-key]` / `[data-option-row]` 为 DSH 内部 class/data 属性**，版本升级可能变更 → 缓解：`askPopupTargets()` 全程防御性（选择器无匹配即返回 null 回落原路径），选择器失效仅退化为"弹窗场景不生效"，不破坏会话切换；在 spec 已锚定该契约，DSH 升级时对照 spec 排查。
- **`.click()` 对选项按钮在 locked（提交中）/disabled 状态下无效** → 缓解：disabled 按钮 `.click()` 不触发，`pick` 返回 false，调用方按"未处理"放行（不 preventDefault），交由弹窗/浏览器默认行为，无副作用。
- **数字键 4..9 在弹窗打开时仍切会话**（仅 1..3 选选项）→ 这是刻意的 trade-off（选项通常 ≤5 且 1..3 覆盖高频，4..9 保留会话能力）。若未来选项超 3 且需全键盘覆盖，再扩展键位（已在 Non-Goals 显式排除本次范围）。
- **`document.querySelector` 每次 keydown 执行** → 单次 O(1) DOM 查询，key-down 低频，可忽略；不缓存（弹窗开/关是动态状态，缓存会引入失效复杂度，得不偿失）。

## Migration Plan

改动仅在 `client.js`，随 `dsh.client.immediately` 在页面加载生效，无数据迁移。回滚：revert `client.js` 该提交即可，无状态残留。

## Open Questions

（无——探索阶段已闭合行为三决策点：单选自动前进、多选 toggle、末题不提交，均已落入 spec。）
