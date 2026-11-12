# bundle-manifest Specification

## Purpose

定义 keyboard-shortcuts 作为 DSH 插件 bundle 的对外清单与加载契约——它如何把自己插入宿主 profile 的 loader 树、暴露哪些可导入入口、以及 Host 半边为何为空。

## Requirements

### Requirement: Bundle MUST 通过 patch 行插入宿主 loader 树

bundle 的清单 SHALL 声明一条 `cordis.patch.yml` patch，把 id 为 `keyboard-shortcuts`、名为 `dsh-keyboard-shortcuts`（= package name）、`config: {}` 的插件行 `insert` 进当前 profile 的 loader 树；宿主据此在页面加载时实例化本插件。

插件行 `name` 与 client factory 注册 id 都 SHALL 等于 package name `dsh-keyboard-shortcuts`：宿主按 package name 的图行 id 加载客户端脚本，并在 materialize 时以同一 id 查找已注册 factory（`client-modules` 的 `arrive`/`materialize`）。任一 id 与 package name 不符（例如带 `@local/` 前缀），factory 即无法被找到，entry 以 "loaded without registering" / "no registered factory" 失败，`apply()` 不执行。

#### Scenario: 宿主加载 profile 时插入插件行

- **WHEN** DSH 应用 `cordis.patch.yml` 到当前 profile 的 loader 树
- **THEN** loader 树中出现一条 `id: keyboard-shortcuts` / `name: 'dsh-keyboard-shortcuts'` / `config: {}` 的插件行

#### Scenario: client factory 以 package name 注册

- **WHEN** 页面执行 client.js 并调用 `window.__ModuleLoader__.load`
- **THEN** 注册的 `id` 为 `dsh-keyboard-shortcuts`，与 package name 一致，宿主得以 materialize 并运行 `apply()`

#### Scenario: 插件 config 为空

- **WHEN** 宿主以默认方式加载本插件
- **THEN** 插件接收到的 `config` 为空对象，不要求任何用户配置即可工作

### Requirement: 包导出 MUST 暴露固定的五个入口

`package.json` 的 `exports` 与 `files` SHALL 固定暴露五个入口——`.`(index.js)、`./client`(client.js)、`./locale/*.json`、`./icon`(icon.svg)——且 `files` 白名单与之对应，使打包只含这些文件。

#### Scenario: 解析各导出路径

- **WHEN** 宿主或打包器解析 `dsh-keyboard-shortcuts` 的任一导出
- **THEN** `.` 映射到 `index.js`、`./client` 映射到 `client.js`、`./locale/*.json` 映射到 `locale/*.json`、`./icon` 映射到 `icon.svg`

#### Scenario: 打包白名单与导出一致

- **WHEN** `npm pack` 按 `files` 打包
- **THEN** 产物仅含 `index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`

### Requirement: client MUST 由 manifest 声明为立即注入的 web 客户端

manifest 的 `dsh.client` 段 SHALL 声明 `platform: web`、`immediately: true`，并把 `./client` 连同 `dsh-client-shortcuts`、`dsh-client-ui-workspace`、`dsh-client-ui-conversation` 一并列入 `inject`，使 client.js 在页面加载时立即以 web 客户端身份运行并预置其依赖模块。

#### Scenario: 页面加载时立即注入 client

- **WHEN** 宿主按 `dsh.client` 段装配 web 客户端
- **THEN** `./client` 以 `immediately: true` 在页面加载时立即执行，而非按需懒加载

#### Scenario: 预置 client 依赖的宿主模块

- **WHEN** 宿主解析 client.js 的 `require` 依赖
- **THEN** `@deepseek-ai/dsh-client-shortcuts`、`@deepseek-ai/dsh-client-ui-workspace`、`@deepseek-ai/dsh-client-ui-conversation` 已在注入列表中可供 require

### Requirement: Host 半边 MUST 为无操作以满足 `.` 导出

`index.js` SHALL 导出一个 `apply()` 空函数——因为本能力完全是 web UI 关注点（client.js 内的捕获阶段 keydown 监听），Host 半边无需注册任何东西，仅用于满足 bundle 的 `.` 导出。

#### Scenario: 宿主调用 Host 半边的 apply

- **WHEN** 宿主在 Node/Host 侧调用 `index.js` 导出的 `apply()`
- **THEN** 函数立即返回、不注册任何宿主能力、不抛错
