# desktop-executor-hints Specification

## Purpose

在 desktop shell 内提供一个捕获阶段 DOM keydown 监听作为唯一可靠的字母动作执行路径，并在按住快捷键修饰键时于每个目标上叠加半透明编号提示角标、在修饰键释放或和弦完成后隐藏，同时以 shell.overlay slot 的注册作为模块成功加载的信号。

## Requirements

### Requirement: Desktop MUST 用捕获阶段 DOM 监听执行字母动作

在 desktop 运行时，本分系统 SHALL 注册一个捕获阶段（`capture: true`）的 `window` keydown 监听，当 `gestureMatches` 通过且 `event.code` 存在时执行动作——`KeyI` 调 `focusComposerEl(findComposer())`、`Digit1`..`Digit9` 调 `openSessionAt(ctx, index)`——并在动作被处理后 `preventDefault()` + `stopPropagation()`。此监听是 desktop 内 plain Alt 组合唯一可靠的接收路径。

#### Scenario: Alt+I 触发聚焦输入框

- **WHEN** desktop 下捕获监听收到 `code === 'KeyI'` 且手势匹配的 keydown
- **THEN** 调用 `focusComposerEl(findComposer())`，成功则 `preventDefault` + `stopPropagation`

#### Scenario: Alt+数字触发会话切换

- **WHEN** desktop 下捕获监听收到 `code` 为 `Digit1`..`Digit9` 且手势匹配的 keydown
- **THEN** 调用 `openSessionAt(ctx, 对应索引)`，成功则 `preventDefault` + `stopPropagation`

#### Scenario: 手势不匹配的按键被忽略

- **WHEN** 捕获监听收到 `shiftKey` 为真或 `altKey` 为假的 keydown
- **THEN** `gestureMatches` 返回 false，监听不执行任何动作

### Requirement: 手势匹配 MUST 按运行时区分修饰键组合

`gestureMatches(ctx, event)` SHALL 要求 `altKey` 为真且 `shiftKey` 为假；在此基础上 desktop 接受 Alt 单独（可含 primary），web 则额外要求 `metaKey` 或 `ctrlKey` 为真。键位选择依据：desktop 用单一 primary 修饰符（macOS 为 Cmd、Windows/Linux 为 Ctrl）因为 Cmd+数字的 keydown 正常派发而 Alt+数字在 macOS 是死键；web 用 primary+Alt 因为裸 primary 在 web 被保留。

#### Scenario: desktop 下 Alt 组合匹配

- **WHEN** desktop 下收到 `altKey:true, shiftKey:false` 的 keydown（无论 metaKey/ctrlKey）
- **THEN** `gestureMatches` 返回 true

#### Scenario: web 下要求 primary+Alt

- **WHEN** web 下收到 `altKey:true` 但 `metaKey` 与 `ctrlKey` 均为假的 keydown
- **THEN** `gestureMatches` 返回 false

#### Scenario: Shift 参与的组合不匹配

- **WHEN** 收到 `shiftKey:true` 的 keydown
- **THEN** `gestureMatches` 返回 false

### Requirement: 按住修饰键时 MUST 在每个目标上显示编号角标

提示覆盖层 SHALL 在 `active` 为真时为每个目标绘制半透明编号角标——`I` 标注输入框、`1`..`9` 标注前 9 个可见会话行——角标定位在目标左上角、`pointerEvents:none`、极高 z-index；`active` 为假时 SHALL 不渲染任何角标（避免 targets 有值时角标永久残留）。

#### Scenario: 按住修饰键时显示角标

- **WHEN** 修饰键按住且手势匹配的 keydown 到达
- **THEN** 设置 targets 与 `active=true`，为输入框、前 9 个可见会话行绘制编号角标

#### Scenario: 未激活时不渲染角标

- **WHEN** `active` 为 false
- **THEN** `ShortcutHints` 返回 null，不渲染任何角标

#### Scenario: 角标与切换动作行序一致

- **WHEN** 覆盖层枚举会话行目标
- **THEN** 使用与 `openSessionAt` 相同选择器与可见性过滤并 `slice(0,9)`，保证角标编号与实际切换一致

### Requirement: 角标 MUST 在修饰键释放或和弦完成后隐藏

覆盖层 SHALL 在 Alt 键释放时隐藏角标，并额外在非修饰键释放时也隐藏（因 Alt+数字经原生桥派发时 macOS 跳过正常 Alt keyup，仅靠 Alt 释放会让角标卡住）；切换动作完成后 SHALL 通过模块级 `requestHide()` 确定性隐藏；窗口 `blur` 时 SHALL 隐藏。

#### Scenario: Alt 释放隐藏角标

- **WHEN** 收到 `key` 为 Alt 的 keyup
- **THEN** 设置 `active=false` 隐藏角标

#### Scenario: 非修饰键释放兜底隐藏

- **WHEN** 收到 `isModifierKey` 为假（如数字键）的 keyup
- **THEN** 设置 `active=false` 隐藏角标

#### Scenario: 切换动作后确定性隐藏

- **WHEN** `openSessionAt` 成功点击会话行
- **THEN** 调用模块级 `requestHide()` 立即隐藏角标，不等待可能被吞掉的 Alt keyup

#### Scenario: 窗口失焦隐藏

- **WHEN** window 触发 `blur`
- **THEN** 设置 `active=false` 隐藏角标

### Requirement: 激活期间 MUST 响应滚动与缩放重算角标位置

覆盖层 SHALL 监听 `scroll`（捕获）与 `resize`，并在 `active` 为真时重算 targets 以跟随目标当前位置；这些监听 SHALL 只注册一次并通过 `activeRef` 读取当前可见性，避免每次切换重新订阅。

#### Scenario: 激活时滚动重算角标

- **WHEN** `active` 为真时 window 触发 `scroll`
- **THEN** 重新 `findTargets()` 更新角标位置

#### Scenario: 未激活时滚动不重算

- **WHEN** `activeRef.current` 为假时触发 `scroll`
- **THEN** 不重算 targets

### Requirement: overlay slot 注册 MUST 作为模块加载成功的信号

覆盖层 SHALL 通过 `ctx.slots.inject('shell.overlay', ...)` 注册，且 MUST 是 `apply()` 中第一个注册的步骤，使其在 `shell.overlay` 中的存在成为本模块已加载且 `apply()` 已运行的可信信号。

#### Scenario: overlay 先于命令注册

- **WHEN** `apply()` 执行各 setup 步骤
- **THEN** `shell.overlay` 的注入注册先于快捷键命令注册与 desktop 监听

#### Scenario: overlay 存在即证明模块已加载

- **WHEN** 宿主检查 `shell.overlay` 中是否存在 `keyboard-shortcuts-hints`
- **THEN** 该条目存在即表明模块已成功加载并执行了 `apply()`

### Requirement: 覆盖层目标定位 MUST 防御缺失元素

覆盖层枚举目标时，`push` 对每个候选元素 SHALL 先做 `isVisible` 检查再入列，对 null 或不可见元素跳过，使角标只标注实际可见的目标。

#### Scenario: 跳过不可见目标

- **WHEN** 某候选元素为 null 或不可见
- **THEN** 不将其加入 targets

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
