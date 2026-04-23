import { describe, it, expect } from "vitest";
import { PCModule } from "../src/modules/pc/pc.module";
import type { CoreAPI } from "../src/core/module-api";
import { EntityRegistry } from "../src/shared/entities/entity-registry";

describe("PCModule", () => {
  it("has the correct identity", () => {
    const m = new PCModule();
    expect(m.id).toBe("pc");
    expect(m.codeBlockType).toBe("pc");
    expect(m.entityType).toBe("pc");
  });

  it("register() assigns core, resolver; component registry exists", () => {
    const m = new PCModule();
    const core = { entities: new EntityRegistry() } as unknown as CoreAPI;
    m.register(core);
    expect(m.core).toBe(core);
    expect(m.resolver).not.toBeNull();
    expect(m.registry.size()).toBeGreaterThan(0);
  });

  it("parseYaml delegates to parsePC", () => {
    const m = new PCModule();
    const r = m.parseYaml("name: Grendal\nedition: '2014'\nclass: [{ name: x, level: 1, subclass: null, choices: {} }]\nabilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }\nability_method: manual\nstate: { hp: { current: 1, max: 1, temp: 0 } }");
    expect(r.success).toBe(true);
  });

  it("wireComponents registers all 19 components", () => {
    const m = new PCModule();
    const core = { entities: new EntityRegistry() } as unknown as CoreAPI;
    m.register(core);
    expect(m.registry.size()).toBe(19);
    for (const type of [
      "header-section", "ability-row", "combat-stats-row",
      "saves-panel", "senses-panel", "skills-panel", "proficiencies-panel",
      "class-block", "subclass-block", "race-block", "background-block", "feat-block",
      "actions-tab", "spells-tab", "inventory-tab",
      "features-tab", "background-tab", "notes-tab",
      "tabs-container",
    ]) {
      expect(m.registry.has(type)).toBe(true);
    }
  });

  it("isInPCFolder matches files under the configured folder (and its default)", () => {
    const m = new PCModule();
    expect(m.isInPCFolder("PlayerCharacters/Grendal.md", undefined)).toBe(true);
    expect(m.isInPCFolder("PlayerCharacters/Notes/Session-1.md", undefined)).toBe(true);
    expect(m.isInPCFolder("Compendium/SRD/Rogue.md", undefined)).toBe(false);
    expect(m.isInPCFolder("party/valeria.md", "party")).toBe(true);
    expect(m.isInPCFolder("other/thing.md", "party")).toBe(false);
  });

  it("empty playerCharactersFolder means match anything (degenerate but valid)", () => {
    const m = new PCModule();
    expect(m.isInPCFolder("anywhere.md", "")).toBe(true);
  });
});
