# ask-popup-arrow-nav 设计

## Context

See proposal.md - Why。现状：Alt+1..3 选中 + Alt+S 提交已让弹窗全键盘可完成，但依赖"位置 = 数字"助记，且多选无法取消选中。本 change 加 ↑/↓ 导航 + Space 选中/取消，符合键盘直觉。归属 bundle（a1，用户拍板），不修 DSH 原生（b1）。

## Goals / Non-Goals

- **Goals**：弹窗打开且焦点不在输入框时，↑/↓ 在可见选项间移焦点、Space 选中/取消当前聚焦选项；三级焦点守卫防误劫持打字。
- **Non-Goals**：不实现 roving tabindex（用原生 `.focus()` 即可，弹窗单题选项少）；不修 DSH `QuestionComposer` 原生键盘处理（b1，属 DSH 仓库，非本 bundle）；不新增 registry 命令；不改 Alt+I/S/1..3 既有行为。

## Decisions

### D1: 走 desktop 捕获监听普通键分支，不新增 registry 命令

Arrow/Space 加进既有捕获监听的 `event.code` 分支（与 `KeyI`/`KeyS` 同处）。

**Rationale**：Arrow/Space 是"焦点上下文相关"的导航键，非全局切换类动作；registry 命令（带 label/aliases、出现在帮助面板）适合"全局可发现的动作"，方向键导航不需要。字母键已证明可靠到达 renderer（Alt+I/S），普通键同理。**Alternatives considered**：Alt+↑/↓ + Alt+Space（a2）——保持 Alt 纯度但不符用户"裸键直觉"诉求，用户拍板排除；修 DSH 原生（b1）——门槛高且非本 bundle 事。

### D2: 三级焦点守卫前置，防误劫持打字

捕获监听处理 Arrow/Space 前逐级判定：
1. `document.querySelector('[data-question-key]')` 存在（弹窗开）；
2. `document.activeElement?.tagName !== 'TEXTAREA'`（焦点非输入框）；
3. 非 IME（复用既有 `isComposing || keyCode === 229`）。

任一不满足 → `return`（不 `preventDefault`，原样放行）。

**Rationale**：普通键无 Alt 手势，最大风险是劫持输入框打字。弹窗的自定义输入框是**卡片内部的 `<textarea>`**（读构建产物确认），故必须按 `activeElement` 判，不能只按"弹窗开着"判。三级守卫把"焦点误判"降到最低。**Alternatives considered**：只判弹窗开——会劫持 textarea 打字，被否。

### D3: ↑/↓ 用 `.focus()` 纯导航，Space 才改状态

↑/↓ 只 `element.focus()`（不改选中），Space 对 `document.activeElement`（当为选项按钮时）`.click()` 改选中。初始锚点：当前焦点不在选项上时，↓ 落第一个、↑ 落最后一个可见选项。

**导航环（用户拍板，apply 3.2 反馈补充）**：弹窗的文本输入框是导航的**目标**而非源——从第一个选项按 ↑（或最后一个选项按 ↓）焦点移回 `<textarea>`；但焦点在输入框内时 ↑/↓/Space 仍保留给打字（D2 守卫返回 null 放行），即输入框可被选项"到达"、不被方向键"离开"。无文本输入框（纯选择问题）时两端钳制（末位不滚动），不循环。

**Rationale**：导航与选中分离，符合标准键盘模型（方向键移动、空格切换）。焦点不在选项上时 Space 走浏览器默认，避免误触发。输入框作为导航目标而非源，避免了与"textarea 内 ↑/↓ 移动光标"的打字语义冲突（D2 守卫已挡住）。选项少（单题通常 2-4 个），无需 roving tabindex 复杂度（YAGNI）。

### D4: 复用 `askPopupTargets()` 与 `.click()`

可见选项枚举复用既有 `askPopupTargets()`（按 ARIA role 定位，与 Alt+1..3 同源）；选中走 `.click()` 复用 DSH 自身 `choose`（radio 选中、checkbox 切换 `aria-checked`）。本插件不触碰选中状态机。

## Risks / Trade-offs

- **普通键劫持打字**（主要风险）→ 三级焦点守卫（D2）；验证含"焦点在 textarea 打字按方向键/空格不被劫持"。
- **`.focus()` 对自定义按钮的可见焦点环**：选项按钮是否显示焦点环由 DSH CSS 决定，若无线索样式用户可能看不到焦点在哪 → 缓解：这是 DSH 样式层问题，本 bundle 不改 CSS；若实际焦点环不明显，后续可加 outline（记为已知上限，非本 change scope）。
- **roving tabindex 缺失导致 Tab 序未同步** → 用 `.focus()` 程序化移焦不受 Tab 序影响，功能正确；纯键盘可达性已满足，roving tabindex 属增强（YAGNI 砍角，见下）。

`td-cut:` 砍角标注：D3 未实现 roving tabindex（Tab 键进入选项组的顺序增强）。已知上限：Tab 不会自动聚焦选项组、需靠 ↓ 初始锚点进入。升级路径：若后续要完整 ARIA radio group 语义，再补 roving tabindex。非本 change scope，不阻断。

## Migration Plan

改动仅在 `client.js`，随 `dsh.client.immediately` 生效，无数据迁移。回滚：revert 该提交，无状态残留。

## Open Questions

（无——归属/键位/Space 语义均由用户拍板，初始锚点行为已在 proposal 锚定。）
