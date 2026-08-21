# Client Kanban

Client Kanban is an Obsidian community plugin that renders Markdown notes as configurable Kanban cards. Each board reads its configuration from the board note's YAML frontmatter, and card stage changes update only that configured YAML property.

## Installation

Once Client Kanban is accepted into the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse**, search for **Client Kanban**, and select **Install**.
3. Select **Enable** after installation.

For beta testing before directory approval, download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release and place them in `<vault>/.obsidian/plugins/client-kanban/`, then reload Obsidian and enable the plugin.

## Development

Install dependencies and run the checks from this directory:

```sh
<<<<<<< HEAD
pnpm install
pnpm test
pnpm build
```

Use `pnpm dev` while developing to produce an unminified bundle. Run `./tools/deploy.sh` after a build to copy `main.js`, `manifest.json`, and `styles.css` to this vault's `.obsidian/plugins/client-kanban` directory. To deploy elsewhere, pass the target directory as its only argument:
=======
corepack pnpm install
corepack pnpm test
corepack pnpm build
```

Use `corepack pnpm dev` while developing to produce an unminified bundle. Run `./tools/deploy.sh` after a build to copy `main.js`, `manifest.json`, and `styles.css` to this vault's `.obsidian/plugins/client-kanban` directory. To deploy elsewhere, pass the target directory as its only argument:
>>>>>>> 927a330 (git hub actions + License + clean up)

```sh
./tools/deploy.sh /path/to/vault/.obsidian/plugins/client-kanban
```

See [`TESTING.md`](TESTING.md) for automated checks, local installation, the smoke test, and the complete regression checklist.

## Using a board

Build and deploy the plugin, then enable **Client Kanban** in Obsidian under **Settings → Community plugins**. Create a board note with `client_kanban: true`, then use the note's context menu command **Open as Client Kanban** (or the command palette action **Open current note as Client Kanban**). The left-ribbon **Open last Client Kanban** action reopens the last board that opened successfully, including after Obsidian restarts. Missing or invalid boards do not replace that remembered board.

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

Client notes live directly in `source_folder`. The configured stage property determines the column; missing, empty, and unrecognized stages appear in **Uncategorized**. A missing `client_name` falls back to the note filename. Configured display fields appear only when they have a value.

```yaml
---
client_name: Stadt Offenburg
sales_stage: Erstgespraech
contact_person: Max Mustermann
last_contact: 2026-08-10
next_appointment: 2026-08-20
---

# Stadt Offenburg

Detailed notes and contact history remain in the Markdown body.
```

Use the pencil action labeled **Edit board configuration** to open the current board's Markdown source in a separate tab without closing the Kanban view. The pencil remains available when configuration values are malformed, so you can correct the YAML and save it; the open Kanban view refreshes from the updated metadata. Renaming the board while its Kanban view is open updates the remembered path.

## Manual smoke checklist

After building and deploying the plugin, verify the following in Obsidian:

1. Open a configured board and confirm its direct Markdown clients render in filename order with the configured fields.
2. Click a card and confirm Obsidian opens the matching client note.
3. Drag a card to a configured column and to **Uncategorized**; confirm only the configured stage property changes or is removed.
4. Leave a configured column empty, confirm its card-list area remains visible and easy to target, and drag a card into it with both a pointer and touch input.
5. Open two Client Kanban boards side by side and confirm a card cannot be dragged from one board into the other.
6. Give a client an unknown stage, release its Uncategorized card within that same list, and confirm the unknown YAML value and repository-defined card order remain unchanged.
7. Remove `client_kanban: true` while its board view is open and confirm the view replaces the board with an actionable configuration error.
<<<<<<< HEAD
8. Click the pencil action and confirm the board Markdown opens in a separate tab while the Kanban view remains open.
9. Make `card_fields` malformed, open it with the pencil action, correct and save the YAML, and confirm the Kanban view refreshes.
10. Close the board tab, use the left-ribbon action to reopen it, restart Obsidian, and confirm the same remembered board still reopens.
11. Rename the board note while its view is open, restart Obsidian, and confirm the ribbon reopens the renamed path.
12. Create, edit, rename, and delete a direct client note and confirm the board refreshes; repeat with an unrelated or nested note and confirm it does not.
=======
8. Rename the board note while its view is open and confirm the view refreshes and survives a workspace reload at the renamed path.
9. Create, edit, rename, and delete a direct client note and confirm the board refreshes; repeat with an unrelated or nested note and confirm it does not.

## Privacy and permissions

Client Kanban works entirely inside the local Obsidian vault. It does not make network requests, collect telemetry, or require an account. It reads board and client-note frontmatter and changes only the configured stage property when a card is moved.

## Support

Report bugs and request features through the repository's GitHub Issues page. Include the Obsidian version, plugin version, platform, and a minimal example of the board frontmatter when possible.

## License

[MIT](LICENSE)
>>>>>>> 927a330 (git hub actions + License + clean up)
