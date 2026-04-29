import { describe, it, expect } from "vitest";
import { toFeatCanonical } from "../../../tools/srd-canonical/merger-rules/feat-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("featMergeRule", () => {
  it("produces canonical Feat from Open5e-only entry (Alert, no prereq, Origin)", () => {
    const canonical: CanonicalEntry = {
      slug: "alert",
      edition: "2014",
      kind: "feat",
      base: {
        key: "alert",
        name: "Alert",
        desc: "Always on the lookout for danger…",
        document: { key: "srd-2014", name: "SRD 5.1" },
        type: "Origin",
        has_prerequisite: false,
        benefits: [
          { desc: "+5 bonus to initiative." },
          { desc: "Cannot be surprised while conscious." },
        ],
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toFeatCanonical(canonical);
    expect(out.slug).toBe("alert");
    expect(out.name).toBe("Alert");
    expect(out.category).toBe("origin");
    expect(out.prerequisites).toEqual([]);
    expect(out.repeatable).toBe(false);
    expect(out.benefits).toHaveLength(2);
    expect(out.benefits[0]).toContain("+5 bonus");
  });

  it("translates structured-rules prereq array to discriminated union and detects repeatable", () => {
    const canonical: CanonicalEntry = {
      slug: "elemental-adept",
      edition: "2014",
      kind: "feat",
      base: {
        key: "elemental-adept",
        name: "Elemental Adept",
        desc: "Pick a damage type and master it.",
        document: { key: "srd-2014", name: "SRD 5.1" },
        type: "General",
        has_prerequisite: true,
        benefits: [{ desc: "Spells you cast that deal damage of the chosen type ignore resistance." }],
      },
      structured: {
        name: "Elemental Adept",
        source: "PHB",
        prerequisite: [
          { level: 4 },
          { ability: { str: 13 } },
          { feat: ["alert"] },
          { spell: ["fireball"] },
          { class: { fighter: true } },
        ],
        _isRepeatable: true,
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toFeatCanonical(canonical);
    expect(out.repeatable).toBe(true);
    expect(out.prerequisites).toEqual([
      { kind: "level", min: 4 },
      { kind: "ability", ability: "str", min: 13 },
      { kind: "feat", slug: "alert" },
      { kind: "spell", slug: "fireball" },
      { kind: "class", slug: "fighter" },
    ]);
  });
});
