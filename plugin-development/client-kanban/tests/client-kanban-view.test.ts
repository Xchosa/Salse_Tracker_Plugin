import { beforeEach, describe, expect, it, vi } from "vitest";
import type Sortable from "sortablejs";
import type { App, WorkspaceLeaf } from "obsidian";
import { ClientKanbanView } from "../src/client-kanban-view";
import * as pluginEntry from "../src/main";
import type { BoardConfig, ClientRecord } from "../src/types";
import { TFile, clearNotices, recordedNotices } from "./obsidian";

const boardConfig: BoardConfig = {
  sourceFolder: "SaleTest",
  stageProperty: "sales_stage",
  columns: ["New", "Contacted"],
  cardFields: ["phone", "special_requirement"]
};

type Repository = {
  list: ReturnType<typeof vi.fn>;
  setStage: ReturnType<typeof vi.fn>;
};

type DropHandler = NonNullable<Sortable.Options["onEnd"]>;

type Harness = {
  view: ClientKanbanView;
  app: ReturnType<typeof fakeApp>;
  repository: Repository;
  dropHandlers: DropHandler[];
  sortableDestroy: ReturnType<typeof vi.fn>;
  sortableFactory: ReturnType<typeof vi.fn>;
};

type EventCallback = (...args: unknown[]) => unknown;

function eventBus() {
  const listeners = new Map<string, Set<EventCallback>>();
  return {
    on: vi.fn((name: string, callback: EventCallback) => {
      const callbacks = listeners.get(name) ?? new Set<EventCallback>();
      callbacks.add(callback);
      listeners.set(name, callbacks);
      return { name, callback };
    }),
    offref: vi.fn((ref: { name: string; callback: EventCallback }) => {
      listeners.get(ref.name)?.delete(ref.callback);
    }),
    trigger(name: string, ...args: unknown[]) {
      for (const callback of listeners.get(name) ?? []) callback(...args);
    }
  };
}

function client(path: string, frontmatter: Record<string, unknown>): ClientRecord {
  return { path, basename: path.split("/").at(-1)?.replace(/\.md$/, "") ?? path, frontmatter };
}

function fakeApp(boardPath = "SaleTest/Board.md"): {
  vault: ReturnType<typeof eventBus> & { getAbstractFileByPath: ReturnType<typeof vi.fn> };
  metadataCache: ReturnType<typeof eventBus> & { getFileCache: ReturnType<typeof vi.fn> };
  workspace: { getLeaf: ReturnType<typeof vi.fn> };
} {
  const board = Object.assign(new TFile(boardPath), {
    frontmatter: {
      client_kanban: true,
      source_folder: boardConfig.sourceFolder,
      stage_property: boardConfig.stageProperty,
      columns: boardConfig.columns,
      card_fields: boardConfig.cardFields
    }
  });
  const files = new Map<string, TFile>([[board.path, board]]);
  const openFile = vi.fn();
  const leaf = { openFile };
  return {
    vault: { ...eventBus(), getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null) },
    metadataCache: {
      ...eventBus(),
      getFileCache: vi.fn((file: TFile) => ({ frontmatter: (file as TFile & { frontmatter: Record<string, unknown> }).frontmatter }))
    },
    workspace: { getLeaf: vi.fn(() => leaf) }
  };
}

function harness(options: {
  records?: ClientRecord[];
  setStageError?: Error;
  boardFrontmatter?: Record<string, unknown>;
  missingFolder?: boolean;
  boardPath?: string;
  boardPathChanged?: (oldPath: string, newPath: string) => void | Promise<void>;
} = {}): Harness {
  const app = fakeApp(options.boardPath);
  const repository: Repository = {
    list: vi.fn(async () => {
      if (options.missingFolder) throw new Error('Source folder "SaleTest" was not found');
      return options.records ?? [client("SaleTest/Max.md", {})];
    }),
    setStage: options.setStageError
      ? vi.fn(async () => { throw options.setStageError; })
      : vi.fn(async () => undefined)
  };
  if (options.boardFrontmatter) {
    app.metadataCache.getFileCache.mockReturnValue({ frontmatter: options.boardFrontmatter });
  }
  const dropHandlers: DropHandler[] = [];
  const sortableDestroy = vi.fn();
  const sortableFactory = vi.fn((_element: HTMLElement, options: Sortable.Options) => {
    if (options.onEnd) dropHandlers.push(options.onEnd);
    return { destroy: sortableDestroy } as unknown as Sortable;
  });
  const view = new ClientKanbanView(
    {} as WorkspaceLeaf,
    app as unknown as App,
    options.boardPath ?? "SaleTest/Board.md",
    () => repository as never,
    sortableFactory,
    options.boardPathChanged
  );
  return { view, app, repository, dropHandlers, sortableDestroy, sortableFactory };
}

function card(view: ClientKanbanView): HTMLElement {
  const element = view.contentEl.querySelector<HTMLElement>(".client-kanban-card");
  if (!element) throw new Error("card not found");
  return element;
}

function labels(view: ClientKanbanView, selector: string): string[] {
  return [...view.contentEl.querySelectorAll(selector)].map((element) => element.textContent ?? "");
}

function text(view: ClientKanbanView, selector: string): string {
  const element = view.contentEl.querySelector(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element.textContent ?? "";
}

function editButton(view: ClientKanbanView): HTMLButtonElement {
  const button = view.contentEl.querySelector<HTMLButtonElement>(".client-kanban-edit-board");
  if (!button) throw new Error("edit button not found");
  return button;
}

function openFileSpy(app: ReturnType<typeof fakeApp>): ReturnType<typeof vi.fn> {
  return app.workspace.getLeaf.mock.results[0]?.value.openFile;
}

async function drop(harness: Harness, path: string, stage: string | null): Promise<void> {
  const item = card(harness.view);
  item.dataset.path = path;
  const source = item.parentElement;
  if (!source) throw new Error("source list not found");
  const destination = harness.view.contentEl.querySelector<HTMLElement>(`.client-kanban-card-list[data-stage="${stage ?? ""}"]`);
  if (!destination) throw new Error("destination list not found");
  const handler = harness.dropHandlers[0];
  if (!handler) throw new Error("drop handler not found");
  await handler({ item, from: source, to: destination } as Sortable.SortableEvent);
}

beforeEach(() => clearNotices());

describe("ClientKanbanView", () => {
  it("exports the view through the production entry point", () => {
    expect(pluginEntry.ClientKanbanView).toBe(ClientKanbanView);
    expect(pluginEntry.CLIENT_KANBAN_VIEW_TYPE).toBe("client-kanban-view");
  });

  it("renders columns, sparse fields, and source paths", async () => {
    const { view } = harness({ records: [client("SaleTest/Max.md", {
      client_name: "Max", sales_stage: "New", phone: "123", special_requirement: "Ramp"
    })] });

    await view.refresh();

    expect(labels(view, ".client-kanban-column-title")).toEqual(["Uncategorized", "New", "Contacted"]);
    expect(text(view, ".client-kanban-card-title")).toBe("Max");
    expect(labels(view, ".client-kanban-card-field")).toEqual(["phone: 123", "special_requirement: Ramp"]);
    expect(card(view).dataset.path).toBe("SaleTest/Max.md");
  });

  it("keeps every empty column as an active card-list drop destination", async () => {
    const board = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });

    await board.view.refresh();

    const lists = [...board.view.contentEl.querySelectorAll<HTMLElement>(".client-kanban-card-list")];
    expect(lists.map((list) => list.childElementCount)).toEqual([0, 1, 0]);
    expect(board.sortableFactory.mock.calls.map((call) => call[0])).toEqual(lists);
  });

  it("renders the board beneath the scoped view root across reopen", async () => {
    const { view } = harness();

    await view.onOpen();

    expect(view.contentEl.querySelector(".client-kanban-board")?.closest(".client-kanban-view"))
      .toBe(view.contentEl);

    await view.onClose();
    await view.onOpen();

    expect(view.contentEl.querySelector(".client-kanban-board")?.closest(".client-kanban-view"))
      .toBe(view.contentEl);
  });

  it("opens a client note when its card is activated", async () => {
    const { view, app } = harness({ records: [client("SaleTest/Max.md", {})] });
    const clientFile = new TFile("SaleTest/Max.md");
    const board = Object.assign(new TFile("SaleTest/Board.md"), {
      frontmatter: {
        client_kanban: true,
        source_folder: "SaleTest",
        stage_property: "sales_stage",
        columns: ["New", "Contacted"],
        card_fields: ["phone", "special_requirement"]
      }
    });
    app.vault.getAbstractFileByPath.mockImplementation((path: string) => path === clientFile.path ? clientFile : board);

    await view.refresh();
    card(view).click();

    expect(app.workspace.getLeaf).toHaveBeenCalledWith(false);
    expect(openFileSpy(app)).toHaveBeenCalledWith(expect.objectContaining({ path: "SaleTest/Max.md" }));
  });

  it("renders an accessible pencil action for a valid board", async () => {
    const { view } = harness();

    await view.refresh();

    const button = editButton(view);
    expect(button.type).toBe("button");
    expect(button.title).toBe("Edit board configuration");
    expect(button.getAttribute("aria-label")).toBe("Edit board configuration");
    expect(button.dataset.icon).toBe("pencil");
    expect(button.closest(".client-kanban-toolbar")).not.toBeNull();
  });

  it("opens malformed board configuration in a separate tab", async () => {
    const { view, app } = harness({ boardFrontmatter: { client_kanban: true, columns: [] } });

    await view.refresh();
    editButton(view).click();

    expect(view.contentEl.querySelector(".client-kanban-error")).not.toBeNull();
    expect(app.workspace.getLeaf).toHaveBeenCalledWith("tab");
    expect(openFileSpy(app)).toHaveBeenCalledWith(expect.objectContaining({ path: "SaleTest/Board.md" }));
  });

  it("re-resolves the board before editing and reports when it became unavailable", async () => {
    const { view, app } = harness();
    await view.refresh();
    app.vault.getAbstractFileByPath.mockReturnValue(null);

    editButton(view).click();

    expect(recordedNotices()).toContain('Board note "SaleTest/Board.md" is unavailable');
    expect(app.workspace.getLeaf).not.toHaveBeenCalled();
  });

  it("does not render an edit toolbar when the board file is unavailable", async () => {
    const { view, app } = harness();
    app.vault.getAbstractFileByPath.mockReturnValue(null);

    await view.refresh();

    expect(view.contentEl.querySelector(".client-kanban-toolbar")).toBeNull();
    expect(labels(view, ".client-kanban-error")).toEqual([
      'Board note "SaleTest/Board.md" is unavailable'
    ]);
  });

  it("serializes and restores the board file path", async () => {
    const { view, app } = harness();
    const replacementBoard = Object.assign(new TFile("SaleTest/Replacement.md"), {
      frontmatter: {
        client_kanban: true,
        source_folder: "SaleTest",
        stage_property: "sales_stage",
        columns: ["New", "Contacted"],
        card_fields: []
      }
    });
    app.vault.getAbstractFileByPath.mockImplementation(() => replacementBoard);

    await view.setState({ file: "SaleTest/Replacement.md" });

    expect(view.getState()).toEqual({ file: "SaleTest/Replacement.md" });
    expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith("SaleTest/Replacement.md");
  });

  it("reports the renamed board path through the supplied callback", async () => {
    const changed = vi.fn();
    const { view, app } = harness({ boardPathChanged: changed });
    await view.onOpen();

    app.vault.trigger("rename", new TFile("SaleTest/Renamed.md"), "SaleTest/Board.md");

    expect(changed).toHaveBeenCalledWith("SaleTest/Board.md", "SaleTest/Renamed.md");
  });

  it("notifies when a rename callback fails without preventing refresh", async () => {
    vi.useFakeTimers();
    try {
      const renamedBoard = Object.assign(new TFile("SaleTest/Renamed.md"), {
        frontmatter: {
          client_kanban: true,
          source_folder: "SaleTest",
          stage_property: "sales_stage",
          columns: ["New", "Contacted"],
          card_fields: []
        }
      });
      const board = harness({
        boardPathChanged: vi.fn(async () => { throw new Error("save failed"); })
      });
      await board.view.onOpen();
      board.app.vault.getAbstractFileByPath.mockImplementation(
        (path: string) => path === renamedBoard.path ? renamedBoard : null
      );

      board.app.vault.trigger("rename", renamedBoard, "SaleTest/Board.md");
      await vi.advanceTimersByTimeAsync(100);

      expect(recordedNotices()).toContain(
        "Could not update the renamed Client Kanban board: save failed"
      );
      expect(board.repository.list).toHaveBeenCalledTimes(2);
      expect(board.view.getState()).toEqual({ file: "SaleTest/Renamed.md" });
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders configuration and repository errors", async () => {
    const invalid = harness({ boardFrontmatter: { client_kanban: true } });
    await invalid.view.refresh();
    expect(labels(invalid.view, ".client-kanban-error")).toEqual([
      "source_folder must be a non-empty string",
      "stage_property must be a non-empty string",
      "columns must contain at least one value"
    ]);

    const missing = harness({ missingFolder: true });
    await missing.view.refresh();
    expect(labels(missing.view, ".client-kanban-error")).toEqual(['Source folder "SaleTest" was not found']);
  });

  it("writes the destination stage and refreshes after a drop", async () => {
    const board = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
    await board.view.refresh();

    await drop(board, "SaleTest/Max.md", "Contacted");

    expect(board.repository.setStage).toHaveBeenCalledWith("SaleTest/Max.md", "sales_stage", "Contacted");
    expect(board.repository.list).toHaveBeenCalledTimes(2);
  });

  it("removes the stage when dropped into Uncategorized", async () => {
    const board = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
    await board.view.refresh();

    await drop(board, "SaleTest/Max.md", null);

    expect(board.repository.setStage).toHaveBeenCalledWith("SaleTest/Max.md", "sales_stage", null);
  });

  it("preserves an unknown stage when released within Uncategorized and restores repository order", async () => {
    const board = harness({ records: [
      client("SaleTest/Alpha.md", { client_name: "Alpha", sales_stage: "Legacy" }),
      client("SaleTest/Beta.md", { client_name: "Beta", sales_stage: "Archived" })
    ] });
    await board.view.refresh();
    const uncategorized = board.view.contentEl.querySelector<HTMLElement>(
      '.client-kanban-card-list[data-stage=""]'
    );
    const alpha = board.view.contentEl.querySelector<HTMLElement>(
      '.client-kanban-card[data-path="SaleTest/Alpha.md"]'
    );
    const handler = board.dropHandlers[0];
    if (!uncategorized || !alpha || !handler) throw new Error("same-list fixture not found");
    uncategorized.append(alpha);

    await handler({ item: alpha, from: uncategorized, to: uncategorized } as Sortable.SortableEvent);

    expect(board.repository.setStage).not.toHaveBeenCalled();
    expect(board.repository.list).toHaveBeenCalledTimes(2);
    expect(labels(board.view, ".client-kanban-card-title")).toEqual(["Alpha", "Beta"]);
  });

  it("notifies and refreshes from disk when a write fails", async () => {
    const board = harness({ setStageError: new Error("write failed") });
    await board.view.refresh();

    await drop(board, "SaleTest/Max.md", "Contacted");

    expect(recordedNotices()).toContain("Could not move Max: write failed");
    expect(board.repository.list).toHaveBeenCalledTimes(2);
  });

  it("configures one touch-capable sortable per column and cleans them up", async () => {
    const board = harness();

    await board.view.refresh();

    expect(board.sortableFactory).toHaveBeenCalledTimes(3);
    expect(board.sortableFactory.mock.calls[0]?.[1]).toMatchObject({
      draggable: ".client-kanban-card",
      delayOnTouchOnly: true,
      delay: 150,
      touchStartThreshold: 4
    });
    const group = board.sortableFactory.mock.calls[0]?.[1].group;
    expect(group).toEqual(expect.any(String));
    expect(board.sortableFactory.mock.calls.map((call) => call[1].group)).toEqual([group, group, group]);

    await board.view.refresh();
    expect(board.sortableDestroy).toHaveBeenCalledTimes(3);

    await board.view.onClose();
    expect(board.sortableDestroy).toHaveBeenCalledTimes(6);
  });

  it("isolates card drag groups between two board views", async () => {
    const first = harness({ boardPath: "Boards/First.md" });
    const second = harness({ boardPath: "Boards/Second.md" });

    await first.view.refresh();
    await second.view.refresh();

    const firstGroups = first.sortableFactory.mock.calls.map((call) => call[1].group);
    const secondGroups = second.sortableFactory.mock.calls.map((call) => call[1].group);
    expect(new Set(firstGroups).size).toBe(1);
    expect(new Set(secondGroups).size).toBe(1);
    expect(firstGroups[0]).not.toBe(secondGroups[0]);
  });

  it("rejects a drop destination outside its own view and restores the board", async () => {
    const board = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
    await board.view.refresh();
    const handler = board.dropHandlers[0];
    if (!handler) throw new Error("drop handler not found");
    const outside = document.createElement("div");
    outside.dataset.stage = "Contacted";
    const item = card(board.view);
    const source = item.parentElement;
    if (!source) throw new Error("outside-drop source not found");

    await handler({ item, from: source, to: outside } as unknown as Sortable.SortableEvent);

    expect(board.repository.setStage).not.toHaveBeenCalled();
    expect(board.repository.list).toHaveBeenCalledTimes(2);
  });

  it("renders only the latest concurrent refresh", async () => {
    const board = harness();
    let resolveFirst!: (records: ClientRecord[]) => void;
    board.repository.list
      .mockImplementationOnce(() => new Promise<ClientRecord[]>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([client("SaleTest/Newest.md", { client_name: "Newest" })]);

    const staleRefresh = board.view.refresh();
    await board.view.refresh();
    resolveFirst([client("SaleTest/Stale.md", { client_name: "Stale" })]);
    await staleRefresh;

    expect(text(board.view, ".client-kanban-card-title")).toBe("Newest");
  });

  it("does not render an in-flight refresh after closing", async () => {
    const board = harness();
    let resolveList!: (records: ClientRecord[]) => void;
    board.repository.list.mockImplementationOnce(
      () => new Promise<ClientRecord[]>((resolve) => { resolveList = resolve; })
    );

    const refresh = board.view.refresh();
    await board.view.onClose();
    resolveList([client("SaleTest/Max.md", { client_name: "Max" })]);
    await refresh;

    expect(board.view.contentEl.querySelector(".client-kanban-board")).toBeNull();
    expect(board.sortableFactory).not.toHaveBeenCalled();
  });

  it("does not refresh after an in-flight move settles after closing", async () => {
    const board = harness({ records: [client("SaleTest/Max.md", { sales_stage: "New" })] });
    let resolveWrite!: () => void;
    board.repository.setStage.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveWrite = resolve; })
    );
    await board.view.refresh();

    const move = drop(board, "SaleTest/Max.md", "Contacted");
    await board.view.onClose();
    resolveWrite();
    await move;

    expect(board.repository.list).toHaveBeenCalledTimes(1);
    expect(board.sortableFactory).toHaveBeenCalledTimes(3);
    expect(board.sortableDestroy).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["SaleTest/New.md", true],
    ["SaleTest/Max.md", true],
    ["SaleTest/Archive/Old.md", false],
    ["Other/Client.md", false]
  ])("filters changed path %s", async (path, refreshes) => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();

      board.app.vault.trigger("modify", new TFile(path));
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(refreshes ? 2 : 1);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces rapid relevant vault and metadata events", async () => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();

      board.app.metadataCache.trigger("changed", new TFile("SaleTest/Max.md"), "", {});
      board.app.vault.trigger("rename", new TFile("SaleTest/Max-New.md"), "SaleTest/Max.md");
      board.app.vault.trigger("delete", new TFile("SaleTest/Max-New.md"));
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(2);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["Other/Max.md", "SaleTest/Max.md"],
    ["SaleTest/Max.md", "Other/Max.md"]
  ])("refreshes when rename crosses the source-folder boundary from %s to %s", async (oldPath, newPath) => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();

      board.app.vault.trigger("rename", new TFile(newPath), oldPath);
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(2);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes for board metadata changes and adopts the changed source folder", async () => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();
      board.app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: {
          client_kanban: true,
          source_folder: "Prospects",
          stage_property: "sales_stage",
          columns: ["New"],
          card_fields: []
        }
      });

      board.app.metadataCache.trigger("changed", new TFile("SaleTest/Board.md"), "", {});
      await vi.advanceTimersByTimeAsync(100);
      board.app.vault.trigger("create", new TFile("Prospects/New.md"));
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(3);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders an actionable configuration error when the board marker is removed", async () => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();
      board.app.metadataCache.getFileCache.mockReturnValue({
        frontmatter: {
          source_folder: "SaleTest",
          stage_property: "sales_stage",
          columns: ["New"],
          card_fields: []
        }
      });

      board.app.metadataCache.trigger("changed", new TFile("SaleTest/Board.md"), "", {});
      await vi.advanceTimersByTimeAsync(100);

      expect(labels(board.view, ".client-kanban-error")).toEqual([
        "client_kanban must be true to use this note as a Client Kanban board"
      ]);
      expect(board.repository.list).toHaveBeenCalledTimes(1);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("always refreshes when the board note changes outside the source folder", async () => {
    vi.useFakeTimers();
    try {
      const board = harness({ boardPath: "Boards/Sales.md" });
      await board.view.onOpen();

      board.app.vault.trigger("modify", new TFile("Boards/Sales.md"));
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(2);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adopts a renamed board path before refreshing and serializing state", async () => {
    vi.useFakeTimers();
    try {
      const board = harness({ boardPath: "Boards/Sales.md" });
      await board.view.onOpen();
      const renamedBoard = Object.assign(new TFile("Boards/Renamed Sales.md"), {
        frontmatter: {
          client_kanban: true,
          source_folder: "SaleTest",
          stage_property: "sales_stage",
          columns: ["New", "Contacted"],
          card_fields: []
        }
      });
      board.app.vault.getAbstractFileByPath.mockImplementation(
        (path: string) => path === renamedBoard.path ? renamedBoard : null
      );

      board.app.vault.trigger("rename", renamedBoard, "Boards/Sales.md");
      await vi.advanceTimersByTimeAsync(100);

      expect(board.view.getState()).toEqual({ file: "Boards/Renamed Sales.md" });
      expect(board.app.vault.getAbstractFileByPath).toHaveBeenLastCalledWith("Boards/Renamed Sales.md");
      expect(board.repository.list).toHaveBeenCalledTimes(2);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats only direct children of a root-level source folder as relevant", async () => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();

      board.app.vault.trigger("create", new TFile("SaleTest/New.md"));
      board.app.vault.trigger("create", new TFile("SaleTest/Nested/New.md"));
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(2);
      await board.view.onClose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unregisters refresh events and cancels a pending refresh when closed", async () => {
    vi.useFakeTimers();
    try {
      const board = harness();
      await board.view.onOpen();
      board.app.vault.trigger("modify", new TFile("SaleTest/Max.md"));

      await board.view.onClose();
      board.app.metadataCache.trigger("changed", new TFile("SaleTest/Max.md"), "", {});
      await vi.advanceTimersByTimeAsync(100);

      expect(board.repository.list).toHaveBeenCalledTimes(1);
      expect(board.app.vault.offref).toHaveBeenCalledTimes(4);
      expect(board.app.metadataCache.offref).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
