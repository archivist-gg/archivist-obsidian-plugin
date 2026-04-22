export type InlineTagType = "dice" | "damage" | "dc" | "atk" | "mod" | "check";

export interface FormulaRef {
  ability: string; // "str", "dex", etc.
  kind: "attack" | "damage" | "dc";
}

export interface InlineTag {
  type: InlineTagType;
  content: string;
  formula?: FormulaRef | null;
}

const VALID_PREFIXES: InlineTagType[] = ["dice", "damage", "dc", "atk", "mod", "check"];
const PREFIX_ALIASES: Record<string, InlineTagType> = { roll: "dice", d: "dice" };

export function parseInlineTag(text: string): InlineTag | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return null;

  const prefix = text.slice(0, colonIndex).trim().toLowerCase();
  const resolved = PREFIX_ALIASES[prefix] ?? prefix;
  if (!(VALID_PREFIXES as string[]).includes(resolved)) return null;

  const content = text.slice(colonIndex + 1).trim();
  if (content.length === 0) return null;

  return { type: resolved, content, formula: null };
}
