import type { BoardConfig, ConfigResult } from "./types";

export function parseBoardConfig(
  frontmatter: Record<string, unknown> | undefined
): ConfigResult {
  const errors: string[] = [];
  const sourceFolder = frontmatter?.source_folder;
  const stageProperty = frontmatter?.stage_property;
  const columns = frontmatter?.columns;
  const cardFields = frontmatter?.card_fields;

  if (typeof sourceFolder !== "string" || sourceFolder.trim().length === 0) {
    errors.push("source_folder must be a non-empty string");
  }

  if (typeof stageProperty !== "string" || stageProperty.trim().length === 0) {
    errors.push("stage_property must be a non-empty string");
  }

  let parsedColumns: string[] = [];
  if (!Array.isArray(columns) || columns.length === 0) {
    errors.push("columns must contain at least one value");
  } else if (!columns.every((column): column is string => typeof column === "string")) {
    errors.push("columns entries must be strings");
  } else {
    parsedColumns = columns;
    if (columns.some((column) => column.trim().length === 0)) {
      errors.push("columns must contain non-empty values");
    }
    if (new Set(columns).size !== columns.length) {
      errors.push("columns must be unique");
    }
  }

  let parsedCardFields: string[] = [];
  if (cardFields !== undefined) {
    if (!Array.isArray(cardFields) || !cardFields.every((field): field is string => typeof field === "string")) {
      errors.push("card_fields entries must be strings");
    } else {
      parsedCardFields = cardFields;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const value: BoardConfig = {
    sourceFolder: (sourceFolder as string).trim(),
    stageProperty: (stageProperty as string).trim(),
    columns: parsedColumns,
    cardFields: parsedCardFields
  };
  return { ok: true, value };
}
