import { TFile, TFolder } from "obsidian";
import type { App } from "obsidian";
import type { BoardConfig, ClientRecord } from "./types";

export class ClientRepository {
  constructor(private readonly app: App) {}

  async list(config: BoardConfig): Promise<ClientRecord[]> {
    const source = this.app.vault.getAbstractFileByPath(config.sourceFolder);
    if (!(source instanceof TFolder)) {
      throw new Error(`Source folder "${config.sourceFolder}" was not found`);
    }

    const records: ClientRecord[] = [];
    for (const child of source.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;

      const frontmatter = (this.app.metadataCache.getFileCache(child)?.frontmatter ?? {}) as Record<string, unknown>;
      if (frontmatter.client_kanban === true) continue;

      records.push({
        path: child.path,
        basename: child.basename,
        frontmatter
      });
    }

    return records.sort((left, right) => left.path.localeCompare(right.path));
  }

  async setStage(path: string, stageProperty: string, stage: string | null): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error(`Client note "${path}" is unavailable`);
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (stage === null) delete frontmatter[stageProperty];
      else frontmatter[stageProperty] = stage;
    });
  }
}
