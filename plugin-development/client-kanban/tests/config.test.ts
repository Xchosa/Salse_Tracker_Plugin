import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "../src/config";

describe("parseBoardConfig", () => {
  it("parses a valid board", () => {
    expect(parseBoardConfig({
      client_kanban: true,
      source_folder: "SaleTest",
      stage_property: "sales_stage",
      columns: ["Erstgespraech", "FollowUp_Send"],
      card_fields: ["contact_person", "last_contact"]
    })).toEqual({ ok: true, value: {
      sourceFolder: "SaleTest",
      stageProperty: "sales_stage",
      columns: ["Erstgespraech", "FollowUp_Send"],
      cardFields: ["contact_person", "last_contact"]
    }});
  });

  it.each<{ marker: string; frontmatter: Record<string, unknown> | undefined }>([
    { marker: "missing frontmatter", frontmatter: undefined },
    {
      marker: "absent",
      frontmatter: { source_folder: "SaleTest", stage_property: "sales_stage", columns: ["New"] }
    },
    {
      marker: "false",
      frontmatter: { client_kanban: false, source_folder: "SaleTest", stage_property: "sales_stage", columns: ["New"] }
    },
    {
      marker: "a string",
      frontmatter: { client_kanban: "true", source_folder: "SaleTest", stage_property: "sales_stage", columns: ["New"] }
    }
  ])("requires client_kanban to be strictly true when the marker is $marker", ({ frontmatter }) => {
    const result = parseBoardConfig(frontmatter);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("client_kanban must be true to use this note as a Client Kanban board");
    }
  });

  it.each([
    [{ client_kanban: true, stage_property: "sales_stage", columns: ["New"] }, "source_folder"],
    [{ client_kanban: true, source_folder: "SaleTest", columns: ["New"] }, "stage_property"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: [] }, "columns"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: ["New", "New"] }, "unique"],
    [{ client_kanban: true, source_folder: "SaleTest", stage_property: "sales_stage", columns: [" "] }, "non-empty"]
  ])("rejects invalid configuration %#", (frontmatter, message) => {
    const result = parseBoardConfig(frontmatter);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain(message);
  });
});
