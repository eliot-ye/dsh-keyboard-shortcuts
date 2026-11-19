# desktop-executor-hints Delta

## ADDED Requirements

### Requirement: ask 弹窗内 ↑/↓ MUST 在选项间移动焦点

ask 弹窗打开且焦点不在输入框（textarea）且非 IME 组合时，捕获监听对 `ArrowDown`/`ArrowUp` SHALL 把焦点移到当前题的下一个/上一个可见选项按钮（纯 DOM `.focus()`，不改选中状态）。当前焦点不在任何选项上时，`ArrowDown` SHALL 落到第一个可见选项、`ArrowUp` SHALL 落到最后一个可见选项（提供初始锚点）。**弹窗的文本输入框是导航目标而非源**：从第一个选项按 `ArrowUp`（或最后一个选项按 `ArrowDown`）SHALL 把焦点移回输入框；焦点在输入框内时 `ArrowDown`/`ArrowUp` SHALL 原样放行（打字光标移动优先，不劫持）。无文本输入框（纯选择问题）时两端 SHALL 钳制不循环。弹窗未开、焦点在 textarea 或 IME 组合中时 SHALL 原样放行（不 `preventDefault`），不劫持打字。

#### Scenario: 弹窗打开且焦点不在输入框时 ↓ 落到第一个选项

- **WHEN** ask 弹窗打开、`document.activeElement` 非 textarea、非 IME，捕获监听收到 `ArrowDown` 且当前焦点不在选项上
- **THEN** 焦点移到第一个可见选项按钮，`preventDefault`

#### Scenario: 连续 ↓ 逐个下移、↑ 上移

- **WHEN** 焦点已在某可见选项上，捕获监听收到 `ArrowDown`/`ArrowUp`
- **THEN** 焦点移到相邻的下一个/上一个可见选项，不改选中状态

#### Scenario: 首选项 ↑ 或末选项 ↓ 回输入框

- **WHEN** 焦点在第一个可见选项上收到 `ArrowUp`（或在最后一个选项上收到 `ArrowDown`），且弹窗存在文本输入框
- **THEN** 焦点移回输入框（textarea），不改选中状态

#### Scenario: 无输入框时两端钳制

- **WHEN** 弹窗为纯选择问题（无文本输入框），焦点在最后一个选项上收到 `ArrowDown`（或在第一个选项上收到 `ArrowUp`）
- **THEN** 焦点停在原位（钳制），不滚动页面

#### Scenario: 焦点在输入框时放行

- **WHEN** ask 弹窗打开但 `document.activeElement` 是 textarea，捕获监听收到 `ArrowDown`/`ArrowUp`
- **THEN** 不处理、不 `preventDefault`，方向键交还输入框打字

#### Scenario: 弹窗未开时放行

- **WHEN** ask 弹窗未打开，捕获监听收到 `ArrowDown`/`ArrowUp`
- **THEN** 不处理、不 `preventDefault`

### Requirement: ask 弹窗内 Space MUST 选中/取消选中当前聚焦选项

ask 弹窗打开且焦点在某个可见选项按钮上且非 IME 组合时，捕获监听对 `Space` SHALL `.click()` 该选项复用弹窗自身 `choose` 处理——单选 radio 设为选中、多选 checkbox 切换勾/取消（依 `aria-checked`）。焦点不在选项按钮上（如在 textarea 或页面别处）时 Space SHALL 原样放行；IME 组合中 SHALL 跳过。

#### Scenario: 焦点在选项上时 Space 选中/切换

- **WHEN** ask 弹窗打开、焦点在可见选项按钮上、非 IME，捕获监听收到 `Space`
- **THEN** `.click()` 该选项，单选选中、多选切换勾/取消，`preventDefault`

#### Scenario: 焦点不在选项上时 Space 放行

- **WHEN** ask 弹窗打开但焦点在 textarea 或页面别处，捕获监听收到 `Space`
- **THEN** 不处理、不 `preventDefault`，空格交还浏览器默认行为

#### Scenario: IME 组合中跳过

- **WHEN** 捕获监听收到手势匹配的 Arrow/Space keydown 但 IME 组合进行中
- **THEN** 不执行任何动作
