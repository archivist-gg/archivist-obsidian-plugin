import { describe, it, expect } from "vitest";
import { choiceSchema } from "../packages/obsidian/src/shared/schemas/choice-schema";

describe("choiceSchema — four primitives", () => {
  it("accepts select-inline with nested choices and effects", () => {
    const r = choiceSchema.safeParse({
      kind: "select-inline", id: "asi-or-feat", count: 1,
      options: [
        { value: "asi", label: "Ability Score Increase",
          choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }] },
        { value: "feat", label: "Feat",
          choices: [{ kind: "select-entity", id: "feat", entity_type: "feat", count: 1 }] },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts select-entity with where filter; rejects unknown filter fields", () => {
    expect(choiceSchema.safeParse({
      kind: "select-entity", id: "fighting-style", count: 1,
      entity_type: "optional-feature",
      where: { feature_type: "fighting_style", available_to: "self" },
    }).success).toBe(true);
    expect(choiceSchema.safeParse({
      kind: "select-entity", id: "x", entity_type: "spell",
      where: { description_contains: "fire" },
    }).success).toBe(false);
  });

  it("accepts select-proficiency expertise form", () => {
    expect(choiceSchema.safeParse({
      kind: "select-proficiency", id: "expertise", domain: "skill",
      count: 2, from_proficient: true, expertise: true,
    }).success).toBe(true);
  });

  it("requires id on every primitive and rejects retired kinds", () => {
    expect(choiceSchema.safeParse({ kind: "ability-points", points: 2, max_per: 2 }).success).toBe(false);
    expect(choiceSchema.safeParse({ kind: "skill", count: 2 }).success).toBe(false);
    expect(choiceSchema.safeParse({ kind: "subclass" }).success).toBe(false);
  });

  it("rejects inline options with deeply invalid nested choices", () => {
    expect(choiceSchema.safeParse({
      kind: "select-inline", id: "m", options: [
        { value: "a", label: "A", choices: [{ kind: "ability-points", id: "x", points: "two", max_per: 2 }] },
      ],
    }).success).toBe(false);
  });

  it("accepts inline options with a valid feature effect", () => {
    expect(choiceSchema.safeParse({
      kind: "select-inline", id: "m", options: [
        { value: "a", label: "A", effects: [{ kind: "initiative-bonus", value: 2 }] },
      ],
    }).success).toBe(true);
  });

  it("rejects inline options whose effect is missing a required field", () => {
    expect(choiceSchema.safeParse({
      kind: "select-inline", id: "m", options: [
        { value: "a", label: "A", effects: [{ kind: "initiative-bonus" }] },
      ],
    }).success).toBe(false);
  });

  it("rejects inline options carrying an unknown effect kind", () => {
    expect(choiceSchema.safeParse({
      kind: "select-inline", id: "m", options: [
        { value: "a", label: "A", effects: [{ kind: "totally-not-a-real-effect" }] },
      ],
    }).success).toBe(false);
  });
});
