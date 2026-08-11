# Client Kanban Plugin Design

## Goal

Build a small, standalone Obsidian plugin that treats Markdown files as Kanban cards. Each client remains an independent Markdown note, and a YAML property in that note determines its board column.

The first board will use the notes in `SaleTest`, but the source folder, stage property, columns, and displayed fields must be configurable per board.

## Repository and deployment layout

Keep the plugin source inside this vault repository but separate from Obsidian's installed plugin bundle:

```text
plugin-development/client-kanban/
  src/
  tests/
  tools/deploy.sh
  manifest.json
  package.json

.obsidian/plugins/client-kanban/
  main.js
  manifest.json
  styles.css
```

`plugin-development/client-kanban/` is the source of truth. The deployment script copies only compiled runtime assets into `.obsidian/plugins/client-kanban/`. Generated plugin files are not edited by hand.

## Board configuration

A board is a normal Markdown note marked and configured through YAML frontmatter:

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

Configuration is local to each board note. Multiple boards may point to different folders and define different stage properties, columns, and card fields.

The board view validates its configuration before loading clients. Column labels and stage values are exact, case-sensitive strings in the first version. Column names must be non-empty and unique.

## Client note model

Every Markdown file directly inside `source_folder` is considered a client unless it is marked as a Client Kanban board.

Example client note:

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

Structured values used by the board live in YAML. Detailed client information, contact history, and free-form notes remain in the Markdown body.

The card title uses `client_name`. If that property is absent or empty, it falls back to the filename without the `.md` extension. Fields listed in `card_fields` are displayed in their configured order. Missing or empty display fields are omitted.

## Discovery and column assignment

The plugin scans only direct children of the configured source folder. Recursive discovery is outside the first-version scope.

The plugin excludes:

- The current board note when it is inside the source folder.
- Any other Markdown file whose frontmatter contains `client_kanban: true`.
- Non-Markdown files and subfolders.

For every discovered client, the plugin reads the property named by `stage_property`:

- A value exactly matching a configured column places the client in that column.
- A missing or empty value places the client in **Uncategorized**.
- An unknown value also places the client in **Uncategorized**, while preserving the unknown source value until the user moves the card.

**Uncategorized** is a built-in column and is not written into the configured `columns` list.

## Board interaction

Cards show the client title and the configured read-only YAML fields. The first version does not support inline editing.

Clicking a card opens its source Markdown note in Obsidian. Dragging a card to a configured column updates only the configured stage property in that client's frontmatter. Dragging a card to **Uncategorized** removes the stage property rather than storing the literal value `Uncategorized`.

The board reacts to relevant Obsidian vault and metadata events so that creating, renaming, deleting, or modifying a client note refreshes the view. Event handling must ignore unrelated vault changes and coalesce rapid relevant events to avoid redundant full scans.

## Architecture

The plugin has four units with narrow responsibilities:

### Board configuration

Reads board-note frontmatter, applies defaults, and returns either a validated configuration or user-facing validation errors. It does not scan client files or render UI.

### Client repository

Discovers client files, reads their cached frontmatter, and performs safe stage-property updates through Obsidian's `FileManager.processFrontMatter` API. It does not decide visual placement.

Before writing after a drag, it resolves the file again by path and processes its current frontmatter. This prevents a stale card object from replacing unrelated edits made after the board was rendered.

### Board model

Transforms validated configuration and client records into ordered columns and cards. It owns title fallback, displayed-field selection, stage matching, and Uncategorized assignment. It has no dependency on rendered DOM elements.

### Board view

Renders the board, connects drag-and-drop and click behavior, reports configuration and mutation errors, and subscribes to relevant vault events. It delegates data interpretation and writes to the other units.

## Data flow

```text
Board note frontmatter
        |
        v
Validate board configuration
        |
        v
Discover direct Markdown children of source_folder
        |
        v
Read client frontmatter and build the board model
        |
        v
Render columns and cards
        |
        v
Drag card to a column
        |
        v
Process current client frontmatter and change only stage_property
        |
        v
Relevant Obsidian metadata event refreshes the board
```

## Failure handling

- If `source_folder` is missing from configuration, the board displays a configuration error.
- If the configured folder does not exist, the error includes its vault-relative path.
- Empty or duplicate column names prevent the board from loading and identify the invalid value.
- A missing display property is omitted without failing the card.
- If the source file has been renamed or deleted before a drop completes, the write is cancelled and an Obsidian notice explains that the source is unavailable.
- If a stage update fails, the view refreshes from disk so the card returns to its source-of-truth column, and an Obsidian notice reports the failure.
- Unknown stage values are never silently normalized or overwritten merely by opening or refreshing a board.

## Initial scope

Included:

- Configurable source folder per board.
- One card per direct-child Markdown file.
- Configurable stage property and ordered columns.
- Built-in Uncategorized column.
- Configurable read-only card fields.
- Client-name fallback to filename.
- Dragging between columns, including removal of the stage through Uncategorized.
- Opening the client note by clicking its card.
- Automatic refresh after relevant file and metadata changes.
- Use of Obsidian APIs compatible with desktop and mobile.

Excluded from the first version:

- Inline property editing.
- Recursive folder discovery.
- Filtering, saved views, or user-selectable sorting.
- Manual ordering within a column.
- Task parsing or task cards.
- Nested card content from Markdown body sections.
- Creating or deleting clients from the board.
- Migrating Task List Kanban configuration automatically.

## Testing strategy

Unit tests cover:

- Parsing valid configuration.
- Rejecting missing folders, empty columns, and duplicate columns.
- Excluding board notes and subfolder contents during discovery.
- Client-title fallback and omitted empty card fields.
- Exact stage-to-column assignment.
- Missing, empty, and unknown stages going to Uncategorized.
- Moving to a configured column changes only `stage_property`.
- Moving to Uncategorized removes only `stage_property`.
- A failed write triggers a refresh and preserves the source state.
- Event filtering recognizes create, rename, delete, and metadata changes relevant to the configured source folder.

Integration seams around Obsidian APIs are wrapped so repository and model behavior can be tested with fakes. Manual smoke testing in Obsidian uses `SaleTest` and verifies:

1. `StadtOffenburg.md` and `Stadtwerke.md` appear as cards.
2. Their configured properties render in the expected order.
3. Clicking each card opens the correct note.
4. Dragging changes only `sales_stage` in the correct file.
5. Moving to Uncategorized removes `sales_stage` without changing other frontmatter or body content.
6. External edits, file creation, renaming, and deletion refresh the board.
7. Invalid board configuration produces actionable feedback.
8. The built plugin loads and operates on desktop and mobile Obsidian APIs without desktop-only dependencies.

## Success criteria

The design is successful when a user can create a board note for any vault folder, see each direct-child client note as one card, understand key client fields at a glance, open the complete client note, and move the client through the sales process while the client's YAML remains the sole source of truth for stage placement.
