# shortcut-core Delta

## ADDED Requirements

### Requirement: ask 弹窗打开时 Alt+S MUST 点击提交/下一题主按钮

ask 弹窗打开时，命令 `keyboard.ask-submit`（默认 `Alt+S`）SHALL 点击弹窗主按钮（footer 内最后一个**文本按钮**，按 `textContent` 非空判别以排除纯图标的翻页按钮；`variant="primary"`）复用弹窗自身提交流程——非末题为"下一题"、末题为"提交"。主按钮 `disabled`（提交中 / 未作答 / 末题未满足提交条件）时 SHALL 不动作且不 `preventDefault`；弹窗处于 review 状态（footer 只有翻页按钮、无提交按钮）时 SHALL 不动作（不误翻页）；弹窗未打开时 SHALL 无任何动作（不拦截 S 键），避免污染全局。

#### Scenario: 弹窗打开时 Alt+S 点击主按钮

- **WHEN** ask 弹窗打开、主按钮可见且未 disabled，`keyboard.ask-submit` 的 resolve 被触发
- **THEN** 点击主按钮执行提交/前进，返回 `{status:'handled'}`，不 `preventDefault` 全局 S 键

#### Scenario: 主按钮 disabled 时无动作

- **WHEN** ask 弹窗打开但主按钮 disabled（如提交中或未作答）
- **THEN** 不点击、返回未处理，不 `preventDefault`，交由用户手动处理

#### Scenario: review 状态无提交按钮时不误翻页

- **WHEN** ask 弹窗处于 review 状态，footer 内只有纯图标的翻页按钮、无文本提交按钮
- **THEN** 过滤文本按钮结果为空，Alt+S 不动作、不误点翻页按钮

#### Scenario: 弹窗未打开时无动作

- **WHEN** ask 弹窗未打开，`keyboard.ask-submit` 的 resolve 被触发
- **THEN** 返回未处理，不 `preventDefault`，S 键交还浏览器默认行为

#### Scenario: web 与 desktop 行为一致

- **WHEN** 同一 ask 弹窗状态下，web 与 desktop 分别触发 `keyboard.ask-submit`
- **THEN** 两者都点击主按钮，无执行路径分叉
