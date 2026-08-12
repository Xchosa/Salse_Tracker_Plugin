import { ItemView, Notice, TFile } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import Sortable from "sortablejs";
import { buildBoard } from "./board-model";
import { parseBoardConfig } from "./config";
import { ClientRepository } from "./client-repository";

export const CLIENT_KANBAN_VIEW_TYPE = "client-kanban-view";

type Repository = Pick<ClientRepository, "list" | "setStage">;
type RepositoryFactory = (app: App) => Repository;
type SortableFactory = (element: HTMLElement, options: Sortable.Options) => Sortable;

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
  private sortables: Sortable[] = [];
  private refreshToken = 0;
  private closed = false;

  constructor(
    leaf: WorkspaceLeaf,
    app: App,
    private boardPath: string,
    repositoryFactory: RepositoryFactory = (targetApp) => new ClientRepository(targetApp),
    sortableFactory: SortableFactory = (element, options) => new Sortable(element, options)
  ) {
    super(leaf);
    this.app = app;
    this.repository = repositoryFactory(app);
    this.sortableFactory = sortableFactory;
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
    await this.refresh();
  }

  override async onClose(): Promise<void> {
    this.closed = true;
    ++this.refreshToken;
    this.destroySortables();
  }

  async refresh(): Promise<void> {
    if (this.closed) return;
    const token = ++this.refreshToken;
    try {
      const board = this.app.vault.getAbstractFileByPath(this.boardPath);
      if (!(board instanceof TFile)) throw new Error(`Board note "${this.boardPath}" is unavailable`);

      const config = parseBoardConfig(this.app.metadataCache.getFileCache(board)?.frontmatter);
      if (!config.ok) {
        if (token === this.refreshToken) this.renderErrors(config.errors);
        return;
      }

      const records = await this.repository.list(config.value);
      if (token === this.refreshToken) this.renderBoard(config.value.stageProperty, buildBoard(config.value, records));
    } catch (error) {
      if (token === this.refreshToken) this.renderErrors([this.messageFor(error)]);
    }
  }

  private renderErrors(errors: string[]): void {
    const content = this.contentEl as ObsidianElement;
    this.destroySortables();
    content.empty();
    for (const error of errors) content.createDiv({ cls: "client-kanban-error", text: error });
  }

  private renderBoard(stageProperty: string, columns: ReturnType<typeof buildBoard>): void {
    const content = this.contentEl as ObsidianElement;
    this.destroySortables();
    content.empty();
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
        group: "client-kanban-cards",
        draggable: ".client-kanban-card",
        delayOnTouchOnly: true,
        delay: 150,
        touchStartThreshold: 4,
        onEnd: async (event) => {
          const path = event.item.dataset.path;
          if (!path) return;
          const stage = event.to.dataset.stage || null;
          const title = event.item.querySelector(".client-kanban-card-title")?.textContent ?? path;
          await this.moveCard(path, stageProperty, stage, title);
        }
      }));
    }
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

  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
