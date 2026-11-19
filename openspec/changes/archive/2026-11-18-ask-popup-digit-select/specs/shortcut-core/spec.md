# shortcut-core Delta

## ADDED Requirements

### Requirement: 数字键 MUST 在 ask 弹窗打开时优先选中弹窗选项

当 DOM 中存在 ask 弹窗容器（`[data-question-key]`）且当前问题有可选选项时，`keyboard.session-1..3` 的 registry `resolve`（web 与 desktop）SHALL 优先执行"选中当前问题第 1..3 个选项"，而非切换会话；仅当弹窗未打开或当前问题无可选选项时，数字键 SHALL 回落为既有的会话切换行为。数字到选项的映射 SHALL 按文档顺序对应当前问题中可见的选项按钮，且 SHALL 通过点击选项按钮复用弹窗自身的选择处理（单选选中即前进、多选 toggle、末题不提交）。选项按钮 SHALL 按 ARIA role（`radio`/`checkbox`）定位——其 `className` 为 CSS Module 哈希、非字面类，不能用类名选择。

#### Scenario: 弹窗打开时数字键选中选项

- **WHEN** ask 弹窗打开、当前问题有第 n 个可见选项，`keyboard.session-<n>`（n≤3）的 resolve 被触发
- **THEN** 点击第 n 个可见选项按钮（`role="radio"`/`"checkbox"`）执行选中，不调 `openSessionAt`

#### Scenario: 弹窗未打开时回落为会话切换

- **WHEN** ask 弹窗容器不存在，`keyboard.session-<n>` 的 resolve 被触发
- **THEN** 按既有语义执行 `openSessionAt`，行为与改动前一致

#### Scenario: 当前问题无可选选项时回落

- **WHEN** ask 弹窗容器存在但当前问题没有可选选项，`keyboard.session-<n>` 的 resolve 被触发
- **THEN** 回落为会话切换，不点击任何选项

#### Scenario: 单选选中即前进、末题不自动提交

- **WHEN** 当前问题为单选且 Alt+数字选中其第 n 个选项
- **THEN** 非末题时选中并自动前进到下一题；末题时仅选中、不自动提交

#### Scenario: 多选 toggle 不跳题

- **WHEN** 当前问题为多选且 Alt+数字选中其第 n 个选项
- **THEN** 该选项勾选状态被 toggle，弹窗停留当前题

#### Scenario: 数字匹配可见选项顺序

- **WHEN** 解析当前问题的选项按钮
- **THEN** 第 n 个映射到文档顺序中第 n 个可见选项按钮

#### Scenario: web 与 desktop 弹窗打开时行为一致

- **WHEN** 同一 ask 弹窗状态下，web 与 desktop 分别触发 `keyboard.session-<n>`（n≤3）
- **THEN** 两者都执行选中第 n 个选项，无执行路径分叉
