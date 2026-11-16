# Changelog

All notable changes to this bundle are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Changelog entries are written by hand; the release flow itself is documented in
[`​.github/workflows/README.md`](./.github/workflows/README.md).

## [1.0.0] - 2026-11-16

### Added

- Global keyboard shortcuts for DeepSeek Harness (DSH):
  - `keyboard.session-1` .. `keyboard.session-9` — jump to the Nth visible
    sidebar session.
  - `keyboard.focus-composer` — focus the message composer.
- Commands are registered in DSH's own shortcut registry (`ctx.shortcuts`), so
  they appear in the shortcut reference UI, take part in conflict detection, and
  can be reassigned from DSH's settings.
- Numbered hint badges drawn over each target while the shortcut modifier is
  held, hidden on release / chord completion / window blur.
- Dual execution paths so the shortcuts fire reliably on both runtimes: the
  registry on Web, and a capture-phase DOM listener plus the command `resolve`
  on Desktop.
- Web client (`client.js`) is injected immediately on page load.

## [Unreleased]

### Changed

- Documentation: corrected the CI/release notes, which described `npm run
  typecheck` and `npm test` steps that do not exist (the bundle is plain JS with
  no `scripts` section, `tsconfig.json`, or test suite). Added this changelog.

[Unreleased]: https://github.com/eliot-ye/dsh-keyboard-shortcuts/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/eliot-ye/dsh-keyboard-shortcuts/releases/tag/v1.0.0
