import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { ClientRepository } from "../src/client-repository";
import { TFile, TFolder } from "./obsidian";

const config = {
  sourceFolder: "SaleTest",
  stageProperty: "sales_stage",
  columns: ["New"],
  cardFields: []
};

type TestFile = TFile & { frontmatter: Record<string, unknown> };

function file(path: string, frontmatter: Record<string, unknown>): TestFile {
  return Object.assign(new TFile(path), { frontmatter });
}

function folder(path: string, children: Array<TFile | TFolder>): TFolder {
  return new TFolder(path, children);
}

function fakeApp(options: {
  folders?: Record<string, TFolder>;
  files?: TestFile[];
}): {
  vault: { getAbstractFileByPath: (path: string) => TFile | TFolder | null };
  metadataCache: { getFileCache: (file: TFile) => { frontmatter: Record<string, unknown> } | null };
  fileManager: { processFrontMatter: ReturnType<typeof vi.fn> };
} {
  const folders = options.folders ?? {};
  const files = new Map((options.files ?? []).map((entry) => [entry.path, entry]));
  const processFrontMatter = vi.fn(async (target: TestFile, update: (frontmatter: Record<string, unknown>) => void) => {
    update(target.frontmatter);
  });

  return {
    vault: {
      getAbstractFileByPath: (path) => folders[path] ?? files.get(path) ?? null
    },
    metadataCache: {
      getFileCache: (target) => target instanceof TFile && "frontmatter" in target
        ? { frontmatter: target.frontmatter as Record<string, unknown> }
        : null
    },
    fileManager: { processFrontMatter }
  };
}

function repository(app: ReturnType<typeof fakeApp>): ClientRepository {
  return new ClientRepository(app as unknown as App);
}

function frontmatterFor(app: ReturnType<typeof fakeApp>, path: string): Record<string, unknown> {
  const target = app.vault.getAbstractFileByPath(path);
  if (!(target instanceof TFile) || !("frontmatter" in target)) throw new Error("test file not found");
  return target.frontmatter as Record<string, unknown>;
}

describe("ClientRepository", () => {
  it("returns only direct client Markdown files", async () => {
    const app = fakeApp({
      folders: {
        SaleTest: folder("SaleTest", [
          file("SaleTest/Max.md", { client_name: "Max" }),
          file("SaleTest/Board.md", { client_kanban: true }),
          file("SaleTest/logo.png", {}),
          folder("SaleTest/Archive", [file("SaleTest/Archive/Old.md", {})])
        ])
      }
    });

    const records = await repository(app).list(config);

    expect(records.map((record) => record.path)).toEqual(["SaleTest/Max.md"]);
  });

  it("reports a missing source folder", async () => {
    const app = fakeApp({ folders: {} });

    await expect(repository(app).list(config))
      .rejects.toThrow('Source folder "SaleTest" was not found');
  });

  it("changes only the configured stage property", async () => {
    const app = fakeApp({ files: [file("SaleTest/Max.md", {
      client_name: "Max",
      sales_stage: "Old",
      extra: "preserve"
    })] });

    await repository(app).setStage("SaleTest/Max.md", "sales_stage", "New");

    expect(app.fileManager.processFrontMatter).toHaveBeenCalledOnce();
    expect(frontmatterFor(app, "SaleTest/Max.md")).toEqual({
      client_name: "Max",
      sales_stage: "New",
      extra: "preserve"
    });
  });

  it("removes only the stage when moving to Uncategorized", async () => {
    const app = fakeApp({ files: [file("SaleTest/Max.md", {
      client_name: "Max",
      sales_stage: "Old",
      extra: "preserve"
    })] });

    await repository(app).setStage("SaleTest/Max.md", "sales_stage", null);

    expect(frontmatterFor(app, "SaleTest/Max.md")).toEqual({
      client_name: "Max",
      extra: "preserve"
    });
  });

  it("rejects a source that disappeared before drop", async () => {
    await expect(repository(fakeApp({})).setStage("SaleTest/Missing.md", "sales_stage", "New"))
      .rejects.toThrow('Client note "SaleTest/Missing.md" is unavailable');
  });
});
