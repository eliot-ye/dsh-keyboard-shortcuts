# ask-popup-digit-select 任务

关键链（critical chain）：1.1 谓词实现 → 2.1 三执行点接线 → 2.2 角标分支 → 3.1 语法/加载自检 → 3.2 手动端到端验证。全为串行（后续依赖前序产出的 `askPopupTargets()`），无并行支流，故关键链 = 全任务序列。

project buffer（tier-small，表 1 critical-buffer 行 = 20% project buffer）：关键链估算 ≈ 115min（1.1:30 + 2.1:40 + 2.2:20 + 3.1:10 + 3.2:15）→ buffer ≈ 23min，预留约 25min。

## 1. 统一谓词实现

- [x] 1.1 在 `client.js` 新增 `askPopupTargets()`：存在 `[data-question-key]` 且当前可见 `[data-option-row]` 有可选选项按钮时返回 `{buttons, pick(index)}`（`pick` 对第 index 个选项按钮调 `.click()`，disabled/locked 返回 false，成功后确定性隐藏角标），否则返回 `null`；复用现有 `isVisible`。**验证**：`node --check client.js` exit 0；读回确认语义与 design D1/D2 一致（谓词返回 null 回落、`.click()` 复用弹窗 `choose`、pick 后 `requestHide()`）。

## 2. 接线三执行点与角标

- [x] 2.1 在 web/desktop 共用的 registry `resolve`（`keyboard.session-1..3`，`index < 3` 分支）、desktop 捕获 DOM 监听（`digit >= 0 && digit < 3`）两处调用点，统一前置 `askPopupTargets()` 判断：命中则 `pick(index)` 并按结果返回 handled/blocked 或 preventDefault+stopPropagation（desktop 监听），未命中回落 `openSessionAt`；IME 组合中跳过（`event.isComposing || keyCode === 229`）。**验证**：grep 确认 registry resolve（client.js:418）与 desktop 监听（client.js:488）均调用同一 `askPopupTargets()`，web/desktop 无判定分叉；`node --check` exit 0。
- [x] 2.2 在覆盖层 `findTargets()` 首调 `askPopupTargets()`：命中→目标为当前题选项按钮、角标标 `1..N`；未命中→保留既有输入框 `I` + 会话 `1..9`。**验证**：grep 确认角标（client.js:330）与 `pick` 使用同一 `askPopupTargets()`，`node --check` exit 0。

## 3. 验证

- [x] 3.1 语法与加载自检：`node --check client.js` exit 0；`factory` id `dsh-keyboard-shortcuts`（client.js:45）与插件 `name` 未变、`apply()` 第一步仍为 overlay 注册（client.js:290 `safely('overlay')` 先于 client.js:400 首个 `tryRegister`），baseline"overlay 先于命令注册"契约不破。**验证**：命令 exit code 0，grep 确认 factory id 与 overlay 顺序无改动。
- [x] 3.2 手动端到端验证（编程性准备 + 用户目测验收）：在 DSH web client 加载改动后 bundle，用 `ask_user_question` 发起含单选与多选题的弹窗，依次按 Alt+1/2/3；关闭弹窗后再按 Alt+1/2/3。**验证字段（人工目测，非独立 task）**：单选选中即前进、末题选中不提交、多选 toggle 不跳；角标在弹窗打开时标选项、关闭时标会话；弹窗关闭后数字键仍切会话。此条 task 主体是"加载 bundle 并准备验证场景"（编程性：reload page / 触发 ask），人工观察结果作为该 task 的验证字段，不单列为 task。**已完成（2026-11-18 用户目测验收通过）**：Alt+1/2/3 在弹窗打开时选中选项，单选自动前进、末题不提交、多选 toggle 不跳；角标弹窗打开标选项、关闭标会话；弹窗关闭后数字键仍切会话——预期行为模型四条全部验证通过。

### 系统级边界验证记录（apply 步骤 6.2，tier-small 冒烟级）

- 6.2 实测 ask 弹窗真实 DOM，**抓到定位器缺陷**：`button.option` 字面类选择器在 CSS Module 下失效（`css.option` 构建后为哈希类 `ggehTG_option`，非字面 `option`）。属任务内定位器缺陷（行为契约不变），已直修：选项按钮改按 ARIA role 定位（`button[role="radio"], button[role="checkbox"]`），避开 CSS Module 哈希；实测确认每个 `[data-option-row]` 内选项按钮（有 role）在前、展开说明按钮（无 role）在后，`row.querySelector` 按 role 唯一命中选项按钮。
- **设计回写**：design D2、shortcut-core spec、desktop-executor-hints spec、tasks.md 已将 `button.option` 表述回写为"按 role 定位选项按钮"（client.js 同步，client.js:67）。行为契约不变，仅定位器细节。
- `data-question-key` / `data-option-row` 为字面 data 属性，构建产物中确认保留（grep `dsh-client-ui-user-questions/lib/client.js`），可安全选择——弹窗开/关检测路径已验证。

### 验证边界登记

- 已跑且绿：`node --check` 语法、`openspec validate`（valid:true）、三执行点 + 角标调用同一谓词（grep）、CSS Module 选择器失效根因定位与直修、字面 data 属性在构建产物保留确认。
- 未跑（需浏览器目测，交任务 3.2）：Alt+1/2/3 实际选中弹窗选项、单选自动前进/末题不提交/多选 toggle 的运行时行为、角标随弹窗开/关切换的视觉确认、弹窗关闭后数字键回落会话切换。风险：静态验证覆盖了定位器与接线正确性，但"点击选项后弹窗 `choose` 的实际响应"需人工目测——补跑条件：用户在 DSH web client 发起 `ask_user_question` 后按 Alt+1/2/3 观察即可。
