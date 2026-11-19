# desktop-executor-hints Delta

## ADDED Requirements

### Requirement: Desktop 捕获监听 MUST 在弹窗打开时优先选中弹窗选项

desktop 捕获 DOM 监听对 `Digit1..3` SHALL 与 registry `resolve` 共用同一"弹窗是否打开"谓词：ask 弹窗打开且当前问题有可选选项时 SHALL 选中第 n 个选项（点击对应选项按钮，按 `role="radio"`/`"checkbox"` 定位）并 `preventDefault()` + `stopPropagation()`；弹窗未打开时 SHALL 执行 `openSessionAt(ctx, index)` 切换会话；IME 组合进行中 SHALL 跳过不执行。

#### Scenario: 弹窗打开时 Alt+数字选中选项

- **WHEN** desktop 下捕获监听收到 `Digit1..3`、手势匹配、非 IME 组合，且 ask 弹窗打开、当前问题有第 n 个可见选项
- **THEN** 调用"选中第 n 个选项"（点击对应选项按钮），成功则 `preventDefault` + `stopPropagation`

#### Scenario: 弹窗未开时 Alt+数字触发会话切换

- **WHEN** desktop 下捕获监听收到 `Digit1..3`、手势匹配、非 IME 组合，且 ask 弹窗未打开
- **THEN** 调用 `openSessionAt(ctx, 对应索引)`，成功则 `preventDefault` + `stopPropagation`

#### Scenario: IME 组合中跳过

- **WHEN** desktop 下捕获监听收到手势匹配的 keydown 但 IME 组合进行中
- **THEN** 不执行任何动作

### Requirement: 弹窗打开时提示角标 MUST 标注当前问题选项

ask 弹窗打开且手势匹配时，提示覆盖层 SHALL 在当前问题的可见选项按钮上绘制编号角标（第 n 个选项标 `n`），而非标注会话行；弹窗未打开时 SHALL 按既有语义标注输入框与第 1-9 个会话行。角标 SHALL 与选项选中动作使用同一批目标元素与顺序，保证数字与实际选中一致。

#### Scenario: 弹窗打开时角标标注选项

- **WHEN** ask 弹窗打开且手势匹配的 keydown 到达
- **THEN** 覆盖层在当前问题的可见选项按钮上绘制 `1..N` 编号角标，不标注会话行

#### Scenario: 弹窗未开时角标标注会话与输入框

- **WHEN** ask 弹窗未打开且手势匹配的 keydown 到达
- **THEN** 覆盖层按既有语义为输入框标 `I`、前 9 个可见会话行标 `1..9`

#### Scenario: 角标与选项选中使用同一批目标

- **WHEN** 覆盖层枚举弹窗选项目标
- **THEN** 使用与"选中第 n 个选项"相同的选择器与可见性过滤，保证角标数字与 Alt+数字对应同一选项
