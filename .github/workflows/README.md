# CI / Release workflows

Publishing is done via **npm Trusted Publishing** (OIDC), not `npm token`.
See [`npm-publish.yml`](./npm-publish.yml).

## One-time npm setup

Do this once, in a browser:

1. Enable 2FA on your npm account (`npm` → Settings → Authentication).
2. Go to https://www.npmjs.com/package/dsh-keyboard-shortcuts → **Settings → Trusted Publishing** (or **Publishing** tab, depending on the UI version) → **Add trusted publisher**.
   - GitHub owner: `eliot-ye`
   - Repository: `dsh-keyboard-shortcuts`
   - Workflow file: `npm-publish.yml`

That's it. After this, the npm registry knows that a run of `.github/workflows/npm-publish.yml` on this repo may publish the package.

No `NPM_TOKEN` secret is stored in repo settings. No OTP is entered during CI — the workflow exchanges a short-lived OIDC token with npm for a publish grant.

## How to publish a version

```bash
npm version patch      # or minor / major — bumps package.json + package-lock.json, creates a commit AND a tag
git push --follow-tags # pushes both
```

Then on GitHub:

1. **Releases** → **Draft a new release** → select the tag you just pushed (e.g. `v0.1.2`).
2. Fill in the changelog for the release notes.
3. Click **Publish release**.

Publishing the release is what triggers the workflow — you don't click a separate "Run workflow" button.

## What the workflow does

1. `actions/checkout` at the release tag
2. `actions/setup-node` with Node 24 + npm registry (no package-manager cache)
3. `npm ci`
4. `npm publish --provenance`

There is intentionally **no typecheck or test step**: this bundle is plain
JavaScript (`client.js` / `index.js`, `type: module`) with no build step, no
`tsconfig.json`, and no test suite, so `package.json` has no `scripts` section.
CI installs dependencies and publishes — nothing to compile or verify first.

## Not covered

- **Changelog generation.** Manual — kept in [`CHANGELOG.md`](../../CHANGELOG.md). If you want it automated, add `release-please` or `semantic-release`.
- **Automatic publish on tag push.** Deliberately release-driven — the GitHub Release page doubles as the changelog, and publishing the release is the intentional "ship it" click.
- **Typecheck / tests.** None exist for this bundle (see above). If you add TypeScript or a test suite, wire the commands into `npm-publish.yml` here.
- **Cross-platform builds.** This is a plain JS DSH bundle loaded by the host at runtime — no build step needed.
