import { ItemView, Notice, setIcon, TFile } from "obsidian";
import type { App, EventRef, WorkspaceLeaf } from "obsidian";
import Sortable from "sortablejs";
import { buildBoard } from "./board-model";
import { parseBoardConfig } from "./config";
import { ClientRepository } from "./client-repository";

export const CLIENT_KANBAN_VIEW_TYPE = "client-kanban-view";

let nextSortableGroupId = 0;

type Repository = Pick<ClientRepository, "list" | "setStage">;
type RepositoryFactory = (app: App) => Repository;
type SortableFactory = (element: HTMLElement, options: Sortable.Options) => Sortable;
type EventSource = { offref(ref: EventRef): void };
export type BoardPathChanged = (oldPath: string, newPath: string) => void | Promise<void>;

type ObsidianElement = HTMLElement & {
  createDiv(options?: { cls?: string; text?: string }): ObsidianElement;
  createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: { cls?: string; text?: string }
  ): HTMLElementTagNameMap[K] & ObsidianElement;
  empty(): void;
};

export class ClientKanbanView extends ItemView {
  private readonly repository: Repository;
  private readonly sortableFactory: SortableFactory;
  private readonly sortableGroup = `client-kanban-cards-${++nextSortableGroupId}`;
  private sortables: Sortable[] = [];
  private refreshToken = 0;
  private closed = false;
  private sourceFolder: string | undefined;
  private refreshTimer: number | undefined;
  private eventRefs: Array<{ source: EventSource; ref: EventRef }> = [];

  constructor(
    leaf: WorkspaceLeaf,
    app: App,
    private boardPath: string,
    repositoryFactory: RepositoryFactory = (targetApp) => new ClientRepository(targetApp),
    sortableFactory: SortableFactory = (element, options) => new Sortable(element, options),
    private readonly boardPathChanged?: BoardPathChanged
  ) {
    super(leaf);
    this.app = app;
    this.contentEl.classList.add("client-kanban-view");
    this.repository = repositoryFactory(app);
    this.sortableFactory = sortableFactory;
    this.register(() => this.clearRefreshTimer());
  }

  override getViewType(): string {
    return CLIENT_KANBAN_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return "Client Kanban";
  }

  override getState(): { file: string } {
    return { file: this.boardPath };
  }

  override async setState(state: unknown): Promise<void> {
    if (typeof state === "object" && state !== null && "file" in state && typeof state.file === "string") {
      this.boardPath = state.file;
    }
    await this.refresh();
  }

  override async onOpen(): Promise<void> {
    this.closed = false;
    this.registerRefreshEvents();
    await this.refresh();
  }

  override async onClose(): Promise<void> {
    this.closed = true;
    ++this.refreshToken;
    this.clearRefreshTimer();
    for (const { source, ref } of this.eventRefs) source.offref(ref);
    this.eventRefs = [];
    this.destroySortables();
  }

  scheduleRefresh(changedPath?: string): void {
    if (this.closed || (changedPath !== undefined && !this.isRelevant(changedPath))) return;
    this.clearRefreshTimer();
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, 75);
  }

  async refresh(): Promise<void> {
    if (this.closed) return;
    const token = ++this.refreshToken;
    let boardResolved = false;
    try {
      const board = this.app.vault.getAbstractFileByPath(this.boardPath);
      if (!(board instanceof TFile) || board.extension !== "md") {
        throw new Error(`Board note "${this.boardPath}" is unavailable`);
      }
      boardResolved = true;

      const config = parseBoardConfig(this.app.metadataCache.getFileCache(board)?.frontmatter);
      if (!config.ok) {
        if (token === this.refreshToken) this.renderErrors(config.errors, true);
        return;
      }

      this.sourceFolder = config.value.sourceFolder;
      const records = await this.repository.list(config.value);
      if (token === this.refreshToken) this.renderBoard(config.value.stageProperty, buildBoard(config.value, records));
    } catch (error) {
      if (token === this.refreshToken) this.renderErrors([this.messageFor(error)], boardResolved);
    }
  }

  private renderErrors(errors: string[], showToolbar = false): void {
    const content = this.contentEl as ObsidianElement;
    this.destroySortables();
    content.empty();
    if (showToolbar) this.renderToolbar(content);
    for (const error of errors) content.createDiv({ cls: "client-kanban-error", text: error });
  }

  private renderBoard(stageProperty: string, columns: ReturnType<typeof buildBoard>): void {
    const content = this.contentEl as ObsidianElement;
    this.destroySortables();
    content.empty();
    this.renderToolbar(content);
    const board = content.createDiv({ cls: "client-kanban-board" });

    for (const column of columns) {
      const columnEl = board.createDiv({ cls: "client-kanban-column" });
      columnEl.dataset.stage = column.stage ?? "";
      columnEl.createDiv({ cls: "client-kanban-column-title", text: column.label });
      const list = columnEl.createDiv({ cls: "client-kanban-card-list" });
      list.dataset.stage = column.stage ?? "";

      for (const card of column.cards) {
        const cardEl = list.createDiv({ cls: "client-kanban-card" });
        cardEl.dataset.path = card.path;
        cardEl.addEventListener("click", () => { void this.openClient(card.path); });
        const title = cardEl.createEl("button", { cls: "client-kanban-card-title", text: card.title });
        title.type = "button";
        const fields = cardEl.createDiv({ cls: "client-kanban-card-fields" });
        for (const field of card.fields) fields.createDiv({ cls: "client-kanban-card-field", text: `${field.key}: ${field.value}` });
      }

      this.sortables.push(this.sortableFactory(list, {
        group: this.sortableGroup,
        draggable: ".client-kanban-card",
        delayOnTouchOnly: true,
        delay: 150,
        touchStartThreshold: 4,
        onEnd: async (event) => {
          if (!this.contentEl.contains(event.to)) {
            await this.refresh();
            return;
          }
          if (event.from === event.to) {
            await this.refresh();
            return;
          }
          const path = event.item.dataset.path;
          if (!path) return;
          const stage = event.to.dataset.stage || null;
          const title = event.item.querySelector(".client-kanban-card-title")?.textContent ?? path;
          await this.moveCard(path, stageProperty, stage, title);
        }
      }));
    }
  }

  private renderToolbar(content: ObsidianElement): void {
    const toolbar = content.createDiv({ cls: "client-kanban-toolbar" });
    const edit = toolbar.createEl("button", { cls: "client-kanban-edit-board" });
    edit.type = "button";
    edit.title = "Edit board configuration";
    edit.setAttribute("aria-label", "Edit board configuration");
    setIcon(edit, "pencil");
    edit.addEventListener("click", () => { void this.openBoardConfiguration(); });
  }

  private async openBoardConfiguration(): Promise<void> {
    const board = this.app.vault.getAbstractFileByPath(this.boardPath);
    if (!(board instanceof TFile) || board.extension !== "md") {
      new Notice(`Board note "${this.boardPath}" is unavailable`);
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(board);
  }

  private async openClient(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async moveCard(path: string, stageProperty: string, stage: string | null, title: string): Promise<void> {
    try {
      await this.repository.setStage(path, stageProperty, stage);
    } catch (error) {
      new Notice(`Could not move ${title}: ${this.messageFor(error)}`);
    } finally {
      await this.refresh();
    }
  }

  private destroySortables(): void {
    for (const sortable of this.sortables) sortable.destroy();
    this.sortables = [];
  }

  private registerRefreshEvents(): void {
    if (this.eventRefs.length > 0) return;
    const vault = this.app.vault;
    this.trackEvent(vault, vault.on("create", (file) => this.scheduleRefresh(file.path)));
    this.trackEvent(vault, vault.on("modify", (file) => this.scheduleRefresh(file.path)));
    this.trackEvent(vault, vault.on("delete", (file) => this.scheduleRefresh(file.path)));
    this.trackEvent(vault, vault.on("rename", (file, oldPath) => {
      const oldBoardPath = this.boardPath;
      const boardRenamed = oldPath === oldBoardPath;
      if (boardRenamed) {
        this.boardPath = file.path;
        void this.reportBoardPathChanged(oldBoardPath, file.path);
      }
      if (boardRenamed || this.isRelevant(file.path) || this.isRelevant(oldPath)) this.scheduleRefresh();
    }));
    const metadataCache = this.app.metadataCache;
    this.trackEvent(metadataCache, metadataCache.on("changed", (file) => this.scheduleRefresh(file.path)));
  }

  private trackEvent(source: EventSource, ref: EventRef): void {
    this.eventRefs.push({ source, ref });
    this.registerEvent(ref);
  }

  private async reportBoardPathChanged(oldPath: string, newPath: string): Promise<void> {
    try {
      await this.boardPathChanged?.(oldPath, newPath);
    } catch (error) {
      new Notice(`Could not update the renamed Client Kanban board: ${this.messageFor(error)}`);
    }
  }

  private isRelevant(path: string): boolean {
    return path === this.boardPath
      || (this.sourceFolder !== undefined
        && path.substring(0, path.lastIndexOf("/")) === this.sourceFolder);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer === undefined) return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
