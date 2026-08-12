# Client Kanban Navigation Design

## Goal

Make Client Kanban boards easy to reopen and easy to edit after they have been converted from a Markdown editor into the custom Kanban view.

The plugin will remember the last successfully opened Client Kanban board, expose it through a left-ribbon icon, and provide an edit action inside the board that opens the board note's Markdown source without replacing the active Kanban view.

## Current problem and root cause

`Open as Client Kanban` changes a leaf from a Markdown view into `client-kanban-view`. The resulting board renders cards but provides no navigation back to the board note's source editor. A malformed `card_fields` entry therefore appears “frozen”: the YAML still exists, but the current leaf no longer exposes an editor for it.

Obsidian can restore serialized custom-view state, but that alone does not provide a stable user entry point after the user closes the board leaf or wants to reopen it later.

## Persisted plugin data

The plugin stores one optional vault-relative path:

```ts
interface ClientKanbanPluginData {
  lastBoardPath?: string;
}
```

Plugin startup loads this object with `loadData()`. Missing or malformed data is treated as an empty object. Only a non-empty string is accepted as `lastBoardPath`.

Whenever `openBoard` validates and successfully opens a note marked `client_kanban: true`, it updates `lastBoardPath` and persists the data with `saveData()`.

The path is also updated when an already-open board note is renamed. The view notifies the plugin through an injected callback after migrating its internal `boardPath`; the plugin persists the renamed path when it was the remembered board.

## Left-ribbon action

The plugin registers one left-ribbon icon using Obsidian's built-in `columns-3` icon and tooltip **Open last Client Kanban**.

Clicking it behaves as follows:

- If no last board is stored, show: `Open a note marked client_kanban: true first.`
- Resolve the stored path through `vault.getAbstractFileByPath`.
- If it does not resolve to a Markdown `TFile`, show: `The last Client Kanban board is unavailable: <path>`.
- If it resolves but is no longer marked `client_kanban: true`, reuse the existing validation notice: `The current note is not marked client_kanban: true`.
- Otherwise open it through the same `openBoard` path used by the command and file-menu action.

The plugin does not silently clear an unavailable path. Keeping it makes the failure diagnosable and allows the path to work again if a synced file returns.

## Edit-board action

Each rendered Client Kanban board displays a small pencil button in a board toolbar above the columns. Its tooltip and accessible label are **Edit board configuration**.

Clicking the button:

1. Resolves the view's current `boardPath` again.
2. If unavailable, shows `Board note "<path>" is unavailable`.
3. Otherwise opens the Markdown note in a new leaf with `workspace.getLeaf("tab").openFile(file)`.

Opening a new leaf keeps the Kanban view intact in its original tab. Saving corrected YAML triggers the existing metadata-cache listener, which refreshes the board automatically. The edit action performs no YAML mutation itself.

## View and plugin interfaces

`ClientKanbanView` gains an optional dependency callback:

```ts
type BoardPathChanged = (oldPath: string, newPath: string) => void | Promise<void>;
```

The plugin's registered view factory supplies a callback that updates persisted last-board state. Tests may omit it.

The board toolbar is rendered for both a valid board and configuration-error state so a malformed YAML value can always be corrected from the custom view. It is not rendered when the board file itself is unavailable, because there is no source note to open.

## Error handling

- Persistence load failures fall back to empty data and log a console error without preventing plugin startup.
- Persistence save failures show an Obsidian Notice and retain the in-memory last path for the current session.
- Ribbon resolution and edit resolution always re-read the vault path; stale `TFile` objects are not retained.
- Repeated clicks use Obsidian's normal leaf behavior and do not create or modify board files.

## Testing

Automated tests cover:

- Loading valid, missing, and malformed persisted plugin data.
- Saving the path only after successful board activation.
- Reopening the stored board from the ribbon.
- No-path, missing-file, and no-longer-marked notices.
- Persisting a renamed last-opened board.
- Rendering the edit button for valid and invalid board configuration.
- Opening the board source in a new tab without replacing the Kanban leaf.
- Missing board-note behavior.
- Existing activation, drag, refresh, and close tests continue to pass.

Manual Obsidian acceptance covers:

1. Open a board through the command and close its tab.
2. Click the left-ribbon icon and confirm the same board reopens.
3. Restart Obsidian and confirm the ribbon still reopens it.
4. Click the pencil button and confirm the board Markdown opens in a separate tab while the Kanban remains visible.
5. Correct a malformed `card_fields` entry and confirm the board refreshes after saving.
6. Rename the board, restart Obsidian, and confirm the remembered path follows the rename.

## Non-goals

- A board picker or dashboard.
- A fixed board path in plugin settings.
- Inline editing of `card_fields` inside the board.
- Editing client properties directly on cards.
- Automatically repairing malformed YAML property names.
