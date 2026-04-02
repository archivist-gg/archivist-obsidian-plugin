export type InlineTagType = "dice" | "roll" | "d" | "damage" | "dc" | "atk" | "mod" | "check";

export interface InlineTag {
  type: InlineTagType;
  content: string;
}

const VALID_PREFIXES: InlineTagType[] = ["dice", "roll", "d", "damage", "dc", "atk", "mod", "check"];

export function parseInlineTag(text: string): InlineTag | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return null;

  const prefix = text.slice(0, colonIndex).trim().toLowerCase();
  if (!VALID_PREFIXES.includes(prefix as InlineTagType)) return null;

  const content = text.slice(colonIndex + 1).trim();
  if (content.length === 0) return null;

  return { type: prefix as InlineTagType, content };
}
