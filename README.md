# Keyboard shortcuts

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-keyboard-shortcuts.svg)](https://www.npmjs.com/package/dsh-keyboard-shortcuts)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](./package.json)

Global keyboard shortcuts for DeepSeek Harness (DSH): jump to a sidebar session
and focus the message composer, with a numbered hint badge shown while the
shortcut modifier is held.

This bundle registers **real commands** in DSH's own shortcut registry
(`ctx.shortcuts`), so the bindings appear in DSH's shortcut reference UI, take
part in conflict detection, and can be reassigned from DSH's settings.

## Commands

| Command | Desktop (macOS/Windows/Linux) | Web (macOS/Windows) |
| --- | --- | --- |
| `keyboard.session-1` .. `keyboard.session-9` | `Alt` + `1`..`9` | `Cmd/Ctrl` + `Alt` + `1`..`9` |
| `keyboard.focus-composer` | `Alt` + `I` | `Cmd/Ctrl` + `Alt` + `I` |

- **Session switching** opens the Nth sidebar session in the order DSH displays
  them (its grouping / recency / pin filter applied), by clicking the row — so it
  reuses the sidebar's own open logic, including any workspace switch. Only
  visible rows are numbered, so the badges always match what you see.
- **Focus composer** moves focus into the message composer. If focus is already
  inside it, the shortcut passes through.
- While the modifier is held, a semi-transparent numbered badge is drawn on each
  target (`I` for the composer, `1`..`9` for the first nine visible sessions) and
  hidden on release.

## Runtime notes

DSH dispatches shortcuts differently per runtime, so the bundle uses two
cooperating mechanisms:

- **Web**: the registry's DOM adapter dispatches, so commands registered via
  `ctx.shortcuts` fire directly.
- **Desktop (macOS/Windows)**: that adapter is created with `native = true` and
  returns before `shortcuts.dispatch`, so a bound chord only fires if the native
  preload bridge forwards it. The action is therefore executed by a thin
  capture-phase DOM listener (letters) and by the registered command's `resolve`
  (digits, which the native bridge intercepts before they reach the page).

On Desktop the primary modifier alone is used (`Cmd` on macOS / `Ctrl` on
Windows+Linux) because its keydown dispatches normally; on Web `primary+Alt` is
used because a bare primary is reserved there. `web:linux` is intentionally
omitted: its allow-list admits only Slash/Comma/Period, so a `primary+Alt`
default would make registration throw.

## Install

This is a local DSH bundle. From Plugin Manager, install it as a bundle pointing
at this directory (DSH links the checkout), or place it under your profile's
`node_modules`. It is enabled like any other bundle; the web client loads
immediately on page load (`dsh.client.immediately`).

## Development

This bundle is plain JavaScript (`"type": "module"`) — there is no build step,
no TypeScript, and no test suite, so `package.json` has no `scripts` section.
To try it out, install it as a local bundle (see **Install**) and reload the DSH
web client; `client.js` runs immediately on page load.

Releasing is done via npm Trusted Publishing — bump the version, push the tag,
and publish a GitHub Release. Full steps: [`.github/workflows/README.md`](.github/workflows/README.md).

Per-subsystem design details live in [`openspec/specs/`](openspec/specs/). If you
rename the package, note that the `factory` id in `client.js` and the plugin row
`name` in `cordis.patch.yml` must both equal the package name
(`dsh-keyboard-shortcuts`) — DSH resolves the client factory by that id.

## License

[MIT](./LICENSE) © Eliot. Issues and pull requests are welcome at the
[repository](https://github.com/eliot-ye/dsh-keyboard-shortcuts).
