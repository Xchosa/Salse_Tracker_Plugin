# Client Kanban

Client Kanban is an Obsidian community plugin that renders Markdown notes as configurable Kanban cards. Each board reads its configuration from the board note's YAML frontmatter, and card stage changes update only that configured YAML property.

## Development

Install dependencies and run the checks from this directory:

```sh
npm install
npm test
npm run build
```

Use `npm run dev` while developing to produce an unminified bundle. Run `./tools/deploy.sh` after a build to copy `main.js`, `manifest.json`, and `styles.css` to this vault's `.obsidian/plugins/client-kanban` directory. To deploy elsewhere, pass the target directory as its only argument:

```sh
./tools/deploy.sh /path/to/vault/.obsidian/plugins/client-kanban
```

## Using a board

Build and deploy the plugin, then enable **Client Kanban** in Obsidian under **Settings → Community plugins**. Create a board note with `client_kanban: true`, then use the note's context menu command **Open as Client Kanban** (or the command palette action **Open current note as Client Kanban**).

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
