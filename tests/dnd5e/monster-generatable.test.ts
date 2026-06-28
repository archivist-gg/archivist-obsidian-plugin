import { describe, it, expect } from "vitest";
import { monsterGeneratable } from "@archivist/dnd5e";
import { generatableToSdkTool } from "@archivist/generators";

// Guard against silent regression of the inline-formula-tag guidance that
// instructs the LLM to emit recalc-able tags (atk:/dmg:/dc:) instead of static
// numbers. The plugin's auto-recalculate-on-ability-change feature depends on
// generated monsters using these tags. See task-12-report.md (Fix wave).
describe("monsterGeneratable formula-tag guidance", () => {
  const instructions = monsterGeneratable.instructions ?? "";

  it("documents the inline-formula-tag grammar in instructions", () => {
    expect(instructions).toContain("atk:");
    expect(instructions).toContain("dmg:");
    expect(instructions).toContain("dc:");
    expect(instructions).toContain("STR+PB");
  });

  it("includes at least one worked example", () => {
    expect(instructions).toContain("Worked examples:");
    expect(instructions).toContain("Melee Weapon Attack:");
  });

  it("keeps the CR-derived-fields note", () => {
    expect(instructions).toMatch(/CR-derived fields .*filled automatically/);
  });

  it("composes the rich grammar into the SDK tool description", () => {
    const description = generatableToSdkTool(monsterGeneratable).description;
    expect(description).toContain("Generate a D&D 5e monster stat block.");
    expect(description).toContain("atk:STR+PB");
    expect(description).toContain("dmg:1d8+STR");
    expect(description).toContain("dc:WIS");
    expect(description).toContain("Worked examples:");
  });
});
