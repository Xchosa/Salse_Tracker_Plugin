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

function client(path: string, frontmatter: Record<string, unknown>): ClientRecord {
  return { path, basename: path.split("/").at(-1)?.replace(/\.md$/, "") ?? path, frontmatter };
}

function fakeApp(): {
  vault: { getAbstractFileByPath: ReturnType<typeof vi.fn> };
  metadataCache: { getFileCache: ReturnType<typeof vi.fn> };
  workspace: { getLeaf: ReturnType<typeof vi.fn> };
} {
  const board = Object.assign(new TFile("SaleTest/Board.md"), {
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
    vault: { getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null) },
    metadataCache: { getFileCache: vi.fn((file: TFile) => ({ frontmatter: (file as TFile & { frontmatter: Record<string, unknown> }).frontmatter })) },
    workspace: { getLeaf: vi.fn(() => leaf) }
  };
}

function harness(options: {
  records?: ClientRecord[];
  setStageError?: Error;
  boardFrontmatter?: Record<string, unknown>;
  missingFolder?: boolean;
} = {}): Harness {
  const app = fakeApp();
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
    "SaleTest/Board.md",
    () => repository as never,
    sortableFactory
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

function openFileSpy(app: ReturnType<typeof fakeApp>): ReturnType<typeof vi.fn> {
  return app.workspace.getLeaf.mock.results[0]?.value.openFile;
}

async function drop(harness: Harness, path: string, stage: string | null): Promise<void> {
  const item = card(harness.view);
  item.dataset.path = path;
  const destination = harness.view.contentEl.querySelector<HTMLElement>(`.client-kanban-card-list[data-stage="${stage ?? ""}"]`);
  if (!destination) throw new Error("destination list not found");
  const handler = harness.dropHandlers[0];
  if (!handler) throw new Error("drop handler not found");
  await handler({ item, to: destination } as Sortable.SortableEvent);
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

  it("opens a client note when its card is activated", async () => {
    const { view, app } = harness({ records: [client("SaleTest/Max.md", {})] });
    const clientFile = new TFile("SaleTest/Max.md");
    const board = Object.assign(new TFile("SaleTest/Board.md"), {
      frontmatter: {
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

  it("serializes and restores the board file path", async () => {
    const { view, app } = harness();
    const replacementBoard = Object.assign(new TFile("SaleTest/Replacement.md"), {
      frontmatter: {
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
      group: "client-kanban-cards",
      draggable: ".client-kanban-card",
      delayOnTouchOnly: true,
      delay: 150,
      touchStartThreshold: 4
    });

    await board.view.refresh();
    expect(board.sortableDestroy).toHaveBeenCalledTimes(3);

    await board.view.onClose();
    expect(board.sortableDestroy).toHaveBeenCalledTimes(6);
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
});
