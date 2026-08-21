# Testing Client Kanban

## Automated tests

From the vault root, install the locked dependencies and run the complete test suite:

```sh
cd plugin-development/client-kanban
corepack pnpm@10.12.4 install --frozen-lockfile
corepack pnpm@10.12.4 test
```

The expected result is 6 passing test files and 53 passing tests.

## Build and install the test version

Create the production bundle and deploy it into this vault:

```sh
corepack pnpm@10.12.4 build
./tools/deploy.sh
```

This copies the following generated files into `.obsidian/plugins/client-kanban/`:

- `main.js`
- `manifest.json`
- `styles.css`

Do not edit the deployed copies directly. Make changes in `plugin-development/client-kanban/`, rebuild, and deploy again.

The previously installed copy may still be version `0.1.0`. After deployment, `.obsidian/plugins/client-kanban/manifest.json` should report version `1.0.0`.

## Load the plugin in Obsidian

1. Restart Obsidian or run **Reload app without saving** from the command palette.
2. Open **Settings → Community plugins**.
3. Enable **Client Kanban**. If it was already enabled, disable and enable it again.
4. Open `SaleTest/Kanban View.md`.
5. Run **Client Kanban: Open current note as Client Kanban** from the command palette. Alternatively, right-click the note and select **Open as Client Kanban**.

The test board is configured through this frontmatter:

```yaml
---
client_kanban: true
source_folder: SaleTest
stage_property: sales_stage
columns:
  - Erstgespraech
  - FollowUp_Send
  - Zweitgespraech
  - Naechster_Betreuungstermin
card_fields:
  - contact_person
  - last_contact
  - next_appointment
---
```

## Core smoke test

1. Confirm the four configured stages and **Uncategorized** are visible.
2. Confirm direct Markdown files in `SaleTest` appear as cards.
3. Confirm configured fields appear only when they contain values.
4. Click a card and confirm its source Markdown note opens.
5. Drag a card into another configured stage.
6. Open the source note and confirm only its `sales_stage` property changed.
7. Drag the card into **Uncategorized**.
8. Confirm `sales_stage` was removed while all other frontmatter and Markdown content remained intact.

Dragging cards intentionally changes the sample notes. Commit or copy them before testing if their current values need to be preserved.

## Regression checklist

1. Drag a card into an empty column using a mouse or trackpad.
2. Repeat using touch input when testing on a mobile device.
3. Open two Client Kanban boards side by side and confirm cards cannot move between boards.
4. Give a client an unknown stage value and confirm it appears under **Uncategorized** without changing the stored value.
5. Drop that card within the same **Uncategorized** list and confirm its unknown value is preserved.
6. Remove `client_kanban: true` from an open board note and confirm an actionable configuration error replaces the board.
7. Restore the property and confirm the board returns.
8. Rename the board note and confirm the view refreshes and survives an Obsidian restart.
9. Create, edit, rename, and delete a direct client note and confirm the board refreshes.
10. Change an unrelated note or a note in a nested folder and confirm the board does not refresh unnecessarily.
11. Temporarily configure a missing `source_folder` and confirm the error includes the missing vault-relative path.
12. Temporarily add an empty or duplicate column and confirm the board reports a configuration error.

## Test a release manually

To simulate installation from a GitHub release, create an empty directory named `client-kanban` under a separate test vault's `.obsidian/plugins/` directory. Copy only these files into it:

```text
main.js
manifest.json
styles.css
```

Restart that Obsidian instance, enable Client Kanban, create a configured board note and some client notes, and repeat the core smoke test. This verifies that the release assets work without any source files or development dependencies.

## Reporting a failure

Record the following information:

- Obsidian version
- Client Kanban version
- Operating system or mobile platform
- Board frontmatter with private information removed
- Exact steps that reproduce the problem
- Any error shown in Obsidian's developer console

