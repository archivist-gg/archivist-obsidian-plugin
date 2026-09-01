import { describe, it, expect } from "vitest";
import { parseArmor } from "@archivist-gg/dnd5e/armor/armor.parser";
import { PLATE, BREASTPLATE, SHIELD, MAGE_ARMOR } from "./fixtures/armor";

describe("parseArmor", () => {
  it("parses a heavy armor fixture", () => {
    const r = parseArmor(PLATE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Plate");
      expect(r.data.ac.base).toBe(18);
    }
  });

  it("parses medium armor with capped DEX", () => {
    const r = parseArmor(BREASTPLATE);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ac.dex_max).toBe(2);
  });

  it("parses a shield with flat AC bonus", () => {
    const r = parseArmor(SHIELD);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ac.flat).toBe(2);
  });

  it("parses Mage Armor (category: spell)", () => {
    const r = parseArmor(MAGE_ARMOR);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.category).toBe("spell");
  });

  it("preserves unknown fields under raw", () => {
    const src = `name: Plate\nslug: plate\ncategory: heavy\nac: { base: 18, flat: 0, add_dex: false, add_con: false, add_wis: false }\ndocument__url: http://example.com`;
    const r = parseArmor(src);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.raw?.document__url).toBe("http://example.com");
  });

  it("rejects malformed YAML", () => {
    const r = parseArmor(":\n  - bad");
    expect(r.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const r = parseArmor(`name: Plate`);
    expect(r.success).toBe(false);
  });
});

describe("parseArmor — strength_required alias (spec §5)", () => {
  it("maps strength_required into strength_requirement (declared-wins, alias kept, not raw-bagged)", () => {
    const r = parseArmor("name: Chain Mail\nslug: chain-mail\ncategory: heavy\nac: {base: 16}\nstrength_required: 13");
    expect(r.success).toBe(true);
    if (!r.success) return;
    // RED pre-fix: no mapping exists, so the Strength line is missing on all 6 SRD armor notes.
    expect(r.data.strength_requirement).toBe(13);
    // PIN, not red (`armorEntitySchema` is `.loose()`, so the alias already reaches the output
    // pre-fix). Its kill power is a future `delete raw.data.strength_required`, which would
    // convert the census disposal from `kept` to a NEW `stripped` row of 6 — spec §5 forbids it.
    // NO delete; double cast REQUIRED (ArmorEntity is an interface with no index signature —
    // a single cast is TS2352, Gate 2 B-1).
    expect((r.data as unknown as Record<string, unknown>).strength_required).toBe(13);
    // RED pre-fix: KNOWN_KEYS lacks the alias, so the extras loop duplicates it into raw.
    expect(r.data.raw?.strength_required).toBeUndefined();
  });

  it("declared value wins when both present", () => {
    const r = parseArmor("name: X\nslug: x\ncategory: heavy\nac: {base: 16}\nstrength_requirement: 15\nstrength_required: 13");
    // Non-vacuity guard (green both sides): without it a parse refusal would pass silently.
    expect(r.success).toBe(true);
    // PIN (green both sides). Kill power: a wrong-direction or unconditional mapping.
    if (r.success) expect(r.data.strength_requirement).toBe(15);
  });
});

describe("parseArmor — root extras (spec §5)", () => {
  const WITH_EXTRAS = [
    "name: Plate",
    "slug: plate",
    "category: heavy",
    "ac: {base: 18}",
    // The converter emits `rendering_hint` as the empty string on every carrier, so the
    // declaration must never gain `.min(1)`.
    'rendering_hint: ""',
    "has_fluff: true",
    "has_fluff_images: true",
    "image: Plate.webp",
  ].join("\n");

  it("declares rendering_hint/has_fluff/has_fluff_images/image at the root and never raw-bags them", () => {
    const r = parseArmor(WITH_EXTRAS);
    expect(r.success).toBe(true);
    if (!r.success) return;
    // PINS (green both sides — `.loose()` strips nothing, so the keys already land on the
    // output pre-fix). Post-fix they are DECLARED, so typed access also pins the types.
    expect(r.data.rendering_hint).toBe("");
    expect(r.data.has_fluff).toBe(true);
    expect(r.data.has_fluff_images).toBe(true);
    expect(r.data.image).toBe("Plate.webp");
    // RED pre-fix: KNOWN_KEYS lacks all four, so the extras loop DUPLICATES every one of
    // them into raw (census rows `armor :: rendering_hint :: duplicated` 27 and
    // `armor :: has_fluff_images :: duplicated` 13).
    expect(r.data.raw?.rendering_hint).toBeUndefined();
    expect(r.data.raw?.has_fluff).toBeUndefined();
    expect(r.data.raw?.has_fluff_images).toBeUndefined();
    expect(r.data.raw?.image).toBeUndefined();
    // The whole raw bag stays unset: no OTHER key leaked either.
    expect(r.data.raw).toBeUndefined();
  });

  it("accepts the array form of image (>= 2 fluff images)", () => {
    const r = parseArmor('name: Plate\nslug: plate\ncategory: heavy\nac: {base: 18}\nimage: ["A.webp", "B.webp"]');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.image).toEqual(["A.webp", "B.webp"]);
  });
});
