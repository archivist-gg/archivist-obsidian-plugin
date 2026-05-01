import { describe, it, expect } from "vitest";
import {
  toConditionCanonical,
  buildConditionsFromStructured,
  flattenEntries,
} from "../../../tools/srd-canonical/merger-rules/condition-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";
import { readStructuredRules } from "../../../tools/srd-canonical/sources/structured-rules";

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

  it("uses Open5e description when both Open5e and structured are populated", () => {
    // Regression guard: structured.entries must not override a populated
    // Open5e desc. Open5e wins; structured is fallback-only.
    const canonical: CanonicalEntry = {
      slug: "srd-5e_prone",
      edition: "2014",
      kind: "condition",
      base: {
        key: "srd-5e_prone",
        name: "Prone",
        desc: "Open5e prose for Prone.",
      },
      structured: {
        name: "Prone",
        source: "PHB",
        srd: true,
        entries: ["Structured fallback prose."],
      },
      activation: null,
      overlay: null,
    };
    const out = toConditionCanonical(canonical);
    expect(out.description).toContain("Open5e prose");
    expect(out.description).not.toContain("Structured fallback");
  });

  it("renders 5etools {type:'table'} entries as a markdown pipe-table (Exhaustion)", () => {
    // I-1 regression: tables in `entries` were previously dropped, so
    // Exhaustion's level table never made it into the description.
    const desc = flattenEntries([
      {
        type: "table",
        colLabels: ["Level", "Effect"],
        rows: [
          ["1", "X"],
          ["2", "Y"],
        ],
      },
    ]);
    expect(desc).toContain("| Level | Effect |");
    expect(desc).toContain("| --- | --- |");
    expect(desc).toContain("| 1 | X |");
    expect(desc).toContain("| 2 | Y |");
  });

  it("falls back to structured.entries when Open5e base has no desc", () => {
    // Open5e exposes 0 conditions for srd-2014/srd-2024. The merger must
    // produce a populated description from the 5etools structured-rules entry.
    const canonical: CanonicalEntry = {
      slug: "srd-5e_prone",
      edition: "2014",
      kind: "condition",
      base: {
        // Synthetic stub: no desc, only the identity fields the writer needs.
        key: "srd-5e_prone",
        name: "Prone",
      },
      structured: {
        name: "Prone",
        source: "PHB",
        srd: true,
        entries: [
          {
            type: "list",
            items: [
              "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.",
              "The creature has disadvantage on attack rolls.",
              "An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.",
            ],
          },
        ],
      },
      activation: null,
      overlay: null,
    };
    const out = toConditionCanonical(canonical);
    expect(out.slug).toBe("srd-5e_prone");
    expect(out.name).toBe("Prone");
    expect(out.description).toContain("only movement option is to crawl");
    expect(out.description).toContain("disadvantage on attack rolls");
  });
});

describe("buildConditionsFromStructured", () => {
  it("synthesizes CanonicalEntry list from 5etools-shaped structured entries", () => {
    const structured = [
      {
        name: "Prone",
        source: "PHB",
        srd: true,
        entries: [{ type: "list", items: ["A prone creature can only crawl."] }],
      },
      {
        name: "Charmed",
        source: "PHB",
        srd: true,
        entries: [{ type: "list", items: ["A charmed creature can't attack the charmer."] }],
      },
    ];
    const out = buildConditionsFromStructured(structured, "2014");
    expect(out.length).toBe(2);
    expect(out[0].slug).toBe("srd-5e_prone");
    expect(out[0].edition).toBe("2014");
    expect(out[0].kind).toBe("condition");
    expect(out[0].structured).toBe(structured[0]);
  });
});

describe("conditions: real-data integration (5etools dump)", () => {
  it.skipIf(!process.env.STRUCTURED_RULES_PATH)(
    "emits at least 14 conditions for 2014 (SRD core) when wired through structured-rules",
    async () => {
      const rootPath = process.env.STRUCTURED_RULES_PATH!;
      // slugSet: undefined means "no slug filter" — Open5e provides no
      // conditions, so structured-rules is source-of-truth here.
      const structured = await readStructuredRules({
        kind: "conditions",
        edition: "2014",
        rootPath,
        slugSet: new Set<string>(),
      });
      const merged = buildConditionsFromStructured(structured, "2014");
      const canonical = merged.map(toConditionCanonical);

      expect(canonical.length).toBeGreaterThanOrEqual(14);
      const names = new Set(canonical.map(c => c.name.toLowerCase()));
      expect(names.has("prone")).toBe(true);
      expect(names.has("charmed")).toBe(true);
      expect(names.has("restrained")).toBe(true);

      // Description must be populated from structured.entries.
      const prone = canonical.find(c => c.name === "Prone");
      expect(prone?.description.length).toBeGreaterThan(0);
      expect(prone?.description).toMatch(/crawl/i);
    },
  );

  it.skipIf(!process.env.STRUCTURED_RULES_PATH)(
    "emits at least 14 conditions for 2024 (SRD core)",
    async () => {
      const rootPath = process.env.STRUCTURED_RULES_PATH!;
      const structured = await readStructuredRules({
        kind: "conditions",
        edition: "2024",
        rootPath,
        slugSet: new Set<string>(),
      });
      const merged = buildConditionsFromStructured(structured, "2024");
      const canonical = merged.map(toConditionCanonical);

      expect(canonical.length).toBeGreaterThanOrEqual(14);
      const names = new Set(canonical.map(c => c.name.toLowerCase()));
      expect(names.has("prone")).toBe(true);
      expect(names.has("charmed")).toBe(true);
    },
  );
});
