import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, Command, Menu, PluginManifest, ViewCreator, WorkspaceLeaf } from "obsidian";
import ClientKanbanPlugin, { CLIENT_KANBAN_VIEW_TYPE, ClientKanbanView } from "../src/main";
import { TFile, clearNotices, recordedNotices } from "./obsidian";

type TestFile = TFile & { frontmatter: Record<string, unknown> };
type EventCallback = (...args: unknown[]) => unknown;

function deferred(): {
  promise: Promise<void>;
  resolve(): void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => { resolve = settle; });
  return { promise, resolve };
}

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

function file(path: string, frontmatter: Record<string, unknown>): TestFile {
  return Object.assign(new TFile(path), { frontmatter });
}

function pluginHarness(options: {
  activeFile?: TestFile | null;
  files?: TestFile[];
  storedData?: unknown;
  loadDataError?: Error;
  saveDataError?: Error;
  saveData?: (data: unknown) => Promise<void>;
  setViewStateError?: Error;
} = {}) {
  const leaf = {
    setViewState: vi.fn(async () => {
      if (options.setViewStateError) throw options.setViewStateError;
    })
  };
  const workspaceEvents = new Map<string, (...args: unknown[]) => unknown>();
  const vaultEvents = eventBus();
  const metadataEvents = eventBus();
  const app = {
    metadataCache: {
      ...metadataEvents,
      getFileCache: vi.fn((target: TestFile) => ({ frontmatter: target.frontmatter }))
    },
    vault: {
      ...vaultEvents,
      getAbstractFileByPath: vi.fn((path: string) => options.files?.find((target) => target.path === path) ?? null)
    },
    workspace: {
      getActiveFile: vi.fn(() => options.activeFile ?? null),
      getLeaf: vi.fn(() => leaf),
      on: vi.fn((name: string, callback: (...args: unknown[]) => unknown) => {
        workspaceEvents.set(name, callback);
        return { name, callback };
      })
    }
  };
  const plugin = new ClientKanbanPlugin(app as unknown as App, {} as PluginManifest);
  const commands = new Map<string, Command>();
  const views = new Map<string, ViewCreator>();
  plugin.addCommand = vi.fn((command: Command) => {
    commands.set(command.id, command);
    return command;
  });
  plugin.registerView = vi.fn((type: string, creator: ViewCreator) => {
    views.set(type, creator);
  });
  plugin.registerEvent = vi.fn();
  plugin.loadData = vi.fn(async () => {
    if (options.loadDataError) throw options.loadDataError;
    return options.storedData;
  });
  plugin.saveData = vi.fn(async (data: unknown) => {
    if (options.saveDataError) throw options.saveDataError;
    await options.saveData?.(data);
  });
  const ribbon = { icon: "", title: "", callback: async () => undefined as unknown };
  plugin.addRibbonIcon = vi.fn((icon, title, callback) => {
    ribbon.icon = icon;
    ribbon.title = title;
    ribbon.callback = callback;
    return {} as HTMLElement;
  });
  return { app, commands, leaf, metadataEvents, plugin, ribbon, vaultEvents, views, workspaceEvents };
}

async function runCommand(harness: ReturnType<typeof pluginHarness>, id: string): Promise<void> {
  const callback = harness.commands.get(id)?.callback;
  if (!callback) throw new Error(`Command ${id} was not registered with a callback`);
  await callback();
}

beforeEach(() => clearNotices());

describe("ClientKanbanPlugin", () => {
  it("registers the custom view and opens a marked note as a board", async () => {
    const harness = pluginHarness({ activeFile: file("SaleTest/Board.md", { client_kanban: true }) });

    await harness.plugin.onload();
    await runCommand(harness, "client-kanban-open-current-board");

    expect(harness.plugin.registerView).toHaveBeenCalledWith(CLIENT_KANBAN_VIEW_TYPE, expect.any(Function));
    expect(harness.leaf.setViewState).toHaveBeenCalledWith({
      type: "client-kanban-view",
      active: true,
      state: { file: "SaleTest/Board.md" }
    });
    const creator = harness.views.get(CLIENT_KANBAN_VIEW_TYPE);
    expect(creator?.({} as WorkspaceLeaf)).toBeInstanceOf(ClientKanbanView);
  });

  it("does not convert an ordinary Markdown note", async () => {
    const harness = pluginHarness({ activeFile: file("SaleTest/Max.md", { client_name: "Max" }) });

    await harness.plugin.onload();
    await runCommand(harness, "client-kanban-open-current-board");

    expect(recordedNotices()).toContain("The current note is not marked client_kanban: true");
    expect(harness.leaf.setViewState).not.toHaveBeenCalled();
  });

  it("does not convert a marked non-Markdown file", async () => {
    const harness = pluginHarness({ activeFile: file("SaleTest/Board.canvas", { client_kanban: true }) });

    await harness.plugin.onload();
    await runCommand(harness, "client-kanban-open-current-board");

    expect(recordedNotices()).toContain("The current note is not marked client_kanban: true");
    expect(harness.leaf.setViewState).not.toHaveBeenCalled();
    expect(harness.plugin.saveData).not.toHaveBeenCalled();
  });

  it("adds Open as Client Kanban only to marked note menus and uses the supplied leaf", async () => {
    const harness = pluginHarness();
    const marked = file("SaleTest/Board.md", { client_kanban: true });
    const ordinary = file("SaleTest/Max.md", { client_name: "Max" });
    const suppliedLeaf = { setViewState: vi.fn(async () => undefined) };
    const menuItems: Array<{ title?: string; callback?: () => unknown }> = [];
    const menu = {
      addItem(callback: (item: { setTitle(title: string): unknown; onClick(handler: () => unknown): unknown }) => unknown) {
        const record: { title?: string; callback?: () => unknown } = {};
        callback({
          setTitle(title: string) { record.title = title; return this; },
          onClick(handler: () => unknown) { record.callback = handler; return this; }
        });
        menuItems.push(record);
      }
    };

    await harness.plugin.onload();
    const fileMenu = harness.workspaceEvents.get("file-menu");
    fileMenu?.(menu as unknown as Menu, ordinary, "test", suppliedLeaf as unknown as WorkspaceLeaf);
    expect(menuItems).toHaveLength(0);

    fileMenu?.(menu as unknown as Menu, marked, "test", suppliedLeaf as unknown as WorkspaceLeaf);
    expect(menuItems).toHaveLength(1);
    expect(menuItems[0]?.title).toBe("Open as Client Kanban");
    await menuItems[0]?.callback?.();
    expect(suppliedLeaf.setViewState).toHaveBeenCalledWith({
      type: CLIENT_KANBAN_VIEW_TYPE,
      active: true,
      state: { file: "SaleTest/Board.md" }
    });
  });

  it("registers the file-menu event for plugin unload cleanup", async () => {
    const harness = pluginHarness();

    await harness.plugin.onload();

    expect(harness.plugin.registerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "file-menu", callback: expect.any(Function) })
    );
  });

  it("reopens the persisted last board from the ribbon", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const harness = pluginHarness({ files: [board], storedData: { lastBoardPath: board.path } });

    await harness.plugin.onload();
    await harness.ribbon.callback();

    expect(harness.ribbon).toMatchObject({ icon: "columns-3", title: "Open last Client Kanban" });
    expect(harness.leaf.setViewState).toHaveBeenCalledWith({
      type: CLIENT_KANBAN_VIEW_TYPE,
      active: true,
      state: { file: board.path }
    });
  });

  it("persists a board path only after successful activation", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const harness = pluginHarness({ activeFile: board });

    await harness.plugin.onload();
    await runCommand(harness, "client-kanban-open-current-board");

    expect(harness.plugin.saveData).toHaveBeenCalledWith({ lastBoardPath: board.path });
  });

  it("serializes immutable snapshots so the latest rapid open is the final disk state", async () => {
    const firstBoard = file("SaleTest/First.md", { client_kanban: true });
    const latestBoard = file("SaleTest/Latest.md", { client_kanban: true });
    const firstWrite = deferred();
    const secondWrite = deferred();
    let persisted: unknown;
    let writeNumber = 0;
    const harness = pluginHarness({
      saveData: async (snapshot) => {
        const gate = writeNumber++ === 0 ? firstWrite : secondWrite;
        await gate.promise;
        persisted = snapshot;
      }
    });
    harness.app.workspace.getActiveFile
      .mockReturnValueOnce(firstBoard)
      .mockReturnValueOnce(latestBoard);

    await harness.plugin.onload();
    const firstOpen = runCommand(harness, "client-kanban-open-current-board");
    const latestOpen = runCommand(harness, "client-kanban-open-current-board");
    await vi.waitFor(() => expect(harness.plugin.saveData).toHaveBeenCalled());
    const writesBeforeFirstSettles = vi.mocked(harness.plugin.saveData).mock.calls.length;

    secondWrite.resolve();
    firstWrite.resolve();
    await Promise.all([firstOpen, latestOpen]);

    expect(writesBeforeFirstSettles).toBe(1);
    expect(vi.mocked(harness.plugin.saveData).mock.calls).toEqual([
      [{ lastBoardPath: firstBoard.path }],
      [{ lastBoardPath: latestBoard.path }]
    ]);
    expect(persisted).toEqual({ lastBoardPath: latestBoard.path });
  });

  it("continues the save queue after a failed write and persists the latest rapid open", async () => {
    const firstBoard = file("SaleTest/First.md", { client_kanban: true });
    const latestBoard = file("SaleTest/Latest.md", { client_kanban: true });
    const firstWrite = deferred();
    let persisted: unknown;
    let writeNumber = 0;
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const harness = pluginHarness({
      files: [latestBoard],
      saveData: async (snapshot) => {
        if (writeNumber++ === 0) {
          await firstWrite.promise;
          throw new Error("first write failed");
        }
        persisted = snapshot;
      }
    });
    harness.app.workspace.getActiveFile
      .mockReturnValueOnce(firstBoard)
      .mockReturnValueOnce(latestBoard);

    await harness.plugin.onload();
    const firstOpen = runCommand(harness, "client-kanban-open-current-board");
    const latestOpen = runCommand(harness, "client-kanban-open-current-board");
    await vi.waitFor(() => expect(harness.plugin.saveData).toHaveBeenCalled());
    const writesBeforeFailure = vi.mocked(harness.plugin.saveData).mock.calls.length;
    firstWrite.resolve();
    await Promise.all([firstOpen, latestOpen]);
    await harness.ribbon.callback();

    expect(writesBeforeFailure).toBe(1);
    expect(persisted).toEqual({ lastBoardPath: latestBoard.path });
    expect(recordedNotices()).toEqual(["Could not save the last Client Kanban board."]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(harness.leaf.setViewState).toHaveBeenLastCalledWith({
      type: CLIENT_KANBAN_VIEW_TYPE,
      active: true,
      state: { file: latestBoard.path }
    });
    logError.mockRestore();
  });

  it("persists a remembered rename through the registered view factory", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const renamed = file("SaleTest/Renamed.md", { client_kanban: true });
    const harness = pluginHarness({ files: [board, renamed], storedData: { lastBoardPath: board.path } });

    await harness.plugin.onload();
    const creator = harness.views.get(CLIENT_KANBAN_VIEW_TYPE);
    const view = creator?.({} as WorkspaceLeaf) as ClientKanbanView;
    await view.setState({ file: board.path });
    await view.onOpen();
    harness.vaultEvents.trigger("rename", renamed, board.path);
    await vi.waitFor(() => expect(harness.plugin.saveData).toHaveBeenCalledWith({ lastBoardPath: renamed.path }));

    expect(harness.plugin.saveData).toHaveBeenCalledTimes(1);
    await view.onClose();
  });

  it("does not persist a non-remembered rename through the registered view factory", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const renamed = file("SaleTest/Renamed.md", { client_kanban: true });
    const harness = pluginHarness({
      files: [board, renamed],
      storedData: { lastBoardPath: "SaleTest/Remembered.md" }
    });

    await harness.plugin.onload();
    const creator = harness.views.get(CLIENT_KANBAN_VIEW_TYPE);
    const view = creator?.({} as WorkspaceLeaf) as ClientKanbanView;
    await view.setState({ file: board.path });
    await view.onOpen();
    harness.vaultEvents.trigger("rename", renamed, board.path);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.plugin.saveData).not.toHaveBeenCalled();
    await view.onClose();
  });

  it("serializes rapid remembered renames so the latest path is the final disk state", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const firstRename = file("SaleTest/First.md", { client_kanban: true });
    const latestRename = file("SaleTest/Latest.md", { client_kanban: true });
    const firstWrite = deferred();
    const secondWrite = deferred();
    let persisted: unknown;
    let writeNumber = 0;
    const harness = pluginHarness({
      files: [board, firstRename, latestRename],
      storedData: { lastBoardPath: board.path },
      saveData: async (snapshot) => {
        const gate = writeNumber++ === 0 ? firstWrite : secondWrite;
        await gate.promise;
        persisted = snapshot;
      }
    });

    await harness.plugin.onload();
    const creator = harness.views.get(CLIENT_KANBAN_VIEW_TYPE);
    const view = creator?.({} as WorkspaceLeaf) as ClientKanbanView;
    await view.setState({ file: board.path });
    await view.onOpen();
    harness.vaultEvents.trigger("rename", firstRename, board.path);
    harness.vaultEvents.trigger("rename", latestRename, firstRename.path);
    await vi.waitFor(() => expect(harness.plugin.saveData).toHaveBeenCalled());
    const writesBeforeFirstSettles = vi.mocked(harness.plugin.saveData).mock.calls.length;

    secondWrite.resolve();
    firstWrite.resolve();
    await vi.waitFor(() => expect(harness.plugin.saveData).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(persisted).toEqual({ lastBoardPath: latestRename.path }));

    expect(writesBeforeFirstSettles).toBe(1);
    expect(vi.mocked(harness.plugin.saveData).mock.calls).toEqual([
      [{ lastBoardPath: firstRename.path }],
      [{ lastBoardPath: latestRename.path }]
    ]);
    await view.onClose();
  });

  it("treats missing or malformed persisted data as no remembered board", async () => {
    for (const storedData of [undefined, null, "SaleTest/Board.md", {}, { lastBoardPath: "" }, { lastBoardPath: 42 }]) {
      const harness = pluginHarness({ storedData });

      await harness.plugin.onload();
      await harness.ribbon.callback();

      expect(recordedNotices()).toContain("Open a note marked client_kanban: true first.");
      clearNotices();
    }
  });

  it("continues startup with no remembered board when loading data fails", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const harness = pluginHarness({ loadDataError: new Error("disk unavailable") });

    await harness.plugin.onload();
    await harness.ribbon.callback();

    expect(recordedNotices()).toContain("Open a note marked client_kanban: true first.");
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });

  it("reports an unavailable remembered board without clearing it", async () => {
    const harness = pluginHarness({ storedData: { lastBoardPath: "SaleTest/Missing.md" } });

    await harness.plugin.onload();
    await harness.ribbon.callback();

    expect(recordedNotices()).toContain("The last Client Kanban board is unavailable: SaleTest/Missing.md");
    expect(harness.plugin.saveData).not.toHaveBeenCalled();
  });

  it("reports a remembered non-Markdown file as unavailable", async () => {
    const board = file("SaleTest/Board.canvas", { client_kanban: true });
    const harness = pluginHarness({ files: [board], storedData: { lastBoardPath: board.path } });

    await harness.plugin.onload();
    await harness.ribbon.callback();

    expect(recordedNotices()).toContain(
      "The last Client Kanban board is unavailable: SaleTest/Board.canvas"
    );
    expect(harness.leaf.setViewState).not.toHaveBeenCalled();
    expect(harness.plugin.saveData).not.toHaveBeenCalled();
  });

  it("does not reopen a remembered note after it is no longer marked as a board", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: false });
    const harness = pluginHarness({ files: [board], storedData: { lastBoardPath: board.path } });

    await harness.plugin.onload();
    await harness.ribbon.callback();

    expect(recordedNotices()).toContain("The current note is not marked client_kanban: true");
    expect(harness.plugin.saveData).not.toHaveBeenCalled();
  });

  it("does not persist a board whose view activation fails", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const harness = pluginHarness({ activeFile: board, setViewStateError: new Error("leaf closed") });

    await harness.plugin.onload();
    await expect(runCommand(harness, "client-kanban-open-current-board")).rejects.toThrow("leaf closed");

    expect(harness.plugin.saveData).not.toHaveBeenCalled();
  });

  it("keeps the remembered path in memory and notifies when saving it fails", async () => {
    const board = file("SaleTest/Board.md", { client_kanban: true });
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const harness = pluginHarness({
      activeFile: board,
      files: [board],
      saveDataError: new Error("disk unavailable")
    });

    await harness.plugin.onload();
    await runCommand(harness, "client-kanban-open-current-board");
    await harness.ribbon.callback();

    expect(recordedNotices()).toEqual([
      "Could not save the last Client Kanban board.",
      "Could not save the last Client Kanban board."
    ]);
    expect(harness.leaf.setViewState).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledTimes(2);
    logError.mockRestore();
  });
});
