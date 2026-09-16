/**
 * Entity-backed condition labels (R4-G2 Task 6 · spec §6, floor §11.6).
 *
 * The retired `CONDITION_DISPLAY_NAMES` table is replaced by a registry scan.
 * The load-bearing property is that the DEGRADED path — no registry, or a
 * registry with no condition entities — reproduces the retired table
 * BYTE-FOR-BYTE, so the fallback is an identity, not a downgrade.
 */
import { describe, it, expect, vi } from "vitest";
import { EntityRegistry } from "@archivist-gg/core";
import { CONDITION_SLUGS } from "@archivist-gg/dnd5e/pc/conditions.constants";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import {
  buildConditionEntityMap,
  buildConditionLabelMap,
  conditionDisplayName,
  conditionLabelMapFrom,
  conditionTooltipParagraph,
} from "../packages/obsidian/src/modules/pc/condition-labels";

/**
 * The RETIRED table, copied VERBATIM out of
 * `archivist-dnd5e/src/pc/conditions.constants.ts:12` at dnd5e `0b948fa`, i.e.
 * BEFORE the delete this task performs. This literal is the whole point of the
 * fixture: it is the only surviving copy of the shipped spellings, so it must
 * never be re-derived from `titleCase` or from the entity corpus — that would
 * make the parity assertion self-referential and vacuous.
 */
const RETIRED_CONDITION_DISPLAY_NAMES: Record<string, string> = {
  blinded: "Blinded",
  charmed: "Charmed",
  deafened: "Deafened",
  frightened: "Frightened",
  grappled: "Grappled",
  incapacitated: "Incapacitated",
  invisible: "Invisible",
  paralyzed: "Paralyzed",
  petrified: "Petrified",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};

/** One condition entity as the vault registers it: `data` is the fenced
 *  code-block payload (`entity-vault-store.ts` `parseEntityFile`), so
 *  `description` is a real key on it. */
function conditionEntry(opts: {
  slug: string;
  name: string;
  compendium?: string;
  description?: string;
}) {
  return {
    slug: opts.slug,
    name: opts.name,
    entityType: "condition",
    compendium: opts.compendium ?? "SRD 2024",
    data: {
      slug: opts.slug,
      name: opts.name,
      edition: "2024",
      source: "SRD 5.2",
      description: opts.description ?? "",
    },
  };
}

describe("conditionDisplayName · retired-table parity (the identity fallback)", () => {
  it("the fixture's key set IS the engine vocabulary (guards fixture drift)", () => {
    expect(Object.keys(RETIRED_CONDITION_DISPLAY_NAMES).sort())
      .toEqual([...CONDITION_SLUGS].sort());
  });

  it("an EMPTY registry returns all 14 retired spellings byte-for-byte", () => {
    const map = buildConditionLabelMap(new EntityRegistry());
    expect(map.size).toBe(0);
    for (const [slug, retired] of Object.entries(RETIRED_CONDITION_DISPLAY_NAMES)) {
      expect(conditionDisplayName(slug, map)).toBe(retired);
    }
  });

  it("NO map at all returns the same 14 spellings, plus the exhaustion label", () => {
    for (const [slug, retired] of Object.entries(RETIRED_CONDITION_DISPLAY_NAMES)) {
      expect(conditionDisplayName(slug)).toBe(retired);
    }
    // Exhaustion never lived in the retired table (spec §6, Gate 1 M2/B): its
    // parity baseline is the inline literal `Exhaustion ${n}` at
    // defenses-conditions-panel.ts:138, so the label half must title-case to
    // exactly "Exhaustion".
    expect(conditionDisplayName("exhaustion")).toBe("Exhaustion");
  });

  it("a registry with no condition entities is the empty-map case (other types do not leak)", () => {
    const registry = buildMockRegistry([
      { slug: "srd-2024_spell_fireball", name: "Fireball", entityType: "spell", data: {} },
      { slug: "srd-2024_item_rope", name: "Rope", entityType: "item", data: {} },
    ]);
    expect(buildConditionLabelMap(registry).size).toBe(0);
    expect(conditionDisplayName("blinded", buildConditionLabelMap(registry))).toBe("Blinded");
  });
});

describe("buildConditionLabelMap · the registry supplies the label", () => {
  // CONTROL, deliberately kept from the brief: it has ZERO kill power on its
  // own, because "Blinded" is also what titleCase("blinded") produces. The
  // discriminating case is the next one.
  it("CONTROL: a registered `Blinded` resolves to \"Blinded\" (indistinguishable from the fallback)", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "srd-2024_condition_blinded", name: "Blinded" }),
    ]);
    const map = buildConditionLabelMap(registry);
    expect(map.get("blinded")).toBe("Blinded");
    expect(conditionDisplayName("blinded", map)).toBe("Blinded");
  });

  it("the entity NAME wins over the title-cased slug", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "srd-2024_condition_blinded", name: "Blinded (2024 text)" }),
    ]);
    const map = buildConditionLabelMap(registry);
    expect(conditionDisplayName("blinded", map)).toBe("Blinded (2024 text)");
    // The fallback is what it must NOT be.
    expect(conditionDisplayName("blinded", map)).not.toBe("Blinded");
  });

  it("keys on the BARE slug, so a three-part namespaced slug still resolves", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "homebrew_condition_stunned", name: "Dazed" }),
    ]);
    const map = buildConditionLabelMap(registry);
    expect([...map.keys()]).toEqual(["stunned"]);
    expect(conditionDisplayName("stunned", map)).toBe("Dazed");
  });

  it("a slug outside the 14-vocabulary is served too (the map is not slug-gated)", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "homebrew_condition_bewildered", name: "Bewildered" }),
    ]);
    expect(conditionDisplayName("bewildered", buildConditionLabelMap(registry))).toBe("Bewildered");
  });
});

describe("buildConditionLabelMap · multi-book pick order", () => {
  const HIDDEN = new Set(["SRD 5e"]);

  /** Both insertion orders of the same two entities. `search` sorts by NAME, so
   *  insertion order must not reach the winner — asserting both orders is what
   *  makes that claim a measurement rather than a hope. */
  function bothOrders(a: ReturnType<typeof conditionEntry>, b: ReturnType<typeof conditionEntry>) {
    return [buildMockRegistry([a, b]), buildMockRegistry([b, a])];
  }

  it("REPLACE branch: a hidden incumbent loses to a visible challenger", () => {
    // "Alpha…" sorts first, so the HIDDEN copy is the incumbent and the visible
    // one arrives second — the branch that must overwrite.
    const hidden = conditionEntry({ slug: "srd-5e_condition_blinded", name: "Alpha Blinded", compendium: "SRD 5e" });
    const visible = conditionEntry({ slug: "srd-2024_condition_blinded", name: "Zulu Blinded", compendium: "SRD 2024" });
    for (const registry of bothOrders(hidden, visible)) {
      expect(conditionDisplayName("blinded", buildConditionLabelMap(registry, HIDDEN)))
        .toBe("Zulu Blinded");
    }
  });

  it("KEEP branch: a visible incumbent is not displaced by a later hidden copy", () => {
    // Names swapped, so the VISIBLE copy is the incumbent: the branch that must
    // NOT overwrite. Without it, a last-wins loop would pass the replace case
    // above and still be wrong.
    const visible = conditionEntry({ slug: "srd-2024_condition_blinded", name: "Alpha Blinded", compendium: "SRD 2024" });
    const hidden = conditionEntry({ slug: "srd-5e_condition_blinded", name: "Zulu Blinded", compendium: "SRD 5e" });
    for (const registry of bothOrders(visible, hidden)) {
      expect(conditionDisplayName("blinded", buildConditionLabelMap(registry, HIDDEN)))
        .toBe("Alpha Blinded");
    }
  });

  it("both visible: first of the NAME-SORTED enumeration wins, in either insertion order", () => {
    const aaa = conditionEntry({ slug: "srd-2024_condition_blinded", name: "Aaa Blinded", compendium: "SRD 2024" });
    const zzz = conditionEntry({ slug: "homebrew_condition_blinded", name: "Zzz Blinded", compendium: "Homebrew" });
    for (const registry of bothOrders(aaa, zzz)) {
      expect(conditionDisplayName("blinded", buildConditionLabelMap(registry, HIDDEN)))
        .toBe("Aaa Blinded");
    }
  });

  it("both hidden: the pick still resolves (visibility only ORDERS, it never filters)", () => {
    const a = conditionEntry({ slug: "srd-5e_condition_blinded", name: "Aaa Blinded", compendium: "SRD 5e" });
    const b = conditionEntry({ slug: "srd-2024_condition_blinded", name: "Zzz Blinded", compendium: "SRD 2024" });
    const registry = buildMockRegistry([a, b]);
    const map = buildConditionLabelMap(registry, new Set(["SRD 5e", "SRD 2024"]));
    expect(conditionDisplayName("blinded", map)).toBe("Aaa Blinded");
  });

  it("omitting `hidden` hides nothing", () => {
    const srd5e = conditionEntry({ slug: "srd-5e_condition_blinded", name: "Alpha Blinded", compendium: "SRD 5e" });
    const srd2024 = conditionEntry({ slug: "srd-2024_condition_blinded", name: "Zulu Blinded", compendium: "SRD 2024" });
    const registry = buildMockRegistry([srd5e, srd2024]);
    expect(conditionDisplayName("blinded", buildConditionLabelMap(registry))).toBe("Alpha Blinded");
  });
});

describe("buildConditionEntityMap · one scan, and the label map derives from it", () => {
  it("scans the registry EXACTLY once, with the whole condition bucket", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "srd-2024_condition_blinded", name: "Blinded" }),
      conditionEntry({ slug: "srd-2024_condition_prone", name: "Prone" }),
    ]);
    const spy = vi.spyOn(registry, "search");
    buildConditionLabelMap(registry);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("", "condition", Number.POSITIVE_INFINITY);
  });

  it("buildConditionEntityMap + conditionLabelMapFrom == buildConditionLabelMap, on ONE scan", () => {
    const registry = buildMockRegistry([
      conditionEntry({ slug: "srd-5e_condition_blinded", name: "Alpha Blinded", compendium: "SRD 5e" }),
      conditionEntry({ slug: "srd-2024_condition_blinded", name: "Zulu Blinded", compendium: "SRD 2024" }),
      conditionEntry({ slug: "srd-2024_condition_prone", name: "Prone" }),
    ]);
    const hidden = new Set(["SRD 5e"]);
    const spy = vi.spyOn(registry, "search");
    const entities = buildConditionEntityMap(registry, hidden);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(conditionLabelMapFrom(entities)).toEqual(buildConditionLabelMap(registry, hidden));
  });
});

describe("buildConditionLabelMap · fail-open on an absent or partial service bundle", () => {
  // Three shipped sheet tests hand components a ctx with no `services` at all,
  // or with an `entities` stub that owns only `getBySlug`. A render path may not
  // throw on either, and it does not need to: the empty map IS the retired
  // table (the parity block at the top of this file).
  it("an undefined registry yields the empty map, not a throw", () => {
    expect(buildConditionLabelMap(undefined).size).toBe(0);
    expect(buildConditionEntityMap(null).size).toBe(0);
    expect(conditionDisplayName("charmed", buildConditionLabelMap(undefined))).toBe("Charmed");
  });

  it("a registry object without `search` yields the empty map, not a throw", () => {
    const partial = { getBySlug: () => null } as never;
    expect(buildConditionLabelMap(partial).size).toBe(0);
  });
});

describe("conditionTooltipParagraph", () => {
  it("returns the FIRST paragraph of the description", () => {
    const entity = conditionEntry({
      slug: "srd-2024_condition_prone",
      name: "Prone",
      description: "While you have the Prone condition, you experience the following effects.\n\n**Speed 0.** Your Speed is 0.",
    });
    const map = buildConditionEntityMap(buildMockRegistry([entity]));
    expect(conditionTooltipParagraph(map.get("prone")))
      .toBe("While you have the Prone condition, you experience the following effects.");
  });

  it("keeps a multi-LINE first paragraph whole (the 2014 bullet shape)", () => {
    const entity = conditionEntry({
      slug: "srd-5e_condition_blinded",
      name: "Blinded",
      description: "- A blinded creature can't see.\n- Attack rolls against the creature have advantage.\n\nSecond para.",
    });
    const map = buildConditionEntityMap(buildMockRegistry([entity]));
    expect(conditionTooltipParagraph(map.get("blinded")))
      .toBe("- A blinded creature can't see.\n- Attack rolls against the creature have advantage.");
  });

  it("returns \"\" for an unresolved entity, an empty description, or a non-string one", () => {
    expect(conditionTooltipParagraph(undefined)).toBe("");
    const empty = buildConditionEntityMap(
      buildMockRegistry([conditionEntry({ slug: "x_condition_prone", name: "Prone", description: "" })]),
    );
    expect(conditionTooltipParagraph(empty.get("prone"))).toBe("");
    const nonString = buildConditionEntityMap(
      buildMockRegistry([
        { slug: "x_condition_stunned", name: "Stunned", entityType: "condition", data: { description: 42 } },
      ]),
    );
    expect(conditionTooltipParagraph(nonString.get("stunned"))).toBe("");
  });
});
