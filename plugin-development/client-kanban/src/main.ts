import "./styles.css";

import { Notice, Plugin, TFile } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { ClientKanbanView, CLIENT_KANBAN_VIEW_TYPE } from "./client-kanban-view";

interface ClientKanbanPluginData {
  lastBoardPath?: string;
}

export default class ClientKanbanPlugin extends Plugin {
  private data: ClientKanbanPluginData = {};

  override async onload(): Promise<void> {
    await this.loadPluginData();

    this.registerView(
      CLIENT_KANBAN_VIEW_TYPE,
      (leaf) => new ClientKanbanView(
        leaf,
        this.app,
        "",
        undefined,
        undefined,
        (oldPath, newPath) => this.updateRememberedBoardPath(oldPath, newPath)
      )
    );

    this.addRibbonIcon("columns-3", "Open last Client Kanban", async () => {
      const path = this.data.lastBoardPath;
      if (!path) {
        new Notice("Open a note marked client_kanban: true first.");
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        new Notice(`The last Client Kanban board is unavailable: ${path}`);
        return;
      }

      await this.openBoard(file);
    });

    this.addCommand({
      id: "client-kanban-open-current-board",
      name: "Open current note as Client Kanban",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file) await this.openBoard(file);
      }
    });

    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, _source, leaf) => {
      if (!(file instanceof TFile) || !this.isBoard(file)) return;
      menu.addItem((item) => item
        .setTitle("Open as Client Kanban")
        .onClick(() => this.openBoard(file, leaf)));
    }));
  }

  private isBoard(file: TFile): boolean {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.client_kanban === true;
  }

  private async openBoard(file: TFile, leaf: WorkspaceLeaf = this.app.workspace.getLeaf(false)): Promise<void> {
    if (!this.isBoard(file)) {
      new Notice("The current note is not marked client_kanban: true");
      return;
    }
    await leaf.setViewState({
      type: CLIENT_KANBAN_VIEW_TYPE,
      active: true,
      state: { file: file.path }
    });
    this.data = { lastBoardPath: file.path };
    await this.savePluginData();
  }

  private async loadPluginData(): Promise<void> {
    try {
      const loaded = await this.loadData();
      this.data = this.isPluginData(loaded) ? loaded : {};
    } catch (error) {
      console.error("Unable to load Client Kanban plugin data", error);
      this.data = {};
    }
  }

  private isPluginData(data: unknown): data is ClientKanbanPluginData {
    return typeof data === "object"
      && data !== null
      && (!("lastBoardPath" in data)
        || (typeof data.lastBoardPath === "string" && data.lastBoardPath.length > 0));
  }

  private async updateRememberedBoardPath(oldPath: string, newPath: string): Promise<void> {
    if (this.data.lastBoardPath !== oldPath) return;
    this.data = { lastBoardPath: newPath };
    await this.savePluginData();
  }

  private async savePluginData(): Promise<void> {
    try {
      await this.saveData(this.data);
    } catch (error) {
      console.error("Unable to save Client Kanban plugin data", error);
      new Notice("Could not save the last Client Kanban board.");
    }
  }
}

export { ClientKanbanView, CLIENT_KANBAN_VIEW_TYPE } from "./client-kanban-view";
