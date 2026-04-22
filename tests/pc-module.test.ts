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
    expect(m.registry.size()).toBe(0);
  });

  it("parseYaml delegates to parsePC", () => {
    const m = new PCModule();
    const r = m.parseYaml("name: Grendal\nedition: '2014'\nclass: [{ name: x, level: 1, subclass: null, choices: {} }]\nabilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }\nability_method: manual\nstate: { hp: { current: 1, max: 1, temp: 0 } }");
    expect(r.success).toBe(true);
  });
});
