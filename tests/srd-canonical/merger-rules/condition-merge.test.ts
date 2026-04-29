import { describe, it, expect } from "vitest";
import { toConditionCanonical } from "../../../tools/srd-canonical/merger-rules/condition-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("conditionMergeRule", () => {
  it("produces canonical Condition for Prone (pass-through Open5e)", () => {
    const canonical: CanonicalEntry = {
      slug: "prone",
      edition: "2014",
      kind: "condition",
      base: {
        key: "prone",
        name: "Prone",
        document: { key: "srd-2014", name: "SRD 5.1" },
        desc: "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toConditionCanonical(canonical);
    expect(out.slug).toBe("prone");
    expect(out.name).toBe("Prone");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.description).toContain("only movement option is to crawl");
    expect(out.effects).toBeUndefined();
  });

  it("produces canonical Condition for Paralyzed (longer description)", () => {
    const canonical: CanonicalEntry = {
      slug: "paralyzed",
      edition: "2014",
      kind: "condition",
      base: {
        key: "paralyzed",
        name: "Paralyzed",
        document: { key: "srd-2014", name: "SRD 5.1" },
        desc: "A paralyzed creature is incapacitated and can't move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toConditionCanonical(canonical);
    expect(out.slug).toBe("paralyzed");
    expect(out.name).toBe("Paralyzed");
    expect(out.description).toContain("incapacitated");
    expect(out.description).toContain("automatically fails Strength and Dexterity saving throws");
    expect(out.description).toContain("critical hit");
  });
});
