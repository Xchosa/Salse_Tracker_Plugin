import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, Command, Menu, PluginManifest, ViewCreator, WorkspaceLeaf } from "obsidian";
import ClientKanbanPlugin, { CLIENT_KANBAN_VIEW_TYPE, ClientKanbanView } from "../src/main";
import { TFile, clearNotices, recordedNotices } from "./obsidian";

type TestFile = TFile & { frontmatter: Record<string, unknown> };

function file(path: string, frontmatter: Record<string, unknown>): TestFile {
  return Object.assign(new TFile(path), { frontmatter });
}

function pluginHarness(options: { activeFile?: TestFile | null } = {}) {
  const leaf = { setViewState: vi.fn(async () => undefined) };
  const workspaceEvents = new Map<string, (...args: unknown[]) => unknown>();
  const app = {
    metadataCache: {
      getFileCache: vi.fn((target: TestFile) => ({ frontmatter: target.frontmatter }))
    },
    vault: {},
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
  return { app, commands, leaf, plugin, views, workspaceEvents };
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
});
