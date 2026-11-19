# ask-popup-arrow-nav 任务

关键链（critical chain）：1.1 焦点守卫 + 导航谓词 → 2.1 捕获监听 Arrow/Space 分支 → 3.1 自检 → 3.2 端到端手动验证。全串行（后续依赖前序产出的 `askOptionNav()` 谓词），无并行支流，关键链 = 全任务序列。

project buffer（tier-small，表 1 = 20% project buffer）：关键链估算 ≈ 85min（1.1:25 + 2.1:25 + 3.1:5 + 3.2:30）→ buffer ≈ 17min，预留约 20min。

## 1. 焦点守卫与导航谓词

- [x] 1.1 在 `client.js` 新增 `askOptionNav()`（L276-316）：三级守卫（弹窗开 `[data-question-key]` + `activeElement` 非 textarea + 非 IME）不满足返回 null 放行；满足则取 `askPopupTargets().buttons`（可见选项），返回 `{move(dir), toggleActive()}`——`move` 按当前 `activeElement` 在 buttons 中的索引 ±1 移焦点（无锚点时 dir=+1 落首、-1 落末，末位钳制不滚动），`toggleActive` 对 `activeElement`（为选项按钮时）`.click()`；复用 `isVisible`/`askPopupTargets`。**验证**：`node --check client.js` exit 0；读回确认三级守卫齐全（尤其 textarea 判）与复用 `askPopupTargets`，与 design D2/D3 一致。

## 2. 捕获监听接线

- [x] 2.1 desktop 捕获监听在 `KeyS` 分支后加 `ArrowDown`/`ArrowUp`/`Space` 分支（L631-641）：调用 `askOptionNav()`，命中 `move(+1)`/`move(-1)`/`toggleActive()` 成功则 `preventDefault`+`stopPropagation`，未命中（守卫不满足/无选项）放行。顶部 `gestureMatches` 门重构（L613-614）——普通 Arrow/Space 无需 Alt 手势即通过，其余键仍走手势门。**验证**：读回 Arrow/Space 分支均调用同一 `askOptionNav()`，无重复守卫；`node --check` exit 0。

## 3. 验证

- [x] 3.1 语法与加载自检：`node --check client.js` exit 0；`factory` id `dsh-keyboard-shortcuts`（L45）与插件 `name` 未变、`apply()` 第一步仍为 overlay 注册（L408 `safely('overlay')` 先于 L509 首个 `tryRegister`）、registry 未新增命令（Arrow/Space 仅进捕获监听，`keyboard.session-n`/`ask-submit`/`focus-composer` 三命令未变）。**验证**：命令 exit 0，grep 确认 factory id / overlay 顺序 / registry 命令集无改动。
- [x] 3.2 手动端到端验证（编程性准备 + 用户目测）：web client 加载改动后 bundle，发起 `ask_user_question`；点输入框打字按 ↑/↓/Space；移出输入框按 ↓/↑/Space。**验证字段（人工目测）——全部通过（两轮）**：① 首轮：↓ 落第一个选项 ✅、连续 ↓/↑ 逐个移焦 ✅、Space 切换勾/取消 ✅、焦点在输入框不被劫持 ✅（用户答"都通过"）；② 导航环（用户反馈"↓/↑ 不能移到输入框"触发设计回写后复测）：首选项 ↑ 回输入框 ✅、末选项 ↓ 回输入框 ✅、输入框内 ↑/↓ 仍打字 ✅、Space 选中/切换 + 关弹窗后 ↑/↓ 无反应 ✅（用户答四项全✓）。task 主体是"加载 bundle 并准备验证场景"（编程性），人工观察作为验证字段。

### 系统级边界验证记录（apply 步骤 6.2，tier-small 冒烟级）

- 6.2 用 Node 模拟 `askOptionNav` 边界逻辑。**两轮**：
  - 首轮（9 用例，导航环加入前）：弹窗开+焦点在选项 ↓/↑ 移焦、焦点在 textarea → null（打字优先）、弹窗未开 → null（放行）、Space 对聚焦选项 click、Space 焦点不在选项 → 不点击返回 false、单选项 ↓ 锚定。9/9 全绿。首跑 4 FAIL 是**模拟装置 bug**（`active` 新建对象与 buttons 元素不同引用，`indexOf` 恒 -1），修正装置让 `active` 指向真实按钮元素后全绿——非代码缺陷。
  - 二轮（13 用例，导航环加入后）：新增 首选项↑回 textarea、末选项↓回 textarea、无 textarea 两端钳制、↑ option1→option0。13/13 全绿。
- 门重构验证：普通 Arrow/Space 无需 Alt 手势即通过 `gestureMatches` 门（L613-614）；其余键仍走手势门。IME 守卫（L617-618）在门后对所有键生效。
- **设计回写（apply 3.2 用户反馈驱动）**：用户测试发现"↓/↑ 移焦不能移到输入框，应该可以移到输入框"——拍板 a（本 change 补）+ 末选项 ↓ 回输入框。回写 design D3（输入框为导航目标而非源）、desktop-executor-hints spec（新增"首选项↑/末选项↓回输入框"+"无输入框钳制"场景）、client.js `askOptionNav.move`（两端越界落到 textarea，无 textarea 则钳制）。焦点在输入框时仍放行打字（D2 守卫不变），输入框可被到达、不被方向键离开。`validate` 重跑 valid:true。

### 验证边界登记

- 已跑且绿：`node --check` 语法、`openspec validate`（valid:true）、`askOptionNav` 边界模拟 13/13（两轮）、门重构 + 三分支接线（grep）、registry 命令集未变、factory id / overlay 顺序。
- 未跑（需浏览器目测，交任务 3.2 续测）：真实 DOM 里"首选项↑回输入框 / 末选项↓回输入框"焦点环、无输入框钳制。风险：静态模拟覆盖了导航环逻辑，但真实 `<textarea>` 焦点环视觉反馈需人工目测——补跑条件：用户在 DSH web client reload 后重测 ask 弹窗（重点：选项↑/↓ 能回到输入框，且输入框内方向键仍打字）。
