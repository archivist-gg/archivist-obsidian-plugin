import { describe, it, expect } from "vitest";
import { resolveMonster, monsterCodec } from "@archivist-gg/dnd5e"; // S3: barrel (no monster/* subpath exports)

const ctx = { lookup: () => undefined } as never; // ResolveContext stub

describe("monster retrofit (normalizing codec + resolve)", () => {
  it("(b) resolveMonster derives PB/XP from CR", () => {
    const parsed = monsterCodec.parse({ type: "monster", frontmatter: {}, body: "name: Goblin\ncr: 5", raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const r = resolveMonster(parsed.data, ctx); // N1: no Record cast (param is Monster post-Step-5)
    expect(r.proficiency_bonus).toBe(3); // CR 5 → PB +3
    expect(r.xp).toBe(1800);            // CR 5 → 1800 XP
  });

  it("(c) codec extracts LR-from-trait to canonical field (persists)", () => {
    const body = [
      "name: Aboleth",
      "cr: 10",
      "traits:",
      "  - name: Legendary Resistance (3/Day)",
      "    desc: If the aboleth fails a saving throw, it can choose to succeed instead.",
    ].join("\n");
    const parsed = monsterCodec.parse({ type: "monster", frontmatter: {}, body, raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data.legendary_resistance).toBe(3);                 // canonical field present
    expect((data.traits as unknown[])?.some((t: any) => /Legendary Resistance/.test(t.name))).toBe(false); // trait spliced
  });

  it("(c) codec does NOT inject resolve-derived PB/XP", () => {
    const parsed = monsterCodec.parse({ type: "monster", frontmatter: {}, body: "name: Goblin\ncr: 5", raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data.proficiency_bonus).toBeUndefined(); // PB/XP come from resolve, never the codec/save path
    expect(data.xp).toBeUndefined();
  });

  it("(d) monster serialize→parse round-trips canonical data", () => {
    const body = "name: Goblin\ncr: 5\nac: 15\nhp: 7";
    const first = monsterCodec.parse({ type: "monster", frontmatter: {}, body, raw: "" });
    expect(first.success).toBe(true);
    if (!first.success) return;
    const round = monsterCodec.parse({ type: "monster", frontmatter: {}, body: monsterCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });
});
