// tests/srd-canonical/audit-conditions.test.ts
import { describe, it, expect } from "vitest";
import { computeAuditReport, type AuditInput } from "../../tools/srd-canonical/audit-conditions";

const SAMPLE_INPUT: AuditInput = {
  items2014: [
    {
      slug: "srd-5e_arrow-catching-shield",
      name: "Arrow-Catching Shield",
      bonuses: { ac: 2 },
      description: "You gain a +2 bonus to AC against ranged attacks while you wield this shield.",
    },
    {
      slug: "srd-5e_bracers-of-defense",
      name: "Bracers of Defense",
      bonuses: { ac: { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] } },
      description: "While wearing these bracers, you gain a +2 bonus to AC if you are wearing no armor and using no shield.",
    },
    {
      slug: "srd-5e_cloak-of-protection",
      name: "Cloak of Protection",
      bonuses: { ac: 1 },
      description: "You gain a +1 bonus to AC and saving throws while you wear this cloak.",
    },
  ],
  items2024: [],
};

describe("computeAuditReport", () => {
  it("classifies a curated item as 'curated'", () => {
    const r = computeAuditReport(SAMPLE_INPUT);
    expect(r.byStatus.curated).toBeGreaterThanOrEqual(1);
    expect(r.entries.find(e => e.slug === "srd-5e_bracers-of-defense")?.status).toBe("curated");
  });

  it("classifies a flat item with conditional prose as 'prose-only'", () => {
    const r = computeAuditReport(SAMPLE_INPUT);
    const archery = r.entries.find(e => e.slug === "srd-5e_arrow-catching-shield");
    expect(archery?.status).toBe("prose-only");
  });

  it("classifies a flat item with no conditional prose as 'flat'", () => {
    const r = computeAuditReport(SAMPLE_INPUT);
    const cloak = r.entries.find(e => e.slug === "srd-5e_cloak-of-protection");
    expect(cloak?.status).toBe("flat");
  });

  it("renderMarkdown produces a markdown checklist", () => {
    const r = computeAuditReport(SAMPLE_INPUT);
    const md = r.renderMarkdown();
    expect(md).toContain("# Conditional-bonus audit");
    expect(md).toContain("srd-5e_arrow-catching-shield");
    expect(md).toContain("- [ ] reviewed");
    expect(md).toContain("Coverage summary");
  });
});
