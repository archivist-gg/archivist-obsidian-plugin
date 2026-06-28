import { describe, it, expect } from "vitest";
import { isEmpty } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("isEmpty", () => {
  it("string: null/undefined/empty-string are empty", () => {
    expect(isEmpty(null, "string")).toBe(true);
    expect(isEmpty(undefined, "string")).toBe(true);
    expect(isEmpty("", "string")).toBe(true);
    expect(isEmpty("longsword", "string")).toBe(false);
  });

  it("number: null/undefined are empty; 0 and positives are NOT", () => {
    expect(isEmpty(null, "number")).toBe(true);
    expect(isEmpty(undefined, "number")).toBe(true);
    expect(isEmpty(0, "number")).toBe(false);
    expect(isEmpty(3, "number")).toBe(false);
  });

  it("cost: also treats '0.00' as empty", () => {
    expect(isEmpty("0.00", "cost")).toBe(true);
    expect(isEmpty("", "cost")).toBe(true);
    expect(isEmpty(null, "cost")).toBe(true);
    expect(isEmpty("1.50", "cost")).toBe(false);
  });

  it("boolean: false/null/undefined are empty (attunement semantics)", () => {
    expect(isEmpty(false, "boolean")).toBe(true);
    expect(isEmpty(null, "boolean")).toBe(true);
    expect(isEmpty(undefined, "boolean")).toBe(true);
    expect(isEmpty(true, "boolean")).toBe(false);
  });
});

import { classifyGap } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("classifyGap", () => {
  it("both empty → both-empty", () => {
    expect(classifyGap(null, undefined, "string")).toBe("both-empty");
  });

  it("only Open5e → open5e-only", () => {
    expect(classifyGap("longsword", null, "string")).toBe("open5e-only");
  });

  it("only 5etools → 5etools-only", () => {
    expect(classifyGap(null, "longsword", "string")).toBe("5etools-only");
  });

  it("both populated, equal values → match", () => {
    expect(classifyGap("rare", "rare", "string")).toBe("match");
  });

  it("both populated, unequal values → disagree", () => {
    expect(classifyGap("rare", "very rare", "string")).toBe("disagree");
  });

  it("both populated numbers, unequal → disagree", () => {
    expect(classifyGap(3, 5, "number")).toBe("disagree");
  });

  it("cost: '0.00' on Open5e + '1.00' on 5etools → 5etools-only", () => {
    expect(classifyGap("0.00", "1.00", "cost")).toBe("5etools-only");
  });

  it("boolean: false on Open5e + true on 5etools → 5etools-only", () => {
    expect(classifyGap(false, true, "boolean")).toBe("5etools-only");
  });
});

import { FIELD_PAIRINGS } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("FIELD_PAIRINGS", () => {
  it("has expected material fields", () => {
    const material = FIELD_PAIRINGS.filter(p => p.materiality === "material").map(p => p.canonicalField);
    expect(material).toContain("description");
    expect(material).toContain("base_item");
    expect(material).toContain("attunement.required");
    expect(material).toContain("attunement.restriction");
    expect(material).toContain("weight");
    expect(material).toContain("cost");
    expect(material).toContain("rarity");
  });

  it("has expected informational fields", () => {
    const info = FIELD_PAIRINGS.filter(p => p.materiality === "informational").map(p => p.canonicalField);
    expect(info).toContain("name");
    expect(info).toContain("category");
    expect(info).toContain("size");
  });

  it("every entry has both extractor functions", () => {
    for (const p of FIELD_PAIRINGS) {
      expect(typeof p.open5eExtract).toBe("function");
      expect(typeof p.fivetoolsExtract).toBe("function");
    }
  });
});

describe("FIELD_PAIRINGS extractors", () => {
  const get = (field: string) => {
    const p = FIELD_PAIRINGS.find(p => p.canonicalField === field);
    if (!p) throw new Error(`pairing ${field} missing`);
    return p;
  };

  it("base_item: open5e weapon.name → string; null → undefined", () => {
    const p = get("base_item");
    expect(p.open5eExtract({ weapon: { name: "Longsword" } })).toBe("Longsword");
    expect(p.open5eExtract({ weapon: null })).toBeUndefined();
    expect(p.open5eExtract({ armor: { name: "Plate" } })).toBe("Plate");
  });

  it("base_item: 5etools baseItem slug → title-cased name", () => {
    const p = get("base_item");
    expect(p.fivetoolsExtract({ baseItem: "longsword|xphb" })).toBe("Longsword");
    expect(p.fivetoolsExtract({ baseItem: "hand-crossbow|phb" })).toBe("Hand Crossbow");
    expect(p.fivetoolsExtract({})).toBeUndefined();
  });

  it("description: open5e desc passes through; 5etools string entries join with double-newline", () => {
    const p = get("description");
    expect(p.open5eExtract({ desc: "hello" })).toBe("hello");
    expect(p.fivetoolsExtract({ entries: ["one", "two"] })).toBe("one\n\ntwo");
    expect(p.fivetoolsExtract({ entries: ["a", { type: "list" }] })).toBeUndefined();
  });

  it("attunement.required: open5e boolean; 5etools reqAttune true OR non-empty string → true", () => {
    const p = get("attunement.required");
    expect(p.open5eExtract({ requires_attunement: true })).toBe(true);
    expect(p.open5eExtract({ requires_attunement: false })).toBe(false);
    expect(p.fivetoolsExtract({ reqAttune: true })).toBe(true);
    expect(p.fivetoolsExtract({ reqAttune: "by a wizard" })).toBe(true);
    expect(p.fivetoolsExtract({})).toBe(false);
  });

  it("attunement.restriction: open5e attunement_detail; 5etools reqAttune-as-string", () => {
    const p = get("attunement.restriction");
    expect(p.open5eExtract({ attunement_detail: "by a paladin" })).toBe("by a paladin");
    expect(p.open5eExtract({})).toBeUndefined();
    expect(p.fivetoolsExtract({ reqAttune: "by a wizard" })).toBe("by a wizard");
    expect(p.fivetoolsExtract({ reqAttune: true })).toBeUndefined();
  });

  it("cost: open5e cost passes through; 5etools value (cp) → gp string", () => {
    const p = get("cost");
    expect(p.open5eExtract({ cost: "1.50" })).toBe("1.50");
    expect(p.fivetoolsExtract({ value: 100 })).toBe("1.00");
    expect(p.fivetoolsExtract({ value: 0 })).toBeUndefined();
    expect(p.fivetoolsExtract({})).toBeUndefined();
  });
});

import { joinSources } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("joinSources", () => {
  it("matches by slug across the two sources", () => {
    const open5e = [
      { key: "srd-2024_sun-blade", name: "Sun Blade" },
      { key: "srd-2024_holy-avenger", name: "Holy Avenger" },
    ];
    const fivetools = [
      { name: "Sun Blade", source: "XDMG" },
      { name: "Holy Avenger", source: "XDMG" },
    ];
    const pairs = joinSources(open5e, fivetools, "2024");
    expect(pairs.length).toBe(2);
    const sb = pairs.find(p => p.slug === "srd-2024_sun-blade");
    expect(sb?.open5e).toBeDefined();
    expect(sb?.fivetools).toBeDefined();
    expect(sb?.fivetools?.name).toBe("Sun Blade");
  });

  it("includes Open5e items with no 5etools match", () => {
    const open5e = [{ key: "srd-2024_only-open5e", name: "Only Open5e" }];
    const fivetools: Array<Record<string, unknown>> = [];
    const pairs = joinSources(open5e, fivetools, "2024");
    expect(pairs.length).toBe(1);
    expect(pairs[0].open5e).toBeDefined();
    expect(pairs[0].fivetools).toBeUndefined();
  });

  it("includes 5etools items with no Open5e match", () => {
    const open5e: Array<Record<string, unknown>> = [];
    const fivetools = [{ name: "Only 5etools", source: "XDMG" }];
    const pairs = joinSources(open5e, fivetools, "2024");
    expect(pairs.length).toBe(1);
    expect(pairs[0].open5e).toBeUndefined();
    expect(pairs[0].fivetools).toBeDefined();
  });
});

import { auditPair, partitionFindings, type Finding } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("auditPair", () => {
  it("emits a Finding per FIELD_PAIRINGS entry", () => {
    const pair = {
      slug: "srd-2024_sun-blade",
      edition: "2024" as const,
      open5e: { name: "Sun Blade", desc: "Bright blade.", weight: 3, weapon: null, requires_attunement: true, attunement_detail: null, cost: "0.00", rarity: "rare", category: "Weapon", size: "Medium" },
      fivetools: { name: "Sun Blade", entries: ["one", "two"], weight: 3, baseItem: "longsword|xphb", reqAttune: true, value: 0, rarity: "rare", type: "M" },
    };
    const findings = auditPair(pair);
    expect(findings.length).toBe(FIELD_PAIRINGS.length);
    const baseItem = findings.find(f => f.field === "base_item");
    expect(baseItem?.gapClass).toBe("5etools-only");
    expect(baseItem?.materiality).toBe("material");
    // Finding stores the canonical extracted value, not the raw source value.
    expect(baseItem?.fivetools).toBe("Longsword");
    const weight = findings.find(f => f.field === "weight");
    expect(weight?.gapClass).toBe("match");
    const cost = findings.find(f => f.field === "cost");
    expect(cost?.gapClass).toBe("both-empty");
    const restriction = findings.find(f => f.field === "attunement.restriction");
    expect(restriction?.gapClass).toBe("both-empty");
  });
});

describe("partitionFindings", () => {
  it("buckets material/informational/symmetric correctly", () => {
    const findings: Finding[] = [
      { slug: "a", edition: "2024", field: "base_item", gapClass: "5etools-only", materiality: "material", open5e: null, fivetools: "longsword|xphb" },
      { slug: "a", edition: "2024", field: "category", gapClass: "5etools-only", materiality: "informational", open5e: null, fivetools: "M" },
      { slug: "a", edition: "2024", field: "rarity", gapClass: "both-empty", materiality: "material", open5e: null, fivetools: null },
      { slug: "a", edition: "2024", field: "rarity", gapClass: "match", materiality: "material", open5e: "rare", fivetools: "rare" },
      { slug: "a", edition: "2024", field: "weight", gapClass: "disagree", materiality: "material", open5e: 3, fivetools: 5 },
      { slug: "a", edition: "2024", field: "name", gapClass: "disagree", materiality: "informational", open5e: "X", fivetools: "Y" },
      { slug: "a", edition: "2024", field: "size", gapClass: "open5e-only", materiality: "informational", open5e: "M", fivetools: null },
      { slug: "a", edition: "2024", field: "category", gapClass: "both-empty", materiality: "informational", open5e: null, fivetools: null },
    ];
    const buckets = partitionFindings(findings);
    expect(buckets.material.length).toBe(1); // base_item
    expect(buckets.materialDisagree.length).toBe(1); // weight
    expect(buckets.informational.length).toBe(1); // category
    expect(buckets.symmetric.length).toBe(1); // rarity both-empty
    // 'match' findings are dropped (no actionable signal).
    expect(buckets.informationalDisagree.length).toBe(1); // name
    // open5e-only and informational both-empty are dropped (no actionable signal).
    const totalBucketed = buckets.material.length + buckets.materialDisagree.length
      + buckets.informational.length + buckets.informationalDisagree.length + buckets.symmetric.length;
    expect(totalBucketed).toBe(5); // dropped: 'rarity match', 'size open5e-only', 'category both-empty informational'
  });
});

import { renderMarkdown } from "../../packages/dnd5e/tools/srd-canonical/audit-merger-gaps";

describe("renderMarkdown", () => {
  it("emits 3 sections (material, informational, symmetric) and a summary table", () => {
    const buckets = {
      material: [
        { slug: "srd-2024_sun-blade", edition: "2024" as const, field: "base_item", gapClass: "5etools-only" as const, materiality: "material" as const, open5e: null, fivetools: "longsword|xphb" },
      ],
      materialDisagree: [
        { slug: "srd-2024_x", edition: "2024" as const, field: "weight", gapClass: "disagree" as const, materiality: "material" as const, open5e: 3, fivetools: 5 },
      ],
      informational: [
        { slug: "srd-2014_y", edition: "2014" as const, field: "category", gapClass: "5etools-only" as const, materiality: "informational" as const, open5e: null, fivetools: "M" },
      ],
      informationalDisagree: [],
      symmetric: [
        { slug: "srd-2024_z", edition: "2024" as const, field: "cost", gapClass: "both-empty" as const, materiality: "material" as const, open5e: null, fivetools: null },
      ],
    };
    const md = renderMarkdown(buckets);
    expect(md).toMatch(/# Merger gap audit/);
    expect(md).toMatch(/## Material gaps/);
    expect(md).toMatch(/## Informational gaps/);
    expect(md).toMatch(/## Symmetric gaps/);
    expect(md).toMatch(/srd-2024_sun-blade/);
    expect(md).toMatch(/longsword\|xphb/);
    expect(md).toMatch(/disagree/i);
  });
});
