import type { BoardCard, BoardColumn, BoardConfig, ClientRecord } from "./types";

function displayValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function cardFor(config: BoardConfig, record: ClientRecord, stage: string | null): BoardCard {
  const clientName = record.frontmatter.client_name;
  const title = typeof clientName === "string" && clientName.length > 0
    ? clientName
    : record.basename;
  const fields = config.cardFields.flatMap((key) => {
    const value = displayValue(record.frontmatter[key]);
    return value === null ? [] : [{ key, value }];
  });

  return { path: record.path, title, stage, fields };
}

export function buildBoard(config: BoardConfig, records: ClientRecord[]): BoardColumn[] {
  const uncategorized: BoardColumn = {
    id: "uncategorized",
    label: "Uncategorized",
    stage: null,
    cards: []
  };
  const columns: BoardColumn[] = [uncategorized, ...config.columns.map((label) => ({
    id: `stage-${encodeURIComponent(label)}`,
    label,
    stage: label,
    cards: []
  }))];
  const configuredColumns = new Map(config.columns.map((label, index) => [label, columns[index + 1]]));

  for (const record of records) {
    const rawStage = record.frontmatter[config.stageProperty];
    const stage = typeof rawStage === "string" && rawStage.length > 0 ? rawStage : null;
    const column = stage === null ? uncategorized : configuredColumns.get(stage) ?? uncategorized;
    column.cards.push(cardFor(config, record, stage));
  }

  return columns;
}
