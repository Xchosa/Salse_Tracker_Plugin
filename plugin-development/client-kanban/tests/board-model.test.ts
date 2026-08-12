import { describe, expect, it } from "vitest";
import { buildBoard } from "../src/board-model";
import type { BoardConfig, ClientRecord } from "../src/types";

const config: BoardConfig = {
  sourceFolder: "SaleTest",
  stageProperty: "sales_stage",
  columns: ["New", "FollowUp_Send"],
  cardFields: ["contact_person", "last_contact"]
};

function client(path: string, frontmatter: Record<string, unknown>): ClientRecord {
  const basename = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  return { path, basename, frontmatter };
}

describe("buildBoard", () => {
  it("uses exact stage matching and preserves unknown stages", () => {
    const columns = buildBoard(config, [
      client("SaleTest/Exact.md", { sales_stage: "New" }),
      client("SaleTest/Case.md", { sales_stage: "new" }),
      client("SaleTest/Missing.md", {}),
      client("SaleTest/Unknown.md", { sales_stage: "Legacy" })
    ]);
    expect(columns[1].cards.map(card => card.title)).toEqual(["Exact"]);
    expect(columns[0].cards.map(card => [card.title, card.stage])).toEqual([
      ["Case", "new"], ["Missing", null], ["Unknown", "Legacy"]
    ]);
  });

  it("renders sparse configured fields and filename fallback", () => {
    const columns = buildBoard({ ...config, cardFields: ["phone", "special_requirement"] }, [
      client("SaleTest/Max Mustermann.md", { phone: "123", special_requirement: "Ramp" }),
      client("SaleTest/Erika.md", { phone: "456" })
    ]);
    expect(columns[0].cards[0]).toMatchObject({
      title: "Max Mustermann",
      fields: [{ key: "phone", value: "123" }, { key: "special_requirement", value: "Ramp" }]
    });
    expect(columns[0].cards[1].fields).toEqual([{ key: "phone", value: "456" }]);
  });
});
