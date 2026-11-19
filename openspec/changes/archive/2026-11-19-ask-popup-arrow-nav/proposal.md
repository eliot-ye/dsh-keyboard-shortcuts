# ask-popup-arrow-nav 提案

## Why

ask 弹窗目前可全键盘完成（Alt+1..3 选中 + Alt+S 提交），但**依赖"位置 = 数字"的助记**——用户得先数选项是第几个再按对应数字，不如方向键直觉。且多选题的"取消选中"Alt+1..3 做不到（再按同键是重选而非取消）。

↑/↓ 在选项间移动焦点 + Space 选中/取消选中（单选选中、多选切换），让弹窗操作符合通用键盘直觉，彻底脱离鼠标与数字助记。

## What Changes

在 `client.js` desktop 捕获监听新增 **ArrowUp / ArrowDown / Space** 三个分支（普通键，无 Alt 手势）：ask 弹窗打开**且焦点不在输入框**时，↑/↓ 在当前题的可见选项间移动焦点、Space 选中/取消选中当前聚焦选项。焦点在输入框（textarea）或弹窗未开或 IME 组合中时，Arrow/Space 原样放行（不劫持打字）。

**键位语义**（用户拍板）：
- ↑/↓ → 焦点移到上一个/下一个可见选项（纯 DOM `.focus()`，不改选中状态）
- Space → 选中/取消选中当前聚焦选项：单选 radio 设选中、多选 checkbox 切换勾/取消（`.click()` 复用原生 `choose` + `aria-checked`）
- Enter 保持原生"提交"（QuestionComposer 已内置 `onKeyDown: Enter → submitDrafts`，不冲突）

### 焦点守卫（关键，决定不误劫持输入框打字）
捕获监听处理 Arrow/Space 前逐级守卫：
1. ask 弹窗开着（`[data-question-key]` 存在）；
2. **焦点不在 textarea**（`document.activeElement` 非 `<textarea>`）——否则放行给打字；
3. 非 IME 组合（复用既有 `isComposing` 守卫）。

任一不满足 → 不 `preventDefault`、原样放行。

### 导航定位（避开 CSS Module 哈希，复用既有谓词）
- 可见选项按钮复用 `askPopupTargets()`（按 ARIA role `button[role=radio]|checkbox` 定位，与 Alt+1..3 同源）；
- ↑/↓ 移焦点：取当前 `document.activeElement` 在可见选项列表中的索引，±1 后 `.focus()`；**当前焦点不在选项上时，↓ 落到第一个可见选项、↑ 落到最后一个**（提供初始锚点）；
- Space 选中：对当前聚焦的选项按钮 `.click()`。

## Capabilities

**Modified Capabilities**：
- `desktop-executor-hints` —— 捕获监听增加 ArrowUp/ArrowDown/Space 分支（焦点守卫 + 选项导航 + Space 切换）。

**Added Capabilities**：无。

## Impact

- **改哪些文件**：仅 `client.js`。
- **改哪些接口**：desktop 捕获监听增加 Arrow/Space 分支与焦点守卫；不新增 registry 命令（Arrow/Space 需焦点上下文、低频、非全局切换类）。
- **新增外部依赖**：无（仍纯 DOM）。
- **哪些模块会受影响**：仅 keyboard-shortcuts bundle。
- **是否需要迁移**：不需要。
- **对既有路径的回归**：焦点在输入框或弹窗未开时 Arrow/Space 完全放行，不干扰打字与任何既有行为；Alt+I / Alt+S / Alt+1..3 全部不变。

## 系统工程影响评估

服务主基调第 3 条"从定性到定量的综合集成"。

- **影响哪些分系统**：`desktop-executor-hints`（捕获监听 Arrow/Space 分支 + 焦点守卫）。仅在一个既有分系统内做增量，不新增分系统。
- **整体性能预期变化**：无可测性能变化——捕获监听每次 keydown 多三次 `event.code` 相等判断（O(1)）、命中时一次可见选项枚举（key-down 低频，可忽略）。用户视角：弹窗内方向键导航 + 空格选中零额外等待，脱离鼠标与数字助记。
- **这是局部优化还是全局协调**：局部动作（弹窗内键盘导航），复用全局既有捕获监听机制，非引入新协调路径。
- **局部优化对全局失调的风险**：中——**普通键（无 Alt 手势）劫持打字**是主要风险。缓解：三级焦点守卫（弹窗开 + 焦点非 textarea + 非 IME），任一不满足即放行；且 Arrow 是纯焦点移动（可逆）、Space 仅在焦点已落在选项上时才 `.click()`（焦点不在选项上 Space 走浏览器默认）。风险点与缓解——①焦点误判劫持 textarea 方向键/空格 → 守卫 2 按 `activeElement` 判；②Space 误触发选项 → 仅当焦点已在选项按钮上才 click；③与 Alt+1..3 焦点跳转冲突 → 两者都改选中状态走同一 `askPopupTargets`，互不排他。
- **预期行为模型**：ask 弹窗打开、焦点不在输入框时——按 ↓ 焦点落到第一个可见选项、再按 ↓ 逐个下移、↑ 上移；按 Space 选中当前聚焦选项（单选选中、多选切换勾/取消）；焦点在输入框时 ↑/↓/Space 原样放行（打字）；弹窗未开时放行。验证：apply 后在 web client 发起 `ask_user_question`，先点输入框打字按 ↑/↓/Space 确认不被劫持；再 Tab/点击移出输入框后按 ↓ 看焦点落到选项、Space 切换勾选。

## 实际系统工程影响 vs 预期（archive 复盘）

tier-small 必填 2 字段 + 补充字段。

### 实际影响的分系统

**实际**：仅 `desktop-executor-hints`（捕获监听 ArrowUp/ArrowDown/Space 分支 + 三级焦点守卫 + 导航环）。与预期一致——未新增分系统，未触碰 DSH 原生 `QuestionComposer`（b1 未做），未改任何 DSH 内部 API。

### 预期行为模型验证

**模型成立，预期行为模型已验证**（偏差一项，已按用户拍板修正模型，见下）。

| 预期 | 实际 | 结果 |
|---|---|---|
| 弹窗开、焦点不在输入框 ↓ 落第一个选项 | 用户目测确认 | ✅ |
| 连续 ↓ 逐个下移、↑ 上移 | 用户目测确认 | ✅ |
| Space 选中/切换（单选选中、多选切换） | 用户目测确认 | ✅ |
| 焦点在输入框 ↑/↓/Space 原样放行（打字） | 用户目测确认 | ✅ |
| 弹窗未开放行 | 用户目测确认 | ✅ |
| **导航到输入框**（预期模型未列） | 用户反馈"↓/↑ 不能移到输入框"→ 拍板本 change 补：首选项↑、末选项↓ 回输入框；输入框为导航**目标而非源**（焦点在输入框仍放行打字） | 🔶 模型修正 |

**模型修正建议**（闭合综合集成循环，供下一 propose 预测）：ask 弹窗的 ↑/↓ 导航环应把文本输入框作为可到达的目标——首选项↑、末选项↓ 落到输入框；但焦点在输入框时方向键/空格必须保留打字（守卫放行），即输入框"可被到达、不被方向键离开"。此修正已沉淀进 design D3 与 desktop-executor-hints spec。

### 补充字段

- **预期之外的副作用**：无。用户第一轮复测后主动提"↓/↑ 不能移到输入框"，属预期模型未覆盖的自然扩展（非副作用），已并入本 change。
- **scenario→test 覆盖账本**：未产出（proposal 已声明 tier-small 无可执行测试面，跳过）。行为验证由 tasks 3.2 手动端到端承载（用户两轮确认全绿）。
- **需求权衡处置**：无矛盾标注。a1（普通键）+ Space toggle 语义 + 末选项↓回输入框均在 explore/apply 由用户拍板。
- **td-cut 收敛**：design.md「roving tabindex 砍角」经用户确认**接受为长期现状**（YAGNI——本 change 不追求完整 ARIA radio group，方向键导航已满足弹窗键盘操作；升级路径记录在案）。
- **与既有架构/风格的遵循关系**：**遵循**为主——复用捕获监听、IME 守卫、`isVisible`、`askPopupTargets`（与 Alt+1..3 同源）、`.click()` 复用 DSH 自身 `choose`/`continueFlow` 哲学、防御性降级（弹窗不存在/无选项即放行）。**一处明确偏离**：本 change 让 bundle 处理**普通键（无 Alt 手势）**，打破此前"所有快捷键走 Alt+手势"的纯度。理由：用户明确拍板要裸键直觉（↑/↓ 导航、Space 选中是键盘用户肌肉记忆）；且以三级焦点守卫把"误劫持打字"风险降到可接受。此偏离经 `constraints` 的 `references/human-in-loop.md` 让用户确认（explore 阶段 a1 拍板），在此显式记录。

- **跳过架构 review**：tier-small 且未引入新分系统切分或偏离既有架构——仅在 desktop-executor-hints 捕获监听内增加按键分支，按 `td-propose` 步骤 7 跳过完整架构 review，做一行自检即可。
- **caller impact 分析（跳过说明）**：无四类变更点——未改动公共符号、装配点、包边界或外部契约；捕获监听新增分支是纯增量，焦点在输入框/弹窗未开路径行为不变（放行）。tier-small 提醒性质，跳过。
- **scenario→test 覆盖账本（跳过说明）**：本 bundle 无可执行测试面（无 tests/ 无测试框架，见 README「Development」节），tier-small 仅当 `applyRequires` 含 specs 且含可执行测试面时强制——此处不满足，跳过；行为验证由 tasks 末条端到端手动验证承载。
