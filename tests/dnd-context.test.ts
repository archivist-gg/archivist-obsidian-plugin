import { describe, it, expect } from "vitest";
import { buildDndSystemPromptSection } from "../src/modules/inquiry/core/prompts/dndContext";

describe("buildDndSystemPromptSection", () => {
  it("returns empty string when no D&D context provided", () => {
    const result = buildDndSystemPromptSection({});
    expect(result).toBe("");
  });
  it("includes D&D persona when ttrpgRootDir is set", () => {
    const result = buildDndSystemPromptSection({ ttrpgRootDir: "/Campaign" });
    expect(result).toContain("D&D 5e");
    expect(result).toContain("/Campaign");
  });
  it("includes entity context when provided", () => {
    const result = buildDndSystemPromptSection({
      entityContext: '<entity-context type="monster" name="Goblin">name: Goblin</entity-context>',
    });
    expect(result).toContain("entity-context");
    expect(result).toContain("Goblin");
  });
  it("lists generation instructions", () => {
    const result = buildDndSystemPromptSection({ ttrpgRootDir: "/" });
    expect(result).toContain("monster");
    expect(result).toContain("spell");
    expect(result).toContain("item");
  });
});
