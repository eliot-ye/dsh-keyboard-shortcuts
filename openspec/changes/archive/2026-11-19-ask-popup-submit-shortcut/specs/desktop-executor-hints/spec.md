# desktop-executor-hints Delta

## ADDED Requirements

### Requirement: Desktop 捕获监听 MUST 在弹窗打开时执行 Alt+S 提交主按钮

desktop 捕获 DOM 监听对 `KeyS` SHALL 与 registry `resolve` 共用同一"弹窗是否打开"谓词：ask 弹窗打开且主按钮（footer 内最后一个文本按钮）可见未 disabled 时 SHALL 点击主按钮（复用弹窗自身提交流程）并 `preventDefault()` + `stopPropagation()`；弹窗未打开、主按钮 disabled 或处于 review 状态（无提交按钮）时 SHALL 不动作；IME 组合进行中 SHALL 跳过不执行。

#### Scenario: 弹窗打开时 Alt+S 提交主按钮

- **WHEN** desktop 下捕获监听收到 `KeyS`、手势匹配、非 IME 组合，且 ask 弹窗打开、主按钮可见未 disabled
- **THEN** 点击主按钮，成功则 `preventDefault` + `stopPropagation`

#### Scenario: 弹窗未开或主按钮 disabled 时不动作

- **WHEN** desktop 下捕获监听收到 `KeyS`、手势匹配，但弹窗未打开或主按钮 disabled
- **THEN** 不执行动作，不 `preventDefault`

#### Scenario: IME 组合中跳过

- **WHEN** desktop 下捕获监听收到手势匹配的 `KeyS` keydown 但 IME 组合进行中
- **THEN** 不执行任何动作

### Requirement: 弹窗打开时提示角标 MUST 标注提交主按钮

ask 弹窗打开且手势匹配时，提示覆盖层 SHALL 在主按钮（footer 内最后一个 `button`）上绘制 `S` 角标，而非标注会话行；弹窗未打开时 SHALL 按既有语义标注输入框与第 1-9 个会话行。角标 SHALL 与 Alt+S 提交动作使用同一目标元素，保证标注与实际点击一致。

#### Scenario: 弹窗打开时角标标注主按钮

- **WHEN** ask 弹窗打开且手势匹配的 keydown 到达
- **THEN** 覆盖层在主按钮上绘制 `S` 角标，不标注会话行

#### Scenario: 弹窗未开时角标标注会话与输入框

- **WHEN** ask 弹窗未打开且手势匹配的 keydown 到达
- **THEN** 覆盖层按既有语义为输入框标 `I`、前 9 个可见会话行标 `1..9`

#### Scenario: 角标与提交动作使用同一目标

- **WHEN** 覆盖层枚举弹窗主按钮目标
- **THEN** 使用与"Alt+S 点击主按钮"相同的选择器与可见性过滤，保证角标位置对应同一按钮
