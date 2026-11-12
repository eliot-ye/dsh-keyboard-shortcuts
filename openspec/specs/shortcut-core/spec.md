# shortcut-core Specification

## Purpose

在 DSH 快捷键注册表中注册真实的全局快捷键命令（切到第 N 个侧边栏会话、聚焦输入框），并在 web 与 desktop 两种运行时之间选择正确的执行路径，使动作在两种环境下都能可靠触发且不重复执行。

## Requirements

### Requirement: MUST 向注册表注册 10 条命令

本分系统 SHALL 通过 `ctx.shortcuts.register` 注册 10 条命令——`keyboard.session-1`..`keyboard.session-9`、`keyboard.focus-composer`——每条都带双语 `label`、`aliases`、按 profile 的 `defaults`、`regions: ['page','editable']`、`modals: ['sidebar']`，使其出现在 DSH 的快捷键参考 UI 中并参与冲突检测。

#### Scenario: 注册会话切换命令

- **WHEN** `apply()` 执行注册步骤
- **THEN** 注册 `keyboard.session-1`..`keyboard.session-9` 九条命令，id 形如 `keyboard.session-<n>`，默认键位为 `Digit<n>`

#### Scenario: 注册聚焦输入框命令

- **WHEN** `apply()` 执行注册步骤
- **THEN** 注册 `keyboard.focus-composer`（默认 `KeyI`）

#### Scenario: 命令带区域与模态作用域

- **WHEN** 任一命令被注册
- **THEN** 其 `regions` 为 `['page','editable']`、`modals` 为 `['sidebar']`

#### Scenario: 单条命令冲突不阻断其余注册

- **WHEN** 某条命令因冲突或保留键位导致 `register` 抛错
- **THEN** 仅该条命令注册失败并 `console.warn`，其余命令继续注册

### Requirement: 默认键位 MUST 按 profile 区分 primary 修饰符

`defaultsFor(code)` SHALL 为每个物理键生成按 profile 区分的默认值——desktop 三平台用 `['alt']`，web:macos 与 web:windows 用 `['primary','alt']`，并 SHALL 省略 `web:linux`（其允许列表只接受 Slash/Comma/Period，给 primary+Alt 默认值会让 `register` 抛错）。

#### Scenario: desktop 平台默认值

- **WHEN** 为某键生成 desktop 默认值
- **THEN** `desktop:macos`、`desktop:windows`、`desktop:linux` 三者的 modifiers 均为 `['alt']`

#### Scenario: web 平台默认值

- **WHEN** 为某键生成 web 默认值
- **THEN** `web:macos` 与 `web:windows` 的 modifiers 均为 `['primary','alt']`

#### Scenario: web:linux 省略

- **WHEN** 查找 `web:linux` 的默认值
- **THEN** 结果为 undefined，即该 profile 不预置此键位默认值

### Requirement: Web 运行时 MUST 由注册表 resolve 直接执行动作

在 web 运行时，命令的 `resolve` SHALL 直接执行对应动作——`keyboard.session-<n>` 调 `openSessionAt(ctx, n-1)`、`keyboard.focus-composer` 调 `focusComposerEl(findComposer())`——返回 `{status:'handled', run}` 或在目标缺失/已聚焦时返回 `{status:'blocked'}` 或 `{status:'pass'}`。

#### Scenario: web 上切换到存在的会话

- **WHEN** web 环境下 `keyboard.session-<n>` 的 resolve 被调用且第 n 个可见会话存在
- **THEN** 返回 `{status:'handled', run}`，run 执行点击该会话行

#### Scenario: web 上切换到不存在的会话

- **WHEN** web 环境下第 n 个可见会话不存在
- **THEN** 返回 `{status:'blocked', reason}` 说明没有第 n 个会话

#### Scenario: web 上聚焦输入框

- **WHEN** web 环境下 `keyboard.focus-composer` 的 resolve 被调用且可见输入框存在
- **THEN** 返回 `{status:'handled', run}`，run 聚焦输入框；若焦点已在输入框内则返回 `{status:'pass'}`

#### Scenario: web 上聚焦输入框

- **WHEN** web 环境下 `keyboard.focus-composer` 的 resolve 被调用且可见输入框存在
- **THEN** 返回 `{status:'handled', run}`，run 聚焦输入框；若焦点已在输入框内则返回 `{status:'pass'}`

### Requirement: Desktop 运行时 MUST 由注册表 resolve 驱动数字切换、由 DOM 监听执行字母动作

在 desktop 运行时，`keyboard.session-<n>` 的 resolve SHALL 直接执行 `openSessionAt`（数字键的 keydown 被原生桥拦截、到不了 renderer DOM，只能靠原生桥回调 resolve）；`keyboard.focus-composer` 的 resolve SHALL 返回 `{status:'pass'}`（字母键 keydown 会到达 DOM，交由 desktop 捕获监听执行），以避免双重触发。

#### Scenario: desktop 上数字切换由 resolve 执行

- **WHEN** desktop 环境下 `keyboard.session-<n>` 的 resolve 被原生桥调用
- **THEN** resolve 直接调 `openSessionAt(ctx, n-1)` 执行切换，而非返回 pass

#### Scenario: desktop 上字母命令让行给 DOM 监听

- **WHEN** desktop 环境下 `keyboard.focus-composer` 的 resolve 被调用
- **THEN** 返回 `{status:'pass'}`，实际执行交给 desktop 捕获阶段 DOM 监听

### Requirement: 会话顺序 MUST 与侧边栏可见展示顺序一致

`sessionRowIds()` 与 `openSessionAt` SHALL 从渲染出的行（`[data-row-key^="session:"]`）按文档顺序读取会话 id，且 MUST 过滤掉不可见行，使编号与提示角标及屏幕顺序一致、绝不抓取其他/折叠 workspace 的隐藏行。

#### Scenario: 编号匹配可见行顺序

- **WHEN** 解析当前侧边栏会话列表
- **THEN** 返回的 id 列表为文档顺序中所有可见 `session:` 行的 id，跳过不可见行

#### Scenario: 提示角标与切换动作使用同一批行

- **WHEN** 提示覆盖层枚举目标行
- **THEN** 使用与 `openSessionAt` 相同的选择器与可见性过滤，保证角标数字与 Alt+数字对应同一行

### Requirement: 动作 MUST 复用 DSH 自身的交互路径

`openSessionAt` SHALL 通过 `row.click()` 打开第 N 个会话（复用侧边栏自身的 onClick→onOpen 路径，含可能的 workspace 切换），而非直接调用 service 的前置条件。

#### Scenario: 点击会话行复用侧边栏打开逻辑

- **WHEN** `openSessionAt` 在第 index 个可见行存在时被调用
- **THEN** 对该行调用 `row.click()` 并返回 true；随后触发 `requestHide()` 隐藏角标

#### Scenario: 目标位置无会话

- **WHEN** `openSessionAt` 在第 index 个可见行不存在时被调用
- **THEN** 返回 false，不执行任何点击

### Requirement: 运行时检测 MUST 防御性降级

`isDesktop(ctx)` SHALL 优先读 `ctx.shortcuts.runtime === 'desktop'`，不可用时降级为 `document.documentElement.dataset.platform !== undefined`，再不可用返回 false；`getService(ctx, name)` SHALL 优先用 `ctx.get(name)` 并在异常时降级为属性访问，绝不假设访问器必然存在。

#### Scenario: 通过 shortcuts.runtime 判定 desktop

- **WHEN** `ctx.shortcuts.runtime` 为字符串 `'desktop'`
- **THEN** `isDesktop` 返回 true

#### Scenario: runtime 缺失时降级

- **WHEN** `ctx.shortcuts.runtime` 不是字符串
- **THEN** `isDesktop` 改用 `documentElement.dataset.platform` 判定

#### Scenario: 服务获取防御性降级

- **WHEN** `ctx.get(name)` 不存在或抛错
- **THEN** `getService` 回退到 `ctx[name]` 属性访问

### Requirement: 注册表条目与监听器 MUST 在 dispose 时全部注销

`apply()` SHALL 把每个 `register` 返回的 off 函数与各 `ctx.effect`/slot 注销函数收进 `disposers`，并在返回的 `dispose()` 中逐个 best-effort 调用，使插件卸载时不残留命令与监听器。

#### Scenario: 卸载时注销全部条目

- **WHEN** 插件 dispose 被调用
- **THEN** 所有已注册命令的 off 函数与已注册的 effect/监听器注销函数都被调用，单个失败不阻断其余
