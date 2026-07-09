// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist-gg/core";
import { dnd5ePack } from "@archivist-gg/dnd5e";
import type { ArmorEntity } from "@archivist-gg/dnd5e/armor/armor.types";
import { renderArmorBlock } from "../../packages/obsidian/src/modules/armor/armor.renderer";

// Second-entity e2e (§9): drive a fixture armor body through ALL layers with NO
// Obsidian kernel — core kernel (createArchivist + pack EntityType lookup) →
// dnd5e codec.parse → (armor has NO resolve; the codec output is the resolved
// entity) → obsidian renderArmorBlock — asserting a real non-empty stat block.
const ARMOR_BODY = [
  "name: Plate",
  "slug: plate",
  "category: heavy",
  "ac:",
  "  base: 18",
  '  description: "18"',
  "strength_requirement: 15",
  "stealth_disadvantage: true",
  "weight: 65",
  'cost: "1500 gp"',
  "source: PHB",
].join("\n");

describe("armor pipeline (core kernel → dnd5e pack codec → render, no Obsidian)", () => {
  it("runs end-to-end: getEntityType('armor').doc.parse → renderArmorBlock → non-empty block", () => {
    const archivist = createArchivist({ storage: {} as unknown as never, content: { lookup: () => undefined } });
    archivist.registerPack(dnd5ePack);

    const entityType = archivist.getEntityType("armor");
    expect(entityType?.doc).toBeDefined();
    // armor is identity-resolved: the pack declares no `resolve`, so the parsed
    // codec output flows straight into the renderer.
    expect(entityType?.resolve).toBeUndefined();

    const doc = { type: "armor", frontmatter: {}, body: ARMOR_BODY, raw: ARMOR_BODY };
    const parsed = entityType!.doc!.parse(doc);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const armor = parsed.data as ArmorEntity;
    expect(armor.name).toBe("Plate");
    // schema default-injection survived the kernel round-trip
    expect(armor.ac.flat).toBe(0);

    const block = renderArmorBlock(armor);
    // NON-EMPTY stat block: real DOM children + the armor name and AC rendered.
    expect(block.children.length).toBeGreaterThan(0);
    expect(block.textContent).toContain("Plate");
    expect(block.textContent).toContain("Armor Class");
    expect(block.textContent).toContain("18");
  });
});
