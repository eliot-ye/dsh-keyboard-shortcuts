# ask-popup-submit-shortcut 提案

## Why

上一 change `ask-popup-digit-select` 给 ask 弹窗选项加了 Alt+1..3 选中。用户实测发现：**提交/下一题按钮没有快捷键**——键盘用户答完最后一题后，仍必须用鼠标点"提交"按钮。

这是本 bundle 使命（"给没有快捷键的操作加快捷键"）的直接延伸，与已有 `keyboard.focus-composer`（Alt+I 聚焦输入框）完全同构。给提交按钮加快捷键后，整个 ask 弹窗可全键盘完成（选中 Alt+1..3 + 提交 Alt+S），不碰鼠标。

## What Changes

在 `client.js` 新增一条快捷键命令 `keyboard.ask-submit`（默认 `Alt+S`），绑定"点击 ask 弹窗的主按钮（提交/下一题）"。弹窗打开时按 Alt+S 等同鼠标点击主按钮；弹窗未打开时不动作（回落，不占用全局 S 键）。

**范围**（用户拍板 a1）：仅提交按钮快捷键。↑/↓ 选项导航 + Enter 模拟点击（原 a2）**不在本 change**——那是 DSH `QuestionComposer` 组件层的无障碍缺口，应由 DSH 原生修，不塞进 shortcuts bundle。

**复用既有机制**（不新增分系统）：
- 沿用 `shortcut-core` 的命令注册（`tryRegister`）+ `defaultsFor` + `regions/modals`；
- 沿用 `desktop-executor-hints` 的捕获监听（字母键 Alt+S 在 desktop 可靠到达 renderer，同 Alt+I）+ 角标覆盖层。

### 键位与手势
- desktop：`Alt+S`（字母键，捕获监听可靠接收）
- web：`Cmd/Ctrl+Alt+S`（primary+Alt，遵循 `gestureMatches` web 分支）
- `event.code === 'KeyS'`，IME 组合中跳过

### 主按钮定位（关键：避开 CSS Module 哈希）
经读 `QuestionComposer` 构建产物核实：
- popup footer 渲染为**语义 `<footer>` 标签**（`dsh-client-ui-user-questions/lib/client.js` 确认 `jsx('footer', {className: css.footer, ...})`），标签名稳定，不受 CSS Module 哈希影响；
- footer 内 DOM 顺序固定：`pager`（上一页/进度/下一页）→ `footerActions`（跳过 → **主按钮**）；
- **主按钮 = `<footer>` 内最后一个 `button`**，`variant="primary"`，`onClick=continueFlow`，末题文案"提交"、非末题"下一题"；
- `disabled` 条件：`busy !== null || !answered(draft) || (末题 && !canSubmit)`。

`submitPrimaryButton()` 谓词：`document.querySelector('[data-question-key] footer')` 存在 → 取 footer 内文本内容非空的 `button`（排除纯图标的翻页按钮）的末位即主按钮，**不按 disabled 过滤**（保证角标 `S` 恒标在提交位）；`clickSubmitPrimary()` 才判 `disabled`——disabled 时返回 false 不动作，否则 `.click()` 复用 DSH 自身 `continueFlow`。

## Capabilities

**Modified Capabilities**：
- `shortcut-core` —— 新增命令 `keyboard.ask-submit`（注册 + web/desktop resolve + 弹窗未开回落）。
- `desktop-executor-hints` —— 捕获监听增加 `KeyS` 分支；角标增加主按钮 `S` 标注。

**Added Capabilities**：无。

## Impact

- **改哪些文件**：仅 `client.js`。
- **改哪些接口**：新增命令 `keyboard.ask-submit`；desktop 捕获监听与角标 `findTargets` 增加弹窗主按钮分支。
- **新增外部依赖**：无（仍纯 DOM）。
- **哪些模块会受影响**：仅 keyboard-shortcuts bundle。
- **是否需要迁移**：不需要。
- **对既有路径的回归**：弹窗未打开时 Alt+S 无动作（不 `preventDefault`），不干扰任何既有行为；会话切换、Alt+I、Alt+1..3 全部不变。

## 系统工程影响评估

服务主基调第 3 条"从定性到定量的综合集成"。

- **影响哪些分系统**：`shortcut-core`（新增命令注册 + resolve）、`desktop-executor-hints`（捕获监听 `KeyS` 分支 + 角标 S 标注）。三者都在既有分系统内做增量，不新增分系统。
- **整体性能预期变化**：无可测性能变化——命令注册 +1（常量开销）、捕获监听每次 keydown 多一次 `event.code === 'KeyS'` 判断（O(1)）、弹窗打开时一次 DOM 查询（key-down 低频，可忽略）。用户视角：ask 弹窗全键盘完成，零额外等待。
- **这是局部优化还是全局协调**：局部动作（给一个按钮加快捷键），但**复用全局既有机制**（命令注册 + 捕获监听 + 角标），非引入新协调路径。
- **局部优化对全局失调的风险**：低。风险点与缓解——①主按钮 CSS Module 类名哈希不可选 → 已改用语义 `<footer>` + "最后一个 button"定位（标签名稳定）；②`Alt+S` 是否与 DSH 其他全局键冲突 → 经 `tryRegister` 的 conflict 机制兜底，冲突时降级为 `Shift+Alt+S` 不阻断；③弹窗未开时误触 → `submitPrimaryButton()` 弹窗不存在即返回 false，不 `preventDefault`，S 键交还浏览器。
- **预期行为模型**：ask 弹窗打开时按 Alt+S → 主按钮被点击，末题触发提交、非末题前进下一题；主按钮 disabled（如 `busy` 提交中、`!answered` 未作答）时按 Alt+S **无动作**、不误提交；弹窗未打开时按 Alt+S 无任何动作（不拦截 S 键）。按住手势修饰键时角标在主按钮上标 `S`。验证：apply 后在 web client 发起 `ask_user_question`，按 Alt+S 观察"选中即前进 / 末题提交 / 未作答无动作 / 关弹窗无动作"，角标 S 出现在主按钮上。
- **与既有架构/风格的遵循关系**：**完全遵循**，无偏离——命令走 `tryRegister` + `defaultsFor` + `regions/modals`，desktop 动作走捕获监听，弹窗开/关判定复用 `ask-popup-digit-select` 的谓词哲学（信可见 DOM），点击走 `.click()` 复用 DSH 自身路径，防御性 `isVisible`/`disabled` 过滤与 `getService` 同一约定。无新分系统切分、无新架构模式。

- **跳过架构 review**：tier-small 且未引入新分系统切分或偏离既有架构——仅在同一分系统内增加一条命令 + 一个按键分支，按 `td-propose` 步骤 7 跳过完整架构 review，做一行自检即可。
- **caller impact 分析（跳过说明）**：无四类变更点——未改动公共符号、装配点、包边界或外部契约；新增命令是纯增量，弹窗未开路径行为不变（无动作）。tier-small 提醒性质，跳过。
- **scenario→test 覆盖账本（跳过说明）**：本 bundle 无可执行测试面（无 tests/ 无测试框架，见 README「Development」节），tier-small 仅当 `applyRequires` 含 specs 且含可执行测试面时强制——此处不满足，跳过；行为验证由 tasks 末条端到端手动验证承载。

## 实际 vs 预期 复盘（archive 步骤 3，tier-small）

### 实际影响分系统
与预期一致——仅 `shortcut-core`（`keyboard.ask-submit` 命令注册 + resolve，client.js:506）+ `desktop-executor-hints`（捕获监听 `KeyS` 分支 client.js:567 + 角标 `S` 标注 client.js:396）。未新增分系统，未触碰包边界/装配点/外部契约。baseline 契约（会话切换、Alt+I、Alt+1..3、弹窗未开不拦 S）均未被破坏，用户端到端确认。

### 预期行为模型验证
**预期行为模型已验证**（apply 后用户 web client 端到端确认）：① 选中后 Alt+S 前进/提交 ✅；② 未选中时 S 角标在**提交**位、Alt+S 无动作不误点跳过 ✅；③ 关弹窗后 Alt+S 无反应、不拦 S 键 ✅。三项验证字段全绿，模型成立。

**偏差记录（模型收敛过程，非模型失败）**：预期"footer 最后一个 button = 主按钮"这一预判在两处边界失效，apply 6.2 静态 + 用户端到端各发现一处——① review 卡片只有翻页按钮，"最后 button"变"下一页"（改文本按钮末位判别）；② submit 未选中时 disabled 被 `!disabled` 过滤掉 → 错落到 skip 按钮（你复现"s 角标在跳过按钮上"，移 disabled 到点击层）。两处均已直修并回写 artifact，最终判别器"footer 内文本按钮末位 + 点击层判 disabled"是比预期更稳健的收敛结果。**下一个 propose 的模型修正**：为 DOM 结构定位写预判时，应把"目标元素可能 disabled / 缺失"与"容器内同类兄弟元素"两类边界前置纳入预判，而非假定"末位即目标"恒成立。

### 预期之外的副作用
无功能副作用。一处工程学习沉淀（见上偏差记录）。无场景回归、无性能回退。

### scenario→test 覆盖账本状态
本 change 无账本（无可执行测试面，proposal 已声明跳过）。行为验证由 tasks 3.2 手动端到端承载，三项验证字段已由用户目测确认全绿。

### 需求权衡处置
无标注"留待 archive 对照"的未决矛盾。a2（↑/↓ 导航 + Enter 模拟点击）在本 change 范围外（用户拍板排除，属 DSH 原生无障碍缺口）——非本 change 的权衡矛盾，不阻塞 archive。
