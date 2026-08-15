# Client Kanban Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and reopen the last successful Client Kanban board from a left-ribbon icon, and let users edit malformed board YAML from a pencil action without replacing the Kanban tab.

**Architecture:** `ClientKanbanPlugin` owns persisted `lastBoardPath`, ribbon activation, and shared board opening. `ClientKanbanView` owns a source-edit toolbar action and emits board-path rename changes through an injected callback; existing metadata events refresh corrected configuration.

**Tech Stack:** TypeScript, Obsidian Plugin API, Vitest/jsdom, esbuild, pnpm.

## Global Constraints

- Work only in `plugin-development/client-kanban/` plus deployed `.obsidian/plugins/client-kanban/` assets.
- Persist only `{ lastBoardPath?: string }` through Obsidian `loadData()`/`saveData()`.
- Store a board path only after the board note passes strict `client_kanban: true` validation and its custom view opens successfully.
- The left-ribbon icon uses built-in icon `columns-3` and tooltip `Open last Client Kanban`.
- Missing remembered path notice is exactly `Open a note marked client_kanban: true first.`.
- Unavailable remembered board notice is exactly `The last Client Kanban board is unavailable: <path>`; do not clear the stored path.
- The edit action label and tooltip are exactly `Edit board configuration`.
- Editing opens the current board note through `workspace.getLeaf("tab").openFile(file)` and does not replace the Kanban leaf.
- Render the edit action for valid configuration and configuration-error states, but not when the board file itself is unavailable.
- Board rename updates persisted state only when the renamed path is the remembered last board.
- Do not modify board or client YAML automatically.
- Preserve mobile compatibility and introduce no Node/Electron runtime imports.
- Use pnpm exclusively: replace `package-lock.json` with `pnpm-lock.yaml`, set `packageManager` in `package.json`, and run package scripts through `pnpm`.

---

### Task 1: Persist and reopen the last Client Kanban board

**Files:**
- Modify: `plugin-development/client-kanban/src/main.ts`
- Modify: `plugin-development/client-kanban/tests/main.test.ts`
- Modify: `plugin-development/client-kanban/tests/obsidian.ts`
- Modify: `plugin-development/client-kanban/package.json`
- Create: `plugin-development/client-kanban/pnpm-lock.yaml`
- Delete: `plugin-development/client-kanban/package-lock.json`

**Interfaces:**
- Produces: `ClientKanbanPluginData { lastBoardPath?: string }`, plugin method behavior for loading/saving and ribbon reopening, and a view-factory rename callback consumed by Task 2.
- Consumes: existing `openBoard`, `isBoard`, and `ClientKanbanView` constructor.

- [ ] **Step 1: Write failing persistence and ribbon tests**

Extend the harness with `loadData`, `saveData`, `addRibbonIcon`, and vault path lookup. Cover:

```ts
it("reopens the persisted last board from the ribbon", async () => {
  const board = file("SaleTest/Board.md", { client_kanban: true });
  const harness = pluginHarness({ files: [board], storedData: { lastBoardPath: board.path } });
  await harness.plugin.onload();
  await harness.ribbon.callback();
  expect(harness.leaf.setViewState).toHaveBeenCalledWith({
    type: CLIENT_KANBAN_VIEW_TYPE, active: true, state: { file: board.path }
  });
});

it("persists only after successful activation", async () => {
  const board = file("SaleTest/Board.md", { client_kanban: true });
  const harness = pluginHarness({ activeFile: board });
  await harness.plugin.onload();
  await runCommand(harness, "client-kanban-open-current-board");
  expect(harness.plugin.saveData).toHaveBeenCalledWith({ lastBoardPath: board.path });
});
```

Also test missing/malformed load data, no stored path, unavailable stored path, no-longer-marked board, failed `setViewState` not saved, and `saveData` failure Notice.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `cd plugin-development/client-kanban && pnpm test -- tests/main.test.ts`

Expected: FAIL because persistence and ribbon APIs are not implemented.

- [ ] **Step 3: Implement persistence and ribbon behavior**

Add:

```ts
interface ClientKanbanPluginData { lastBoardPath?: string; }
private data: ClientKanbanPluginData = {};
```

Make `onload` async, load and validate data, register `addRibbonIcon("columns-3", "Open last Client Kanban", ...)`, resolve the stored path on every click, and route successful opening through `openBoard`. Await `leaf.setViewState` before updating memory and calling `saveData`. Catch load/save failures according to the design without preventing startup.

Pass an async rename callback from the registered view factory. It persists `newPath` only when `this.data.lastBoardPath === oldPath`.

- [ ] **Step 4: Run Task 1 verification**

Run: `cd plugin-development/client-kanban && pnpm test -- tests/main.test.ts && pnpm test && pnpm build`

Expected: all tests PASS and the build succeeds.

- [ ] **Step 5: Commit Task 1**

```bash
git add plugin-development/client-kanban/src/main.ts plugin-development/client-kanban/tests/main.test.ts plugin-development/client-kanban/tests/obsidian.ts plugin-development/client-kanban/package.json plugin-development/client-kanban/pnpm-lock.yaml plugin-development/client-kanban/package-lock.json
git commit -m "feat: reopen last client kanban board"
```

---

### Task 2: Edit board configuration without closing the Kanban view

**Files:**
- Modify: `plugin-development/client-kanban/src/client-kanban-view.ts`
- Modify: `plugin-development/client-kanban/src/styles.css`
- Modify: `plugin-development/client-kanban/tests/client-kanban-view.test.ts`
- Modify: `plugin-development/client-kanban/tests/obsidian.ts`
- Modify: `plugin-development/client-kanban/README.md`
- Modify: `.obsidian/plugins/client-kanban/main.js`
- Modify: `.obsidian/plugins/client-kanban/styles.css`

**Interfaces:**
- Consumes: `BoardPathChanged = (oldPath: string, newPath: string) => void | Promise<void>` supplied by Task 1.
- Produces: edit toolbar rendering, source-note navigation, and rename callback delivery.

- [ ] **Step 1: Write failing edit-action and rename-callback tests**

Cover valid and malformed configuration, separate-tab navigation, unavailable board behavior, and rename callback:

```ts
it("opens malformed board configuration in a separate tab", async () => {
  const view = harness({ boardFrontmatter: { client_kanban: true, columns: [] } });
  await view.refresh();
  click(view, ".client-kanban-edit-board");
  expect(view.app.workspace.getLeaf).toHaveBeenCalledWith("tab");
  expect(openFileSpy(view.app)).toHaveBeenCalledWith(expect.objectContaining({ path: "SaleTest/Board.md" }));
});

it("reports a renamed board path", async () => {
  const changed = vi.fn();
  const view = mountedView({ boardPathChanged: changed });
  triggerVaultRename(view.app, "SaleTest/Board.md", "SaleTest/Renamed.md");
  expect(changed).toHaveBeenCalledWith("SaleTest/Board.md", "SaleTest/Renamed.md");
});
```

Assert the pencil button has `aria-label` and `title` equal to `Edit board configuration`. Assert no toolbar is rendered when resolving the board file fails.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `cd plugin-development/client-kanban && pnpm test -- tests/client-kanban-view.test.ts`

Expected: FAIL because the toolbar, edit navigation, and callback do not exist.

- [ ] **Step 3: Implement toolbar, navigation, and rename notification**

Add the optional callback as the final constructor parameter. Extract `renderToolbar(content)` and call it before valid-board content and configuration errors, after the board `TFile` has resolved. The toolbar creates a `button.client-kanban-edit-board`, sets `type="button"`, `title`, and `aria-label`, and calls a method that re-resolves `boardPath` then uses `workspace.getLeaf("tab").openFile(file)` or shows the exact unavailable-board Notice.

During rename, capture `oldBoardPath`, update `boardPath`, and invoke the callback without blocking the vault event. Catch callback failure and show a Notice rather than breaking refresh scheduling.

- [ ] **Step 4: Add scoped toolbar styles and documentation**

Style `.client-kanban-toolbar` and `.client-kanban-edit-board` under `.client-kanban-view` using Obsidian variables. Document the ribbon and pencil workflows, persistence, malformed-YAML recovery, and manual restart/rename checks in README.

- [ ] **Step 5: Run full verification and deploy**

Run:

```bash
cd plugin-development/client-kanban
pnpm test
pnpm build
./tools/deploy.sh
cmp main.js ../../.obsidian/plugins/client-kanban/main.js
cmp manifest.json ../../.obsidian/plugins/client-kanban/manifest.json
cmp styles.css ../../.obsidian/plugins/client-kanban/styles.css
git diff --check
```

Expected: all tests PASS, build/deploy succeed, and deployed assets are byte-identical.

- [ ] **Step 6: Commit Task 2**

```bash
git add plugin-development/client-kanban/src/client-kanban-view.ts plugin-development/client-kanban/src/styles.css plugin-development/client-kanban/tests/client-kanban-view.test.ts plugin-development/client-kanban/tests/obsidian.ts plugin-development/client-kanban/README.md .obsidian/plugins/client-kanban/main.js .obsidian/plugins/client-kanban/styles.css
git commit -m "feat: edit client kanban board configuration"
```

---

## Final acceptance

- [ ] Ribbon reopens the remembered board after plugin reload.
- [ ] Failed or invalid opens do not replace remembered state.
- [ ] Board rename migrates the remembered path.
- [ ] Pencil is accessible in valid and malformed-configuration board views.
- [ ] Pencil opens Markdown in a separate tab and leaves the Kanban leaf intact.
- [ ] Existing 53 tests plus new tests pass.
- [ ] Build and deployed assets match; runtime remains Obsidian-only.
- [ ] Desktop manual restart/edit/rename checks remain explicitly pending until run in Obsidian.
