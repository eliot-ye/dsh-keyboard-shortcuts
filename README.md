# Keyboard shortcuts

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

## Files

- `index.js` — Host half; a no-op `apply()` that only satisfies the `.` export
  (the capability is entirely a Web UI concern).
- `client.js` — the Web UI behavior: command registration, the Desktop capture
  listener, and the hint-badge overlay.
- `cordis.patch.yml` — inserts the plugin row into the profile's loader tree.
- `locale/*.json` — Plugin Manager title/description (`meta.title` /
  `meta.description`).
- `icon.svg` — the bundle icon.
- `openspec/` — per-subsystem specifications.

> The `factory` id registered in `client.js` and the plugin row `name` in
> `cordis.patch.yml` must both equal the package name `dsh-keyboard-shortcuts`;
> DSH's module loader resolves the client factory by that id. See
> `openspec/specs/bundle-manifest/spec.md`.
