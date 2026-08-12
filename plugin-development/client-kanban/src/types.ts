export interface BoardConfig {
  sourceFolder: string;
  stageProperty: string;
  columns: string[];
  cardFields: string[];
}

export type ConfigResult =
  | { ok: true; value: BoardConfig }
  | { ok: false; errors: string[] };

export interface ClientRecord {
  path: string;
  basename: string;
  frontmatter: Record<string, unknown>;
}

export interface CardField {
  key: string;
  value: string;
}

export interface BoardCard {
  path: string;
  title: string;
  stage: string | null;
  fields: CardField[];
}

export interface BoardColumn {
  id: string;
  label: string;
  stage: string | null;
  cards: BoardCard[];
}
