# Client Kanban Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Obsidian plugin that renders direct-child Markdown client files as cards and updates a configurable YAML stage property when cards move between columns.

**Architecture:** A custom Obsidian `ItemView` reads per-board configuration, delegates file access to a repository, converts client records into a pure board model, and renders touch-capable SortableJS columns. Obsidian frontmatter remains the source of truth, and relevant vault events trigger a debounced refresh.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Vitest with jsdom, SortableJS, npm.

## Global Constraints

- Plugin source lives in `plugin-development/client-kanban/`; compiled runtime assets deploy to `.obsidian/plugins/client-kanban/`.
- The plugin ID is exactly `client-kanban` and `isDesktopOnly` is `false`.
- Board configuration is per Markdown board note and uses `client_kanban`, `source_folder`, `stage_property`, `columns`, and `card_fields` YAML properties.
- Only direct-child Markdown files of `source_folder` become cards; nested folders are not scanned.
- Any note with `client_kanban: true` is excluded from client discovery.
- Column labels and stage values use exact, case-sensitive matching; configured column names must be non-empty and unique.
- Missing, empty, or unknown stage values render under **Uncategorized**; unknown values remain unchanged until the card moves.
- Moving to a configured column changes only the configured stage property; moving to **Uncategorized** removes only that property.
- `client_name` falls back to the filename; configured card fields are read-only, ordered, and omitted individually when missing or empty.
- Clicking a card opens its source note; the board does not create, delete, or inline-edit clients.
- All file access uses Obsidian APIs, especially `FileManager.processFrontMatter`; do not use Node or Electron APIs.
- Relevant file and metadata events refresh the view and rapid events are debounced.
- Follow the official [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin) build shape and [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).

---

## File map

| File | Responsibility |
| --- | --- |
| `plugin-development/client-kanban/package.json` | Commands and pinned plugin dependencies |
| `plugin-development/client-kanban/tsconfig.json` | Strict TypeScript compiler settings |
| `plugin-development/client-kanban/esbuild.config.mjs` | Development and production bundles |
| `plugin-development/client-kanban/vitest.config.ts` | jsdom tests and Obsidian alias |
| `plugin-development/client-kanban/manifest.json` | Obsidian plugin metadata |
| `plugin-development/client-kanban/src/types.ts` | Shared configuration, client, and board types |
| `plugin-development/client-kanban/src/config.ts` | Parse and validate board frontmatter |
| `plugin-development/client-kanban/src/client-repository.ts` | Discover notes, read metadata, and mutate stage properties |
| `plugin-development/client-kanban/src/board-model.ts` | Pure card projection and column assignment |
| `plugin-development/client-kanban/src/client-kanban-view.ts` | ItemView rendering, drag behavior, errors, and refresh subscriptions |
| `plugin-development/client-kanban/src/main.ts` | Plugin lifecycle, view registration, and board-note activation |
| `plugin-development/client-kanban/src/styles.css` | Board, column, card, and error presentation |
| `plugin-development/client-kanban/tests/obsidian.ts` | Runtime-safe test double for the Obsidian module |
| `plugin-development/client-kanban/tests/*.test.ts` | Unit and view tests |
| `plugin-development/client-kanban/tools/deploy.sh` | Copy three runtime files into the vault installation directory |
| `plugin-development/client-kanban/README.md` | Development commands and SaleTest smoke test |

---

### Task 1: Scaffold the plugin and validate board configuration

**Files:**
- Create: `plugin-development/client-kanban/package.json`
- Create: `plugin-development/client-kanban/tsconfig.json`
- Create: `plugin-development/client-kanban/esbuild.config.mjs`
- Create: `plugin-development/client-kanban/vitest.config.ts`
- Create: `plugin-development/client-kanban/manifest.json`
- Create: `plugin-development/client-kanban/src/types.ts`
- Create: `plugin-development/client-kanban/src/config.ts`
- Create: `plugin-development/client-kanban/tests/obsidian.ts`
- Create: `plugin-development/client-kanban/tests/config.test.ts`

**Interfaces:**
- Consumes: raw frontmatter as `Record<string, unknown> | undefined`.
- Produces: `parseBoardConfig(frontmatter): ConfigResult`, `BoardConfig`, `ConfigResult`, `ClientRecord`, `CardField`, `BoardCard`, and `BoardColumn`.

- [ ] **Step 1: Add the build and test scaffold**

Create the manifest with `id: "client-kanban"`, `name: "Client Kanban"`, version `0.1.0`, minimum app version `1.5.3`, and `isDesktopOnly: false`. Configure npm scripts exactly as:

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "sortablejs": "^1.15.6" },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/sortablejs": "^1.15.8",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.25.0",
    "obsidian": "^1.8.0",
    "tslib": "^2.8.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "jsdom": "^26.0.0"
  }
}
```

Configure esbuild with `src/main.ts` as the entry point, `obsidian`, `electron`, and Node built-ins as externals, `main.js` as output, and CSS imported from `src/main.ts`. Configure Vitest for `jsdom`, globals, and alias `obsidian` to `tests/obsidian.ts`.

- [ ] **Step 2: Install dependencies and verify the empty scaffold builds**

Run: `cd plugin-development/client-kanban && npm install`

Run: `npm run build`

Expected: TypeScript and esbuild complete successfully and produce `main.js`; there are no application source imports yet.

- [ ] **Step 3: Write failing configuration tests**

Define the expected public behavior in `tests/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "../src/config";

describe("parseBoardConfig", () => {
  it("parses a valid board", () => {
    expect(parseBoardConfig({
      client_kanban: true,
      source_folder: "SaleTest",
      stage_property: "sales_stage",
      columns: ["Erstgespraech", "FollowUp_Send"],
      card_fields: ["contact_person", "last_contact"]
    })).toEqual({ ok: true, value: {
      sourceFolder: "SaleTest",
      stageProperty: "sales_stage",
      columns: ["Erstgespraech", "FollowUp_Send"],
      cardFields: ["contact_person", "last_contact"]
    }});
  });

  it.each([
    [{ client_kanban: true, stage_property: "sales_stage", columns: ["New"] }, "source_folder"],
    [{ client_kanban: true, source_folder: "SaleTest", columns: ["New"] }, "stage_property"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: [] }, "columns"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: ["New", "New"] }, "unique"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: [" "] }, "non-empty"]
  ])("rejects invalid configuration %#", (frontmatter, message) => {
    const result = parseBoardConfig(frontmatter);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain(message);
  });
});
```

- [ ] **Step 4: Run the configuration tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/config.test.ts`

Expected: FAIL because `src/config.ts` and its types do not exist.

- [ ] **Step 5: Implement shared types and configuration parsing**

Create these exact shared shapes in `src/types.ts`:

```ts
export interface BoardConfig {
  sourceFolder: string;
  stageProperty: string;
  columns: string[];
  cardFields: string[];
}

export type ConfigResult =
  | { ok: true; value: BoardConfig }
  | { ok: false; errors: string[] };

export interface ClientRecord {
  path: string;
  basename: string;
  frontmatter: Record<string, unknown>;
}

export interface CardField { key: string; value: string; }
export interface BoardCard { path: string; title: string; stage: string | null; fields: CardField[]; }
export interface BoardColumn { id: string; label: string; stage: string | null; cards: BoardCard[]; }
```

Implement `parseBoardConfig` as a pure function. Trim the folder and property strings, require at least one exact non-empty column, reject duplicates with `new Set(columns).size`, and default absent `card_fields` to `[]`. Reject non-string entries instead of coercing them.

- [ ] **Step 6: Run configuration tests and build**

Run: `cd plugin-development/client-kanban && npm test -- tests/config.test.ts && npm run build`

Expected: all configuration tests PASS and the production build succeeds.

- [ ] **Step 7: Commit the scaffold and configuration parser**

```bash
git add plugin-development/client-kanban
git commit -m "feat: scaffold client kanban configuration"
```

---

### Task 2: Discover client notes and safely mutate stages

**Files:**
- Create: `plugin-development/client-kanban/src/client-repository.ts`
- Create: `plugin-development/client-kanban/tests/client-repository.test.ts`
- Modify: `plugin-development/client-kanban/tests/obsidian.ts`

**Interfaces:**
- Consumes: `App`, `TFolder`, `TFile`, `BoardConfig`.
- Produces: class `ClientRepository` with `list(config: BoardConfig): Promise<ClientRecord[]>` and `setStage(path: string, stageProperty: string, stage: string | null): Promise<void>`.

- [ ] **Step 1: Write failing repository discovery tests**

Use lightweight fake `TFile` and `TFolder` objects in the Obsidian test double. Cover direct children, nested exclusion, non-Markdown exclusion, and board-note exclusion:

```ts
it("returns only direct client Markdown files", async () => {
  const app = fakeApp({
    folders: { SaleTest: [
      file("SaleTest/Max.md", { client_name: "Max" }),
      file("SaleTest/Board.md", { client_kanban: true }),
      file("SaleTest/logo.png", {}),
      folder("SaleTest/Archive", [file("SaleTest/Archive/Old.md", {})])
    ]}
  });
  const records = await new ClientRepository(app).list(config);
  expect(records.map(record => record.path)).toEqual(["SaleTest/Max.md"]);
});

it("reports a missing source folder", async () => {
  const app = fakeApp({ folders: {} });
  await expect(new ClientRepository(app).list(config))
    .rejects.toThrow('Source folder "SaleTest" was not found');
});
```

- [ ] **Step 2: Run discovery tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-repository.test.ts`

Expected: FAIL because `ClientRepository` is undefined.

- [ ] **Step 3: Implement direct-child discovery**

Implement `list` using `app.vault.getAbstractFileByPath(config.sourceFolder)`, require `TFolder`, iterate only `folder.children`, retain `TFile` objects with extension `md`, and read cached frontmatter through `app.metadataCache.getFileCache(file)?.frontmatter ?? {}`. Exclude records whose cached frontmatter has `client_kanban === true`. Sort records by `path.localeCompare` to keep deterministic output.

- [ ] **Step 4: Run discovery tests and verify they pass**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-repository.test.ts`

Expected: discovery and missing-folder tests PASS.

- [ ] **Step 5: Write failing stage-mutation tests**

```ts
it("changes only the configured stage property", async () => {
  const app = fakeApp({ files: [file("SaleTest/Max.md", {
    client_name: "Max", sales_stage: "Old", extra: "preserve"
  })]});
  await new ClientRepository(app).setStage("SaleTest/Max.md", "sales_stage", "New");
  expect(app.fileManager.processFrontMatter).toHaveBeenCalledOnce();
  expect(frontmatterFor(app, "SaleTest/Max.md")).toEqual({
    client_name: "Max", sales_stage: "New", extra: "preserve"
  });
});

it("removes only the stage when moving to Uncategorized", async () => {
  const app = fakeApp({ files: [file("SaleTest/Max.md", {
    client_name: "Max", sales_stage: "Old", extra: "preserve"
  })]});
  await new ClientRepository(app).setStage("SaleTest/Max.md", "sales_stage", null);
  expect(frontmatterFor(app, "SaleTest/Max.md")).toEqual({ client_name: "Max", extra: "preserve" });
});

it("rejects a source that disappeared before drop", async () => {
  await expect(new ClientRepository(fakeApp({})).setStage("SaleTest/Missing.md", "sales_stage", "New"))
    .rejects.toThrow('Client note "SaleTest/Missing.md" is unavailable');
});
```

- [ ] **Step 6: Run mutation tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-repository.test.ts`

Expected: FAIL because `setStage` is not implemented.

- [ ] **Step 7: Implement current-file frontmatter mutation**

Resolve the path again with `vault.getAbstractFileByPath`, require a Markdown `TFile`, and call:

```ts
await this.app.fileManager.processFrontMatter(file, frontmatter => {
  if (stage === null) delete frontmatter[stageProperty];
  else frontmatter[stageProperty] = stage;
});
```

Do not cache mutable frontmatter objects and do not rewrite note content manually.

- [ ] **Step 8: Run repository tests and commit**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-repository.test.ts && npm run build`

Expected: all repository tests PASS and the build succeeds.

```bash
git add plugin-development/client-kanban/src/client-repository.ts plugin-development/client-kanban/tests
git commit -m "feat: add client note repository"
```

---

### Task 3: Project client records into the board model

**Files:**
- Create: `plugin-development/client-kanban/src/board-model.ts`
- Create: `plugin-development/client-kanban/tests/board-model.test.ts`

**Interfaces:**
- Consumes: `buildBoard(config: BoardConfig, records: ClientRecord[]): BoardColumn[]`.
- Produces: ordered `BoardColumn[]`, always beginning with `{ id: "uncategorized", label: "Uncategorized", stage: null }`.

- [ ] **Step 1: Write failing board-model tests**

```ts
describe("buildBoard", () => {
  it("uses exact stage matching and preserves unknown stages", () => {
    const columns = buildBoard(config, [
      client("SaleTest/Exact.md", { sales_stage: "New" }),
      client("SaleTest/Case.md", { sales_stage: "new" }),
      client("SaleTest/Missing.md", {}),
      client("SaleTest/Unknown.md", { sales_stage: "Legacy" })
    ]);
    expect(columns[1].cards.map(card => card.title)).toEqual(["Exact"]);
    expect(columns[0].cards.map(card => [card.title, card.stage])).toEqual([
      ["Case", "new"], ["Missing", null], ["Unknown", "Legacy"]
    ]);
  });

  it("renders sparse configured fields and filename fallback", () => {
    const columns = buildBoard({ ...config, cardFields: ["phone", "special_requirement"] }, [
      client("SaleTest/Max Mustermann.md", { phone: "123", special_requirement: "Ramp" }),
      client("SaleTest/Erika.md", { phone: "456" })
    ]);
    expect(columns[0].cards[0]).toMatchObject({
      title: "Max Mustermann",
      fields: [{ key: "phone", value: "123" }, { key: "special_requirement", value: "Ramp" }]
    });
    expect(columns[0].cards[1].fields).toEqual([{ key: "phone", value: "456" }]);
  });
});
```

- [ ] **Step 2: Run board-model tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/board-model.test.ts`

Expected: FAIL because `buildBoard` does not exist.

- [ ] **Step 3: Implement pure model projection**

Create Uncategorized first, then one configured column per label. Read stage only when its value is a non-empty string; preserve unknown values on the card. Use `client_name` only when it is a non-empty string, otherwise use `basename`. Convert scalar display values (`string`, `number`, `boolean`) with `String(value)` and ISO-like date values received as strings unchanged. Omit `null`, `undefined`, empty strings, arrays, and objects from card fields.

Append cards in repository order. Use stable column IDs: `uncategorized` and `stage-${encodeURIComponent(label)}`.

- [ ] **Step 4: Run board-model tests, full tests, and commit**

Run: `cd plugin-development/client-kanban && npm test -- tests/board-model.test.ts && npm test && npm run build`

Expected: all tests PASS and the build succeeds.

```bash
git add plugin-development/client-kanban/src/board-model.ts plugin-development/client-kanban/tests/board-model.test.ts
git commit -m "feat: build client card board model"
```

---

### Task 4: Render the board and handle safe card movement

**Files:**
- Create: `plugin-development/client-kanban/src/client-kanban-view.ts`
- Create: `plugin-development/client-kanban/tests/client-kanban-view.test.ts`
- Modify: `plugin-development/client-kanban/tests/obsidian.ts`

**Interfaces:**
- Consumes: `ClientRepository`, `parseBoardConfig`, `buildBoard`, Obsidian `ItemView`, and SortableJS.
- Produces: `CLIENT_KANBAN_VIEW_TYPE = "client-kanban-view"` and class `ClientKanbanView` accepting `(leaf, app, boardPath)` with serializable state `{ file: string }`.

- [ ] **Step 1: Write failing render and navigation tests**

Inject a repository factory and Sortable factory into the view constructor for tests. Assert the DOM contract:

```ts
it("renders columns, sparse fields, and source paths", async () => {
  const view = harness({ records: [client("SaleTest/Max.md", {
    client_name: "Max", sales_stage: "New", phone: "123", special_requirement: "Ramp"
  })]});
  await view.refresh();
  expect(labels(view, ".client-kanban-column-title")).toEqual(["Uncategorized", "New"]);
  expect(text(view, ".client-kanban-card-title")).toBe("Max");
  expect(labels(view, ".client-kanban-card-field")).toEqual(["phone: 123", "special_requirement: Ramp"]);
  expect(card(view).dataset.path).toBe("SaleTest/Max.md");
});

it("opens a client note when its card is activated", async () => {
  const view = harness({ records: [client("SaleTest/Max.md", {})] });
  await view.refresh();
  card(view).click();
  expect(view.app.workspace.getLeaf).toHaveBeenCalledWith(false);
  expect(openFileSpy(view.app)).toHaveBeenCalledWith(expect.objectContaining({ path: "SaleTest/Max.md" }));
});
```

- [ ] **Step 2: Run view tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-kanban-view.test.ts`

Expected: FAIL because the view is not implemented.

- [ ] **Step 3: Implement configuration loading and DOM rendering**

In `refresh`, resolve the board `TFile`, read its cached frontmatter, call `parseBoardConfig`, and render all returned errors inside `.client-kanban-error` when invalid. Otherwise call `repository.list`, `buildBoard`, empty `contentEl`, and construct semantic elements with Obsidian's `createDiv`/`createEl` helpers:

```text
.client-kanban-board
  .client-kanban-column[data-stage=""]
    .client-kanban-column-title
    .client-kanban-card-list[data-stage=""]
      .client-kanban-card[data-path="SaleTest/Max.md"]
        button.client-kanban-card-title
        .client-kanban-card-fields
```

Store a nullable stage as an empty `data-stage`. Use a real button for the title and open the current file resolved by path with `workspace.getLeaf(false).openFile(file)`.

- [ ] **Step 4: Run render and navigation tests**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-kanban-view.test.ts`

Expected: rendering, sparse fields, invalid configuration, missing folder, and navigation tests PASS.

- [ ] **Step 5: Write failing drag success and rollback tests**

Expose the injected Sortable callbacks from the harness and simulate `onEnd`:

```ts
it("writes the destination stage and refreshes after a drop", async () => {
  const view = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
  await view.refresh();
  await drop(view, "SaleTest/Max.md", "Contacted");
  expect(view.repository.setStage).toHaveBeenCalledWith("SaleTest/Max.md", "sales_stage", "Contacted");
  expect(view.repository.list).toHaveBeenCalledTimes(2);
});

it("removes the stage when dropped into Uncategorized", async () => {
  const view = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
  await view.refresh();
  await drop(view, "SaleTest/Max.md", null);
  expect(view.repository.setStage).toHaveBeenCalledWith("SaleTest/Max.md", "sales_stage", null);
});

it("notifies and refreshes from disk when a write fails", async () => {
  const view = harness({ setStageError: new Error("write failed") });
  await view.refresh();
  await drop(view, "SaleTest/Max.md", "Contacted");
  expect(notices()).toContain("Could not move Max: write failed");
  expect(view.repository.list).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 6: Implement SortableJS movement and cleanup**

Create one Sortable instance per `.client-kanban-card-list` with a shared group name and touch support (`delayOnTouchOnly: true`, `delay: 150`, `touchStartThreshold: 4`). In `onEnd`, read `event.item.dataset.path` and `event.to.dataset.stage`, map an empty stage to `null`, call `repository.setStage`, catch errors into `new Notice(...)`, and always `await refresh()`.

Destroy old Sortable instances before every rerender and in `onClose`. Guard concurrent refreshes with a monotonically increasing refresh token so only the latest asynchronous result renders.

- [ ] **Step 7: Run all view tests and commit**

Run: `cd plugin-development/client-kanban && npm test -- tests/client-kanban-view.test.ts && npm test && npm run build`

Expected: all tests PASS; production bundle includes SortableJS and has no Node runtime imports.

```bash
git add plugin-development/client-kanban/src/client-kanban-view.ts plugin-development/client-kanban/tests
git commit -m "feat: render and move client cards"
```

---

### Task 5: Activate board notes and refresh on relevant vault changes

**Files:**
- Create: `plugin-development/client-kanban/src/main.ts`
- Create: `plugin-development/client-kanban/tests/main.test.ts`
- Modify: `plugin-development/client-kanban/src/client-kanban-view.ts`
- Modify: `plugin-development/client-kanban/tests/client-kanban-view.test.ts`

**Interfaces:**
- Consumes: `CLIENT_KANBAN_VIEW_TYPE`, board note cached metadata, Obsidian workspace/vault/metadata events.
- Produces: default class `ClientKanbanPlugin extends Plugin`; command `client-kanban-open-current-board`; debounced `scheduleRefresh(changedPath?: string)` on the view.

- [ ] **Step 1: Write failing activation tests**

```ts
it("registers the custom view and opens a marked note as a board", async () => {
  const plugin = pluginHarness({ activeFile: file("SaleTest/Board.md", { client_kanban: true }) });
  await plugin.onload();
  await runCommand(plugin, "client-kanban-open-current-board");
  expect(activeLeaf(plugin).setViewState).toHaveBeenCalledWith({
    type: "client-kanban-view",
    active: true,
    state: { file: "SaleTest/Board.md" }
  });
});

it("does not convert an ordinary Markdown note", async () => {
  const plugin = pluginHarness({ activeFile: file("SaleTest/Max.md", { client_name: "Max" }) });
  await plugin.onload();
  await runCommand(plugin, "client-kanban-open-current-board");
  expect(notices()).toContain("The current note is not marked client_kanban: true");
  expect(activeLeaf(plugin).setViewState).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run activation tests and verify failure**

Run: `cd plugin-development/client-kanban && npm test -- tests/main.test.ts`

Expected: FAIL because the plugin entry point is missing.

- [ ] **Step 3: Implement plugin lifecycle and board activation**

In `onload`, register the view factory, add the command, and run activation through one helper:

```ts
private async openBoard(file: TFile, leaf = this.app.workspace.getLeaf(false)): Promise<void> {
  const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
  if (frontmatter?.client_kanban !== true) {
    new Notice("The current note is not marked client_kanban: true");
    return;
  }
  await leaf.setViewState({
    type: CLIENT_KANBAN_VIEW_TYPE,
    active: true,
    state: { file: file.path }
  });
}
```

Also register a file-menu action named **Open as Client Kanban** for marked notes. Do not automatically replace every Markdown file-open event in version one; explicit command/context activation avoids view-state loops and lets Obsidian persist the custom leaf state normally.

- [ ] **Step 4: Run activation tests**

Run: `cd plugin-development/client-kanban && npm test -- tests/main.test.ts`

Expected: custom view registration, marked-note activation, ordinary-note rejection, and unload cleanup tests PASS.

- [ ] **Step 5: Write failing event-filter and debounce tests**

```ts
it.each([
  ["SaleTest/New.md", true],
  ["SaleTest/Max.md", true],
  ["SaleTest/Archive/Old.md", false],
  ["Other/Client.md", false]
])("filters changed path %s", async (path, refreshes) => {
  const view = mountedView({ sourceFolder: "SaleTest" });
  triggerVaultModify(view.app, path);
  await vi.advanceTimersByTimeAsync(100);
  expect(view.repository.list).toHaveBeenCalledTimes(refreshes ? 2 : 1);
});

it("coalesces rapid relevant events", async () => {
  const view = mountedView({ sourceFolder: "SaleTest" });
  triggerMetadataChange(view.app, "SaleTest/Max.md");
  triggerVaultRename(view.app, "SaleTest/Max.md", "SaleTest/Max-New.md");
  triggerVaultDelete(view.app, "SaleTest/Max-New.md");
  await vi.advanceTimersByTimeAsync(100);
  expect(view.repository.list).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 6: Implement relevant-event refresh scheduling**

After a valid config loads, retain its normalized `sourceFolder`. Register vault `create`, `modify`, `delete`, and `rename` plus metadata-cache `changed` events in `onOpen`. A path is relevant only when `path.substring(0, path.lastIndexOf("/")) === sourceFolder`, except the board path itself, which is always relevant because its configuration may change.

Implement a 75 ms debounce with `window.setTimeout`; cancel the prior timer, register the timer through the component lifecycle, and call `void refresh()` once. Unregister events and clear the timer in `onClose`.

- [ ] **Step 7: Run full verification and commit**

Run: `cd plugin-development/client-kanban && npm test && npm run build`

Expected: all tests PASS and `main.js` builds successfully.

```bash
git add plugin-development/client-kanban/src plugin-development/client-kanban/tests
git commit -m "feat: activate and refresh client boards"
```

---

### Task 6: Style, deploy, and manually verify the SaleTest board

**Files:**
- Create: `plugin-development/client-kanban/src/styles.css`
- Create: `plugin-development/client-kanban/tools/deploy.sh`
- Create: `plugin-development/client-kanban/README.md`
- Modify: `plugin-development/client-kanban/src/main.ts`
- Modify: `SaleTest/Kanban View.md`

**Interfaces:**
- Consumes: DOM class contract from Task 4 and build outputs `main.js`, `manifest.json`, `styles.css`.
- Produces: readable responsive board, deterministic deployment, and a working board note for `SaleTest`.

- [ ] **Step 1: Add board styles and import them**

Import `./styles.css` from `src/main.ts`. Define styles only beneath `.client-kanban-view` and use Obsidian CSS variables. Required behavior:

```css
.client-kanban-view .client-kanban-board {
  display: flex;
  gap: var(--size-4-4);
  align-items: flex-start;
  overflow-x: auto;
  padding: var(--size-4-4);
}
.client-kanban-view .client-kanban-column {
  flex: 0 0 min(20rem, 85vw);
  background: var(--background-secondary);
  border-radius: var(--radius-m);
  padding: var(--size-4-3);
}
.client-kanban-view .client-kanban-card {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  box-shadow: var(--shadow-s);
  margin-block: var(--size-4-2);
  padding: var(--size-4-3);
}
.client-kanban-view .client-kanban-card-title {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-normal);
  font-weight: var(--font-semibold);
  text-align: start;
}
.client-kanban-view .client-kanban-card-field {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  overflow-wrap: anywhere;
}
.client-kanban-view .sortable-ghost { opacity: 0.35; }
.client-kanban-view .client-kanban-error { color: var(--text-error); padding: var(--size-4-4); }
```

- [ ] **Step 2: Build and confirm runtime artifacts**

Run: `cd plugin-development/client-kanban && npm test && npm run build`

Run: `test -s main.js && test -s manifest.json && test -s styles.css`

Expected: tests PASS, build succeeds, and all three runtime artifacts are non-empty.

- [ ] **Step 3: Add a deterministic deployment script**

Create executable `tools/deploy.sh` using this behavior:

```sh
#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target_dir=${1:-"$project_dir/../../.obsidian/plugins/client-kanban"}
mkdir -p "$target_dir"
cp "$project_dir/main.js" "$project_dir/manifest.json" "$project_dir/styles.css" "$target_dir/"
printf 'Deployed Client Kanban to %s\n' "$target_dir"
```

Do not delete or synchronize the target directory; copying exactly three known files avoids destructive behavior.

- [ ] **Step 4: Document development and usage**

In `README.md`, document `npm install`, `npm test`, `npm run build`, `npm run dev`, `tools/deploy.sh`, enabling **Client Kanban** in Obsidian, adding `client_kanban: true`, and invoking **Open as Client Kanban**. Include the accepted board and client YAML examples from the design specification.

- [ ] **Step 5: Convert the SaleTest board configuration**

Preserve any body content in `SaleTest/Kanban View.md`, replace the old `kanban_plugin` property with:

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

Do not migrate or rewrite client notes automatically. Add sample YAML manually only when the user explicitly authorizes changing those client records during execution.

- [ ] **Step 6: Deploy and perform the manual smoke test**

Run: `cd plugin-development/client-kanban && ./tools/deploy.sh`

In Obsidian:

1. Enable **Client Kanban** under Community plugins.
2. Open `SaleTest/Kanban View.md` and invoke **Open as Client Kanban**.
3. Confirm `StadtOffenburg.md` and `Stadtwerke.md` each appear once.
4. Confirm missing `client_name` falls back to the filename.
5. Add an optional configured field to one client and confirm only that card renders the field.
6. Click each card and confirm the correct note opens.
7. Drag a card into every configured stage and inspect that only `sales_stage` changes.
8. Drag it to Uncategorized and confirm only `sales_stage` is removed.
9. Create, edit, rename, and delete a temporary client note and confirm one debounced refresh for each action.
10. Temporarily set an unknown stage and confirm the card appears in Uncategorized without rewriting that value.
11. Temporarily break `source_folder` and duplicate a column, confirming actionable errors in both cases.
12. If a mobile Obsidian device is available, sync the installed assets and confirm touch dragging and note opening.

- [ ] **Step 7: Run final automated verification**

Run: `cd plugin-development/client-kanban && npm test && npm run build`

Run: `git diff --check`

Expected: all tests PASS, production build succeeds, and Git reports no whitespace errors.

- [ ] **Step 8: Commit the finished plugin and board configuration**

```bash
git add plugin-development/client-kanban .obsidian/plugins/client-kanban 'SaleTest/Kanban View.md'
git commit -m "feat: add configurable client kanban plugin"
```

---

## Final acceptance checklist

- [ ] Every requirement in `docs/superpowers/specs/2026-08-11-client-kanban-design.md` maps to an implementation task above.
- [ ] `npm test` passes from `plugin-development/client-kanban/`.
- [ ] `npm run build` produces `main.js`, `manifest.json`, and `styles.css`.
- [ ] The deployed plugin loads without Node/Electron dependencies and declares `isDesktopOnly: false`.
- [ ] Sparse per-client card fields render only when present.
- [ ] Frontmatter mutation tests prove unrelated YAML and Markdown body content are preserved.
- [ ] SaleTest manual smoke testing covers discovery, navigation, movement, Uncategorized, errors, and event refresh.
