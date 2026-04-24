import { describe, it, expect } from "vitest";
import { extractPCCodeBlock, spliceCodeBlock } from "../src/modules/pc/pc.parser";

const FILE = [
  "---",
  "archivist-type: pc",
  "---",
  "",
  "```pc",
  "name: Grendal",
  "edition: '2014'",
  "```",
  "",
  "## Backstory",
  "",
  "Grendal grew up on the edge of the Blackwood.",
].join("\n");

const NEW_YAML = [
  "name: Grendal",
  "edition: '2014'",
  "state:",
  "  hp: { current: 10, max: 24, temp: 0 }",
].join("\n");

describe("spliceCodeBlock", () => {
  it("replaces the pc code block body between fence lines", () => {
    const extracted = extractPCCodeBlock(FILE)!;
    const out = spliceCodeBlock(FILE, extracted, NEW_YAML);
    expect(out).toContain("```pc\nname: Grendal\nedition: '2014'\nstate:\n  hp: { current: 10, max: 24, temp: 0 }\n```");
  });

  it("preserves frontmatter byte-for-byte", () => {
    const extracted = extractPCCodeBlock(FILE)!;
    const out = spliceCodeBlock(FILE, extracted, NEW_YAML);
    expect(out.startsWith("---\narchivist-type: pc\n---\n\n")).toBe(true);
  });

  it("preserves markdown tail byte-for-byte", () => {
    const extracted = extractPCCodeBlock(FILE)!;
    const out = spliceCodeBlock(FILE, extracted, NEW_YAML);
    expect(out.endsWith("## Backstory\n\nGrendal grew up on the edge of the Blackwood.")).toBe(true);
  });

  it("normalizes CRLF input to LF output", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const extracted = extractPCCodeBlock(crlf)!;
    const out = spliceCodeBlock(crlf, extracted, NEW_YAML);
    expect(out.includes("\r\n")).toBe(false);
    expect(out).toContain("```pc\nname: Grendal");
  });
});
