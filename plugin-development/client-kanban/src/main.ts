import "./styles.css";

import { Notice, Plugin, TFile } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { ClientKanbanView, CLIENT_KANBAN_VIEW_TYPE } from "./client-kanban-view";

export default class ClientKanbanPlugin extends Plugin {
  override onload(): void {
    this.registerView(
      CLIENT_KANBAN_VIEW_TYPE,
      (leaf) => new ClientKanbanView(leaf, this.app, "")
    );

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
  }
}

export { ClientKanbanView, CLIENT_KANBAN_VIEW_TYPE } from "./client-kanban-view";
