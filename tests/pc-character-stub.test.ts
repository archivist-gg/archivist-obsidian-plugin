import { describe, it, expect } from "vitest";
import { buildDraftCharacter, buildDraftFileBody } from "../src/modules/pc/builder/character-stub";
import { characterSchema } from "../src/modules/pc/pc.schema";

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
});
