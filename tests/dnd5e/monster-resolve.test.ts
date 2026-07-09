import { describe, it, expect } from "vitest";
import { resolveMonster } from "@archivist-gg/dnd5e";

describe("resolveMonster (light derivation)", () => {
  it("derives proficiency bonus and xp from CR without mutating the raw", () => {
    const raw = { name: "Goblin", cr: "1/4" };
    const r = resolveMonster(raw, { lookup: () => undefined });
    expect(r.proficiency_bonus).toBe(2);
    expect(r.xp).toBe(50);
    expect((raw as Record<string, unknown>).proficiency_bonus).toBeUndefined();
  });
});
