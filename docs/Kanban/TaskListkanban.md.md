# Task List Kanban

## Purpose

Task List Kanban is a free, open-source Obsidian community plugin that turns Markdown tasks from an Obsidian vault into Kanban cards. Tasks remain in their original Markdown files; edits made on a board are written back to those source files.

This document is the local reference for understanding, operating, debugging, and potentially rewriting the plugin.

## Local installation

| Item | Local value |
| --- | --- |
| Plugin | Task List Kanban |
| Plugin ID | `task-list-kanban` |
| Installed version | `2.13.0` |
| Minimum Obsidian version | `1.5.3` |
| Authors | Chris Kerr and Erika Rice Scherpelz (`erikars`) |
| Author repository/profile | <https://github.com/erikars> |
| Desktop only | No |
| Test vault | `/home/poverbec/ObsidianPaul` |
| Test folder | `/home/poverbec/ObsidianPaul/SaleTest` |
| Installed plugin | `/home/poverbec/ObsidianPaul/.obsidian/plugins/task-list-kanban` |
| Board file | `/home/poverbec/ObsidianPaul/SaleTest/Kanban View.md` |
| Task files | `SaleTest/StadtOffenburg.md`, `SaleTest/Stadtwerke.md` |

The installed community-plugin bundle consists of:

- `manifest.json`: plugin identity and compatibility metadata.
- `main.js`: compiled plugin implementation (approximately 1.25 MB in this installation).
- `styles.css`: board and settings styles.
- `data.json`: vault-wide plugin settings and board metadata.

The installed bundle is generated output, not a convenient source tree. A substantial rewrite should be done in the upstream/source repository and deployed into this folder for manual testing. Small experiments can inspect `main.js`, but editing the minified bundle directly is fragile and will be overwritten by an update or redeployment.

## Current SaleTest board

`SaleTest/Kanban View.md` is a configuration note. Its YAML frontmatter contains a JSON value under `kanban_plugin`. The current configuration is equivalent to:

```json
{
  "columns": [
    {
      "id": "column-soonish",
      "label": "Erstgespreach",
      "matchMode": "name",
      "matchTags": []
    },
    {
      "id": "column-next-week",
      "label": "FollowUp_Send",
      "matchMode": "name",
      "matchTags": []
    },
    {
      "id": "column-this-week",
      "label": "2.Gespreach",
      "matchMode": "name",
      "matchTags": []
    },
    {
      "id": "column-new-column",
      "label": "next_Beteungstermin",
      "matchMode": "name",
      "matchTags": []
    }
  ],
  "doneColumnName": "",
  "lastUsedTaskFile": "SaleTest/StadtOffenburg.md"
}
```

The note body currently contains `Tag erstgespraech`. Both task-source notes are currently empty. The plugin's `data.json` contains schema version `1`, no global board-default overrides, and a last-opened timestamp for `SaleTest/Kanban View.md`.

Column-name matching normalizes labels into tags. For example, a task can be created in a source file as:

```markdown
- [ ] Kunde anrufen #Erstgespreach
```

Tasks without a column tag appear in **Uncategorized**. Dragging the card to another column rewrites the placement tag in its source Markdown.

## Main capabilities

Use Task List Kanban to:

- Collect tasks from the board's folder, selected folders, or the entire vault.
- Move tasks among columns whose placement is determined by tags, checkbox status markers, or priority metadata.
- Manage multiple boards from a dashboard and board rail.
- Edit, complete, cancel, archive, duplicate, delete, and bulk-update tasks.
- Filter by content, tag, file, or date using one search query.
- Save views that combine filtering, sorting, grouping, layout direction, and card width.
- Group tasks into swimlanes by file, tag, or parsed property and reverse group order.
- Sort tasks by file order, task name, parsed task properties, or manually pinned order.
- Display, sort, group, and edit Obsidian Tasks Plugin or Dataview date metadata.
- Keep nested Markdown blocks attached to their parent cards when nested tasks are treated as subtasks.

## Creating and navigating boards

Create a board with the **New Kanban board** ribbon icon, the **Create new kanban board** command, the dashboard's **New board** action, or a folder's context-menu **New kanban** action. Each flow allows the destination folder to be selected.

Open the dashboard from the board rail or run **Show board dashboard** while a Kanban view is focused. It lists all boards with task counts and updated/opened timestamps. A board card's context menu can rename, hide, show, or delete it. Deletion asks for confirmation and uses Obsidian's trash flow. Dashboard cards can be dragged into a preferred order; hidden boards remain accessible under **Other boards**.

When the vault contains multiple boards, the board rail provides one-click switching and supports drag reordering. Plugin settings can dock it on the left or across the top. A left-docked rail is resizable.

## Adding tasks

The plugin recognizes standard Markdown task bullets (`-`, `*`, and `+`):

```markdown
- [ ] Write release notes #this-week
```

Click **Add new** at the bottom of a column to create a task. When a default or recently used task file is known, editing starts immediately; otherwise, select the destination file first. The **Add card** command can add a task to a visible board without opening that board first.

Placement tags are hidden from cards. Other tags can remain inline or be consolidated into the card footer.

## Board configuration

Open board settings with the settings icon in the top-right corner. Board settings inherit plugin-wide board defaults unless overridden. An inherited setting can be pinned to freeze its current value or reset to follow global defaults again.

Useful commands include:

- **Use current board settings as global defaults**.
- **Prune board settings that match the defaults**.

Plugin settings include the board-rail dock, board defaults (columns, markers, scope, tags, properties, and nested tasks), default flow direction and card width, and global saved views.

### Scope and exclusions

A board can read tasks from:

- **Same as board folder**: files beside the board note.
- **Every folder**: the whole vault.
- **Selected folders**: specific vault-relative directories; the board's own folder is always included.

**Excluded paths** are applied after scope selection. The board's own folder cannot be excluded directly, although its subdirectories can.

### Columns and matching

Custom columns can be renamed, colored, removed, and reordered. **Uncategorized** and **Done** remain fixed at the beginning and end of the settings list and have separate visibility and naming controls.

Matching modes are:

- **Name**: `In Progress` matches variants such as `#InProgress`, `#in-progress`, and `#In-Progress`.
- **Explicit tags**: all configured tags are required. A column mapped to `status/active` and `project/alpha` only matches a task containing both.
- **Status marker**: match active checkbox markers such as `[ ]`, `[/]`, or `[!]`; moving a task changes its checkbox marker.
- **Priority**: match Tasks Plugin or Dataview priority metadata when a property schema is enabled; moving a task writes the new priority.

Settings can optionally update existing tasks after a name-matched column is renamed or after explicit-tag, status-marker, or priority rules change.

Column display settings include a hex color (for example, `#FF5733`), a global width from 200–600 px, and rules to show **Uncategorized** and **Done** always, never, or only when non-empty.

### Tag display

**Consolidate tags** moves non-column tags to the card footer. **Excluded tags** hides configured tags from task cards, tag grouping, and consolidated footers. A settings action can exclude every tag mapped to an active column automatically.

### Layout

Flow direction can be:

- **Left to right**: horizontal columns scrolling right.
- **Right to left**: reversed horizontal columns.
- **Top to bottom**: transposed board, where board columns become rows and cards flow horizontally.
- **Bottom to top**: reversed transposed rows.

Card width can be set from the view controls between 200 and 600 px.

## Tasks Plugin and Dataview metadata

Enable a **Property schema** to parse and write metadata in either integration's native Markdown format.

- Obsidian Tasks Plugin: due, scheduled, start, done, created, priority, and recurrence.
- Dataview: due, scheduled, start, done, completion, created, priority, repeat, and arbitrary inline fields.

**Show properties** supports:

- **None**: leave metadata in the task text.
- **Pretty**: render formatted values and familiar Tasks Plugin labels/icons.
- **Debug (JSON)**: show raw parsed data for schema troubleshooting.

Cards show a compact **+ Date** control for due, scheduled, and start dates when either schema is active. New board-created tasks support the same fields.

Tasks Plugin format:

```markdown
- [ ] Send invoice 📅 2026-06-15 ⏳ 2026-06-16 🛫 2026-06-17
- [x] Send invoice ✅ 2026-06-15
```

Dataview format:

```markdown
- [ ] Send invoice [due:: 2026-06-15] [scheduled:: 2026-06-16] [start:: 2026-06-17]
- [x] Send invoice [completion:: 2026-06-15]
```

Completing an open task adds a completion date if the active schema supports it and no completion date exists. Existing dates are preserved. Reopening, moving, cancelling, archiving, or editing a task does not remove or rewrite historical completion metadata.

## Nested tasks and source blocks

With **Treat nested tasks as subtasks** enabled, only a root task becomes a card. Its nested tasks and notes remain inside it. Nested rows can be edited, status-cycled, added, deleted, and reordered from the card.

Moving, duplicating, deleting, or archiving the parent operates on the entire owned nested Markdown block instead of only the first task line.

## Status behavior

Task status styling comes from the active Obsidian theme or plugin CSS. Marker settings determine behavior:

- **Status marker order** controls sorting and grouping by status.
- **Done markers** are treated as complete; default: `xX`.
- **Ignored markers** are hidden from the board; default: empty.
- **Cancelled markers** are used by cancel/restore; default: `-`.
- **Status cycle sequence** defines the checkbox states visited when the checkbox is clicked.

For example, `xX✓` recognizes `[x]`, `[X]`, and `[✓]` as done. An ignored marker of `-` hides `[-]` tasks. Cancel and restore only change the checkbox marker; if a cancelled marker is also ignored or done, that other classification determines whether it is hidden or complete.

## Board and task controls

Columns can be collapsed from their headers, and collapse state is saved.

Task actions include:

- **Edit**: click task text, edit inline, and click away or press Enter.
- **Move**: drag a card or select a destination from its menu.
- **Complete / Cycle status**: click the checkbox. Without a cycle it completes the task and moves it to Done; with a configured cycle it advances to the next marker.
- **Cancel / Restore**: switch between cancelled and active markers.
- **Archive**: mark an open task done and add `#archived`.
- **Duplicate**: create a copy directly below the original source line.
- **Open source file**: click the file path or arrow on the card.

## Sorting and manual order

The board header's **Sort** menu supports:

- **File order**: natural Markdown source order.
- **Task name**: lexicographic task-text order.
- **Property**: parsed dates, priorities, or other supported fields.
- **Manual**: drag a task within its column to pin it.

Pinned tasks stay together at the top of a column and show a pin marker. Clicking the marker unpins a card and returns it to the file-order tail. On first pin, the plugin adds an Obsidian block ID such as `^abc123` to the source line if none exists, making the manual order stable across edits and reloads.

Manual drag reordering is disabled while grouping is active because relative positions would not be stable across groups. Existing manual order still displays and becomes editable again after grouping is disabled.

## Filtering

The search bar uses space-separated tokens. Every token must match (logical AND).

| Token | Meaning | Example |
| --- | --- | --- |
| Word or quoted phrase | Case-insensitive content match | `fix`, `"big rocks"` |
| `tag:x` or `tag:x,y` | Required tag, or any tag in the comma list | `tag:home,errand` |
| `file:x` or `file:x,y` | File path contains any listed value | `file:projects` |
| Date property plus operator | Compare parsed property to date | `due:<$TODAY`, `due:<=2026-07-04` |

Example:

```text
fix tag:home file:projects due:<$TODAY
```

This requires content containing `fix`, tag `home`, a source path containing `projects`, and a due date before today.

Important query rules:

- There is no general OR or negation.
- Repeated tag tokens are ANDed: `tag:home tag:errand` requires both, while `tag:home,errand` accepts either.
- Repeated file tokens merge into one “any of” list.
- Quote values containing spaces, for example `file:"weekly notes"`.
- Date filters use date-typed fields from the active schema, operators `<`, `<=`, `=`, `>=`, or `>`, and `YYYY-MM-DD` or `$TODAY`.
- `$TODAY` reevaluates at midnight.
- A task lacking the referenced date property is not hidden by that date token.
- Unknown prefixes and malformed date filters are treated as ordinary content text.

Filtering is applied with Enter and persisted per board. While typing, suggestions appear for the token at the caret: tags, file paths, date keys/operators, and query-only saved views. The sliders icon opens a structured editor synchronized with the text query.

## Saved views

A saved view can capture the current query, sort, grouping, flow direction, and card width. It may have a name and can be reapplied from expanded view controls. Board-local saved views can be deleted with their `×` control. Query-only views also appear as search suggestions. Global saved views are read-only on boards and edited in plugin settings.

Saved views replace the older saved-filter and saved-grouping workflows.

## Bulk actions

Every column header has a **Done / Select** toggle:

- In Done mode, clicking cards completes their tasks.
- In Select mode, clicking cards selects them.

The column bulk menu can move, complete, cancel, restore, archive, duplicate, or delete selected tasks. Command-palette actions also support marking selected cards done, cancelling, archiving, duplicating, and deleting. Dragging one selected task moves every selected task in that column.

## Grouping and swimlanes

**Group by** splits tasks into swimlanes. Horizontal layouts show board-wide rows; vertical layouts show groups as columns across the transposed grid. Group direction switches ascending/descending order. Group and column headers remain visible while scrolling. Dragging between groups updates the corresponding file, tag, or property.

### File grouping

Each source Markdown file becomes a group.

### Tag grouping

Tasks group by tag, optionally restricted to a prefix. An include list can expose only selected lanes and also sets their order. Tasks without an included grouping tag go to **Unassigned**.

### Property grouping

With Tasks Plugin or Dataview parsing enabled, tasks can group by parsed properties. Date grouping can combine overdue values into a single past bucket.

Saved views can retain grouping key, tag prefix, include list, property configuration, direction, and layout.

## Development workflow

Prerequisites:

- Node.js
- npm
- Obsidian for manual testing

Typical source-repository workflow:

```bash
npm install
npm run dev
```

Build output is written to the source repository root for loading as an Obsidian plugin.

Quality checks:

```bash
npm run build
npm test
```

`npm run build` performs TypeScript checking and creates a production ESBuild bundle. `npm test` runs the Vitest suite.

Deploy a build into the vendored manual-test vault with:

```bash
./tools/deploy_for_manual_test.sh
```

By default this copies the built plugin to `test-vaults/obsidian-plugin-dev/.obsidian/plugins/task-list-kanban/`. A different target directory can be passed to the script. For this machine, the relevant manual deployment target is `/home/poverbec/ObsidianPaul/.obsidian/plugins/task-list-kanban/`.

### Release workflow

1. Run `npm run version` to bump the version.
2. Commit the version changes.
3. Create an annotated tag.
4. Push `main` and the tag.
5. Wait for GitHub Actions to create the draft release with built assets.
6. Edit and publish that automated draft on the releases page.

Do not manually create the draft with `gh release create` or the GitHub UI; the automated draft contains the correct assets.

## Rewrite map

Before changing behavior, obtain the TypeScript source repository rather than treating installed `main.js` as the canonical code. Preserve these core invariants in any rewrite:

1. The Markdown file is the source of truth; the board is a view and editor over it.
2. A mutation must update the correct source line or owned nested block without damaging unrelated Markdown.
3. Board configuration remains serializable in the board note's `kanban_plugin` frontmatter.
4. Vault-wide defaults and dashboard metadata remain in plugin data (`data.json`).
5. Task identity must survive edits, reloads, sorting, and manual pinning; existing block IDs must be preserved.
6. Integration-specific metadata must round-trip without converting Tasks Plugin syntax into Dataview syntax or vice versa.
7. Completion history must be preserved unless the user explicitly edits it.

A maintainable rewrite should separate:

- Markdown task parsing and source-block ownership.
- Atomic vault mutations and conflict handling.
- Board configuration and global settings migrations.
- Column classification and movement rules.
- Search-query parsing and date evaluation.
- Sorting, pinning, grouping, and saved-view state.
- Obsidian Tasks and Dataview metadata adapters.
- Board/dashboard UI and drag-and-drop behavior.
- Unit tests for parsers and mutations plus manual Obsidian integration tests.

High-risk areas are nested block boundaries, concurrent source edits, duplicate task text, block-ID stability, tag normalization, midnight changes to `$TODAY`, and preserving integration metadata while changing checkbox states.

## Screenshot refresh candidates

The upstream README screenshots should eventually be refreshed to show:

- The main board with current card footers, properties, and **+ Date**.
- The dashboard and rail with task counts, timestamps, and **Other boards**.
- Saved-view controls combining filter, sort, group, flow, and width.
- Plugin settings with board defaults, default view, global views, and rail dock.
- The card date editor with due, scheduled, and start inputs.
- A grouped top-to-bottom or bottom-to-top transposed board.
- Property schema and **Show properties** settings.
- Status marker order and done, ignored, and cancelled marker settings.

## Quick manual smoke test in SaleTest

1. Add tasks to `SaleTest/StadtOffenburg.md` and `SaleTest/Stadtwerke.md` using several board-column tags.
2. Open `SaleTest/Kanban View.md` in Obsidian and verify each card appears in the expected column.
3. Drag a card between columns and confirm only its placement tag changes in the source note.
4. Edit, complete, cancel, duplicate, and archive sample cards and inspect the resulting Markdown.
5. Test filtering by content, tag, file, and `$TODAY` after enabling a property schema.
6. Enable nested subtasks and verify moves/duplicates include the full child block.
7. Enable manual sorting and verify a stable block ID is added and retained.
8. Group by file and confirm the two SaleTest source notes form separate swimlanes.

