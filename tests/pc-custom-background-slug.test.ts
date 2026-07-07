import { describe, it, expect } from "vitest";
import { PCResolver } from "../packages/obsidian/src/modules/pc/pc.resolver";
import { buildDecisionLedger, bareEntitySlug } from "@archivist/dnd5e/pc/pc.decision-engine";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { Character } from "../packages/obsidian/src/modules/pc/pc.types";

// Regression: selecting a CUSTOM background in the builder crashed the whole step
// with `TypeError: Cannot read properties of undefined (reading 'indexOf')` at
// bareEntitySlug → buildDecisionLedger → renderBackgroundStep.
//
// Root cause: the custom-background builder's `buildCustomBackgroundData` omits
// `slug` from the entity BODY (saveEntity generates the slug for the
// frontmatter/registration only), so the registered entity's `data.slug` is
// undefined. The resolver's `lookup` returns `reg.data`, so `resolved.background.slug`
// was undefined, and `bareEntitySlug(undefined)` threw. SRD entities don't hit this
// because their body block carries `slug`. Fix: the resolver backfills the canonical
// `reg.slug`; `bareEntitySlug` degrades gracefully on a nullish slug.

// Exactly what buildCustomBackgroundData produces — note: NO `slug` field.
const CUSTOM_BG_DATA = {
  name: "Background Reaver",
  edition: "2014",
  source: "Homebrew",
  description: "",
  skill_proficiencies: ["arcana", "insight"],
  tool_proficiencies: [],
  language_proficiencies: [],
  equipment: [],
  feature: { name: "Background Feature", description: "A feature granted by this custom background." },
};

function characterWithBackground(bgRef: string): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: bgRef,
    class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
      conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  } as unknown as Character;
}

function regWithCustomBg() {
  return buildMockRegistry([
    { slug: "homebrew_background-reaver", name: "Background Reaver", entityType: "background", data: CUSTOM_BG_DATA },
  ]);
}

describe("custom (slugless-body) background — resolver backfills the registry slug", () => {
  it("resolves a slugless-body background carrying its canonical registry slug", () => {
    const reg = regWithCustomBg();
    const { character: resolved } = new PCResolver(reg).resolve(characterWithBackground("[[homebrew_background-reaver]]"));
    expect(resolved.background).toBeTruthy();
    expect((resolved.background as { slug?: string }).slug).toBe("homebrew_background-reaver");
  });

  it("buildDecisionLedger does not throw for a custom background (the reported crash)", () => {
    const reg = regWithCustomBg();
    const { character: resolved } = new PCResolver(reg).resolve(characterWithBackground("[[homebrew_background-reaver]]"));
    expect(() => buildDecisionLedger(resolved, { registry: reg })).not.toThrow();
  });

  it("SRD-style background (body carries slug) is unchanged", () => {
    const reg = buildMockRegistry([
      { slug: "srd-2024_acolyte", name: "Acolyte", entityType: "background",
        data: { slug: "srd-2024_acolyte", name: "Acolyte", skill_proficiencies: ["insight", "religion"], feature: { name: "F", description: "d" } } },
    ]);
    const { character: resolved } = new PCResolver(reg).resolve(characterWithBackground("[[srd-2024_acolyte]]"));
    expect((resolved.background as { slug?: string }).slug).toBe("srd-2024_acolyte");
  });
});

describe("bareEntitySlug — defense-in-depth against a nullish slug", () => {
  it("strips the compendium prefix for a normal slug", () => {
    expect(bareEntitySlug("srd-2024_acolyte")).toBe("acolyte");
    expect(bareEntitySlug("acolyte")).toBe("acolyte");
  });
  it("returns empty string for a nullish/empty slug instead of throwing", () => {
    expect(bareEntitySlug(undefined as unknown as string)).toBe("");
    expect(bareEntitySlug(null as unknown as string)).toBe("");
    expect(bareEntitySlug("")).toBe("");
  });
});
