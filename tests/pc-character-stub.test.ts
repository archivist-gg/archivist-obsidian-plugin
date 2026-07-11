import { describe, it, expect } from "vitest";
import { buildDraftCharacter, buildDraftFileBody } from "../packages/obsidian/src/modules/pc/builder/character-stub";
import { characterSchema } from "@archivist-gg/dnd5e/pc/pc.schema";
import { extractPCCodeBlock } from "../packages/obsidian/src/modules/pc/pc.parser";
import { parsePC } from "@archivist-gg/dnd5e/pc/pc.parser";

describe("character-stub", () => {
  it("buildDraftCharacter produces a schema-valid class-less draft", () => {
    const draft = buildDraftCharacter("Valeria");
    const result = characterSchema.safeParse(draft);
    expect(result.success).toBe(true);
    expect(draft.name).toBe("Valeria");
    expect(draft.class).toEqual([]);
    expect(draft.edition).toBe("2014");
  });

  it("buildDraftFileBody wraps frontmatter + a pc code block", () => {
    const body = buildDraftFileBody("Valeria");
    expect(body).toContain("archivist-type: pc");
    expect(body).toContain("```pc");
    expect(body).toMatch(/name:\s*("?)Valeria\1/);
    expect(body.trim().endsWith("```")).toBe(true);
  });

  it("buildDraftCharacter marks the draft with builder: true", () => {
    const draft = buildDraftCharacter("Valeria");
    expect(draft.builder).toBe(true);
  });

  it("buildDraftFileBody serializes the builder flag into the pc block", () => {
    const body = buildDraftFileBody("Valeria");
    expect(body).toMatch(/^builder:\s*true$/m);
  });

  it("buildDraftCharacter supports the 2024 edition path", () => {
    const draft = buildDraftCharacter("Valeria", "2024");
    const result = characterSchema.safeParse(draft);
    expect(result.success).toBe(true);
    expect(draft.edition).toBe("2024");
  });

  it("falls back to Untitled / untitled for a whitespace-only name", () => {
    const draft = buildDraftCharacter("   ");
    expect(draft.name).toBe("Untitled");

    const body = buildDraftFileBody("   ");
    expect(body).toContain("slug: untitled");
    // yaml.dump renders the name; accept any quoted/unquoted YAML form of "Untitled".
    expect(body).toMatch(/name:\s*("?)Untitled\1/);
  });

  it("buildDraftFileBody round-trips through extractPCCodeBlock + parsePC", () => {
    const body = buildDraftFileBody("Valeria", "2024");
    const block = extractPCCodeBlock(body);
    expect(block).not.toBeNull();
    const parsed = parsePC(block!.yaml);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Valeria");
      expect(parsed.data.edition).toBe("2024");
      expect(parsed.data.class).toEqual([]);
    }
  });
});
