# ask-popup-submit-shortcut 设计

## Context

See proposal.md - Why。现状：`ask-popup-digit-select` 已让 Alt+1..3 选中 ask 弹窗选项，但提交/下一题按钮仍需鼠标。本 change 给主按钮加快捷键 `keyboard.ask-submit`（Alt+S），与既有 `keyboard.focus-composer`（Alt+I）完全同构。

## Goals / Non-Goals

- **Goals**：弹窗打开时 Alt+S 点击主按钮（提交/下一题）；主按钮 disabled / 弹窗未开时不动作；角标在主按钮标 `S`。
- **Non-Goals**：不实现 ↑/↓ 选项导航 + Enter 模拟点击（原 a2，属 DSH `QuestionComposer` 组件层无障碍缺口，由 DSH 原生修）；不改弹窗自身提交/导航逻辑；不占用全局 S 键（弹窗未开即不拦截）。

## Decisions

### D1: 复用既有命令注册 + 捕获监听，不新增机制

`keyboard.ask-submit` 走既有 `tryRegister` + `defaultsFor('KeyS')` + `regions: ['page','editable']` + `modals: ['sidebar']`；desktop 动作走既有捕获监听的 `KeyS` 分支（字母键可靠到达 renderer，同 `KeyI`）。web 走 registry resolve。

**Rationale**：与 Alt+I 同构，零新机制。**Alternatives considered**：为 S 单独建一套监听——被否，违反"复用既有机制"，且会与既有捕获监听重复注册。

### D2: 主按钮定位用语义 `<footer>` + 最后一个"文本按钮"，避开 CSS Module 哈希

`submitPrimaryButton()` 谓词：
1. `document.querySelector('[data-question-key] footer')` 不存在 → 返回 null（弹窗未开）。
2. 否则取该 footer 内所有 `button`，过滤为 `isVisible && !disabled && textContent.trim() !== ''`，取**最后一个**；无匹配 → 返回 null。

**Rationale**：CSS Module 把 `css.footer`/`css.footerActions` 哈希成 `ggehTG_*` 类（读构建产物确认），字面类不可选；但 `<footer>` 是语义标签，构建产物为字面 `jsx('footer', ...)`，标签名稳定。footer 内 DOM 顺序固定（pager → footerActions），但**仅取"最后一个 button"不够**——review 卡片（回看已答题）只有 pager 无提交按钮，会误选 pager 的"下一页"。故加文本判别：pager prev/next 是纯图标（子元素只有 Icon，无文本），跳过/提交是有文本的文字按钮，`textContent` 过滤后剩 `[skip, submit]`、取末位即主按钮；review 卡片过滤后为空 → Alt+S 正确不动作（而非翻页）。判别器用 DOM 自身内在的 `textContent`，不用 CSS Module 类名（哈希）也不用 `aria-label`（由外部 primitives `Button` 添加、无法检查其内部实现）——都是 DOM-self 事实，最稳。**Alternatives considered**：`aria-label` 有无——primitives Button 本体不可达，无法确认它内部是否自动加 aria-label，脆弱，被否；`variant="primary"` 选择器——Button 无稳定 data 属性；`:last-child`——太脆。用 footer + 文本按钮末位最稳。

### D3: `.click()` 复用 DSH 自身 `continueFlow`

主按钮定位到后 `.click()`，复用弹窗自身 `onClick=continueFlow`（非末题前进、末题提交）。本插件不重复实现提交状态机，与 `openSessionAt`/选项选中同一哲学。

### D4: disabled 守卫前置

`submitPrimaryButton()` 对 disabled 主按钮返回 null（不点击、不 `preventDefault`）。因 disabled button 的 `.click()` 本就不触发，但显式守卫使语义清晰，且避免误报 handled。

## Risks / Trade-offs

- **`<footer>` 内"最后一个文本按钮"为 DSH 内部 DOM 结构**，版本升级可能变更 → 缓解：谓词全程防御性（footer 不存在 / 无文本按钮 / disabled → 返回 null 回落），结构变更仅退化为"弹窗场景不生效"，不破坏其他行为；spec 已锚定契约。
- **Alt+S 与 DSH 其他全局键潜在冲突** → 缓解：`tryRegister` conflict 机制兜底，冲突时降级 `Shift+Alt+S` 不阻断；弹窗未开时完全不拦截 S。
- **busy 提交中重复按 Alt+S** → disabled 守卫拦截（busy 时 disabled），无误提交。

## Migration Plan

改动仅在 `client.js`，随 `dsh.client.immediately` 生效，无数据迁移。回滚：revert 该提交，无状态残留。

## Open Questions

（无——a2 范围已由用户拍板排除。）
