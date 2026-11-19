# ask-popup-submit-shortcut 任务

关键链（critical chain）：1.1 主按钮谓词 → 2.1 命令注册 + 三点接线 → 2.2 角标 → 3.1 自检 → 3.2 手动端到端验证。全串行（后续依赖前序产出的 `submitPrimaryButton()`），无并行支流，关键链 = 全任务序列。

project buffer（tier-small，表 1 = 20% project buffer）：关键链估算 ≈ 85min（1.1:20 + 2.1:30 + 2.2:15 + 3.1:5 + 3.2:15）→ buffer ≈ 17min，预留约 20min。

## 1. 主按钮定位谓词

- [x] 1.1 在 `client.js` 新增 `ASK_SUBMIT_BUTTON()`/`submitPrimaryButton()` + `clickSubmitPrimary()`：`document.querySelector('[data-question-key] footer')` 存在时，取 footer 内按钮过滤为 `isVisible && !disabled && textContent.trim()!==''`、取最后一个，无匹配/disabled 返回 null；`clickSubmitPrimary` 对命中按钮 `.click()` 并确定性隐藏角标。复用 `isVisible`。**验证**：`node --check client.js` exit 0；读回确认避开了 CSS Module 哈希（用语义 `<footer>` + 文本按钮末位，非类名/非 aria-label），与 design D2 一致。

## 2. 命令注册与接线

- [x] 2.1 注册 `keyboard.ask-submit`（`defaultsFor('KeyS')`，`regions:['page','editable']`，`modals:['sidebar']`）：resolve 弹窗打开且主按钮未 disabled 时 `.click()` 返回 handled，否则 blocked 无动作；desktop 捕获监听加 `KeyS` 分支（复用 `clickSubmitPrimary()`，命中则 preventDefault+stopPropagation）。**验证**：grep 确认 registry resolve（client.js:509）与 desktop 监听（client.js:562）均调用同一 `clickSubmitPrimary()`，无 web/desktop 判定分叉；`node --check` exit 0。
- [x] 2.2 角标 `findTargets()`：弹窗打开时在主按钮标 `S`（复用 `submitPrimaryButton()` 同一目标），未开保留输入框 I + 会话 1..9。**验证**：grep 确认角标（client.js:387）与提交动作使用同一 `submitPrimaryButton()`；`node --check` exit 0。

## 3. 验证

- [x] 3.1 语法与加载自检：`node --check client.js` exit 0；`factory` id `dsh-keyboard-shortcuts`（client.js:45）与插件 `name` 未变、`apply()` 第一步仍为 overlay 注册（client.js:346 `safely('overlay')` 先于 client.js:447 首个 `tryRegister`），baseline"overlay 先于命令注册"契约不破。**验证**：命令 exit 0，grep 确认 factory id 与 overlay 顺序无改动。
- [x] 3.2 手动端到端验证（编程性准备 + 用户目测）：web client 加载改动后 bundle，发起 `ask_user_question`，选中后按 Alt+S；主按钮 disabled 时按 Alt+S；关闭弹窗按 Alt+S。**验证字段（人工目测）——全部通过**：① 选中后 Alt+S 前进/提交 ✅（用户答"Alt+S正常"）；② 未选中时 S 角标在**提交**位、Alt+S 无动作不误点跳过 ✅（用户答"Q1 角标在提交✓"，确认 6.2 缺陷②已修复）；③ 关弹窗后 Alt+S 无反应、不拦 S 键 ✅（用户答"Q2 关后无反应✓"）。task 主体是"加载 bundle 并准备验证场景"（编程性），人工观察作为验证字段。

### 系统级边界验证记录（apply 步骤 6.2，tier-small 冒烟级）

- 6.2 实测 footer 结构，**抓到缺陷 ①（静态）**：仅取"footer 最后一个 button"在 **review 卡片**（回看已答题，只有 pager 翻页按钮、无提交按钮）会误选 pager 的"下一页"，Alt+S 变成翻页。已直修：主按钮判别器改为"footer 内最后一个**文本按钮**"——pager prev/next 是纯图标无文本，跳过/提交是文字按钮，`textContent` 过滤后剩 `[skip, submit]`、末位即主按钮；review 卡片过滤后为空 → Alt+S 正确不动作。
- 判别器选择理由（避免踩 aria-label 坑）：先试 `!hasAttribute('aria-label')`，但跳过/提交按钮走外部 primitives `Button` 组件（vendor 不可达），无法确认其内部是否自动加 aria-label——判别器建立在外部组件内部实现上，脆弱。改用 DOM 自身内在的 `textContent`。
- 6.2 实测 footer 结构，**抓到缺陷 ②（用户端到端复现）**：主按钮"未选中时 disabled"被 `!disabled` 过滤掉 → `textContent` 末位错落到**跳过按钮**（skip 也是文字按钮）→ S 角标落在跳过上、Alt+S 误点跳过。用户实测反馈"s 角标在跳过按钮上"直接定位此缺陷。已直修：`submitPrimaryButton()` **不再按 disabled 过滤**（submit 恒为末位文本按钮，角标 S 始终标在提交位），把 disabled 判断**移到点击层 `clickSubmitPrimary()`**（未选中/提交中 disabled 时返回 false 不动作）。
- **设计回写**：design D2（"最后一个 button"→"最后一个文本按钮" + review 卡片防护 + disabled 判别移到点击层）、shortcut-core spec（补 review 状态无动作场景 + 文本按钮判别）、desktop-executor-hints spec 同步；client.js 同步（client.js:230-244）。行为契约不变（新增 review 卡片防护 + disabled 移层使契约更完整）。复核 `validate` 后：valid:true。

### 验证边界登记

- 已跑且绿：`node --check` 语法、`openspec validate`（valid:true）、三执行点 + 角标调用同一 `clickSubmitPrimary`/`submitPrimaryButton`（grep）、footer 结构核实（pager→feedback→footerActions）、pager 无文本 vs 文字按钮有文本判别、review 卡片误翻页根因定位与直修、**submit disabled 时角标错位到 skip 的根因定位与直修（disabled 判别移到点击层）**。
- 未跑 → **已全部由用户端到端验证通过**：未选中时 Alt+S 无动作且 S 角标在**提交**（非跳过）位 ✅、选中后末题 Alt+S 提交 / 非末题前进 ✅、关弹窗 Alt+S 无动作 ✅。运行时行为经人工目测确认，验证边界已闭环。
