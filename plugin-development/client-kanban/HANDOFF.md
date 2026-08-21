# Client Kanban handoff

Last updated: 2026-08-20

## Current state

Client Kanban is implemented and prepared as a `1.0.0` release candidate. The source of truth is this directory; files under `.obsidian/plugins/client-kanban/` are generated deployment copies and must not be edited by hand.

Automated verification currently passes:

- 6 Vitest files and 53 tests pass.
- The strict TypeScript check passes.
- The production esbuild bundle succeeds.
- The runtime assets are `main.js`, `manifest.json`, and `styles.css`.

The project uses pnpm `10.12.4`. `pnpm-lock.yaml` is authoritative; the npm lockfile was removed.

## Release-readiness changes

- Plugin and manifest version raised to `1.0.0`.
- Manifest author and description completed.
- `versions.json` maps plugin `1.0.0` to Obsidian `1.5.3`.
- An MIT `LICENSE` was added.
- The README now covers installation, privacy, support, and licensing.
- `.github/workflows/release.yml` tests, builds, and creates a GitHub release containing the three runtime assets when a numeric version tag is pushed.

## Test locally first

Follow the complete automated, local Obsidian, regression, and release-asset instructions in [`TESTING.md`](TESTING.md). The currently installed copy may still be version `0.1.0`, so build and deploy the `1.0.0` candidate before manual testing.

## Publication blocker and next steps

Obsidian requires the plugin files to be at the root of a dedicated public GitHub repository. This plugin currently lives inside the `obsidan_vault` repository, so that repository cannot be submitted directly as the plugin repository.

Remaining work:

1. Create an empty public repository, recommended name `Xchosa/client-kanban`.
2. Publish this directory as the root of that repository, preserving source files and `.github/workflows/release.yml`.
3. Push the default branch.
4. Tag the tested commit exactly `1.0.0` and push the tag.
5. Confirm the workflow creates release `1.0.0` with individual `main.js`, `manifest.json`, and `styles.css` attachments.
6. Sign in at `community.obsidian.md`, link the owning GitHub account, add the plugin, and resolve any automated review feedback.

The GitHub CLI was not available in the working environment, and the Community Directory submission is tied to the owner's Obsidian account. Those external steps have not been performed.

## Repository hygiene

There are unrelated working-tree changes elsewhere in the vault. Do not include them in a plugin release or discard them while preparing the standalone repository. The untracked file `plugin-development/client-kanban/Kanban-1786546085705.md` is not part of the plugin and should not be copied into the standalone repository.
