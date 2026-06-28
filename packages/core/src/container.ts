import yaml from "js-yaml";
import type { EntityDoc, ParseResult } from "./contracts";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const CODE_BLOCK_RE = /```([A-Za-z0-9_-]+)\n([\s\S]*?)```/;

export function parseContainer(text: string): ParseResult<EntityDoc> {
  let frontmatter: Record<string, unknown> = {};
  const fm = FRONTMATTER_RE.exec(text);
  if (fm) {
    try {
      const parsed = yaml.load(fm[1]);
      if (parsed && typeof parsed === "object") frontmatter = parsed as Record<string, unknown>;
    } catch (e) {
      return { success: false, error: `Invalid frontmatter: ${(e as Error).message}` };
    }
  }
  const block = CODE_BLOCK_RE.exec(text);
  if (!block) return { success: false, error: "No typed code block found" };
  return { success: true, data: { type: block[1], frontmatter, body: block[2], raw: text } };
}
