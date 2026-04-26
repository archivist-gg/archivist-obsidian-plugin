import { describe, it, expect } from "vitest";
import {
  slugify,
  parseSignedInt,
  unwrapDice,
  stripPipeSource,
  buildSlugIndex,
  resolveCopy,
  mapReferenceFields,
  augmentItems,
  type ReferenceItemEntry,
  type OpenItemRecord,
} from "../scripts/augment-srd-magicitems";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("augment-srd-magicitems helpers", () => {
  describe("slugify", () => {
    it("kebab-cases basic names", () => {
      expect(slugify("Bracers of Defense")).toBe("bracers-of-defense");
    });
    it("strips apostrophes and punctuation", () => {
      expect(slugify("Belt of Stone Giant Strength!")).toBe("belt-of-stone-giant-strength");
      expect(slugify("Yael's Whisper")).toBe("yaels-whisper");
    });
    it("collapses repeated whitespace", () => {
      expect(slugify("  Bag   of   Holding  ")).toBe("bag-of-holding");
    });
  });

  describe("parseSignedInt", () => {
    it("parses +N and -N strings", () => {
      expect(parseSignedInt("+2")).toBe(2);
      expect(parseSignedInt("-1")).toBe(-1);
      expect(parseSignedInt("3")).toBe(3);
    });
    it("returns undefined for non-matching strings", () => {
      expect(parseSignedInt("invalid")).toBeUndefined();
      expect(parseSignedInt("+1 (lawful good only)")).toBeUndefined();
      expect(parseSignedInt("")).toBeUndefined();
      expect(parseSignedInt(undefined)).toBeUndefined();
    });
    it("passes through integer numbers", () => {
      expect(parseSignedInt(2)).toBe(2);
      expect(parseSignedInt(0)).toBe(0);
    });
  });

  describe("unwrapDice", () => {
    it("strips template tag wrapper", () => {
      expect(unwrapDice("{@dice 1d6 + 1}")).toBe("1d6 + 1");
      expect(unwrapDice("{@dice 1d20}")).toBe("1d20");
    });
    it("returns plain dice strings unchanged", () => {
      expect(unwrapDice("1d4")).toBe("1d4");
    });
    it("returns undefined for non-strings", () => {
      expect(unwrapDice(undefined)).toBeUndefined();
      expect(unwrapDice("")).toBeUndefined();
    });
  });

  describe("stripPipeSource", () => {
    it("drops the pipe-coded source suffix", () => {
      expect(stripPipeSource("Dagger|PHB")).toBe("Dagger");
      expect(stripPipeSource("Wizard|TCE")).toBe("Wizard");
    });
    it("returns the input untouched when no pipe", () => {
      expect(stripPipeSource("Dagger")).toBe("Dagger");
    });
  });
});

// ---------------------------------------------------------------------------
// Slug index + _copy resolution
// ---------------------------------------------------------------------------

describe("buildSlugIndex", () => {
  it("indexes entries by slug, preferring SRD-flagged on collision", () => {
    const entries: ReferenceItemEntry[] = [
      { name: "Foo", source: "X", srd: false },
      { name: "Foo", source: "Y", srd: true },
    ];
    const index = buildSlugIndex(entries);
    expect(index.get("foo")?.source).toBe("Y");
  });

  it("prefers concrete (no _copy) over a _copy stub when SRD-equal", () => {
    const entries: ReferenceItemEntry[] = [
      { name: "Bar", srd: true, _copy: { name: "Other" } },
      { name: "Bar", srd: true, bonusAc: "+1" },
    ];
    const index = buildSlugIndex(entries);
    expect(index.get("bar")?.bonusAc).toBe("+1");
  });
});

describe("resolveCopy", () => {
  it("merges parent fields with child overriding", () => {
    const parent: ReferenceItemEntry = { name: "Parent", bonusAc: "+1", resist: ["fire"] };
    const child: ReferenceItemEntry = {
      name: "Child",
      _copy: { name: "Parent" },
      bonusAc: "+2",
    };
    const index = buildSlugIndex([parent, child]);
    const resolved = resolveCopy(child, index);
    expect(resolved.bonusAc).toBe("+2");
    expect(resolved.resist).toEqual(["fire"]);
    expect(resolved._copy).toBeUndefined();
  });

  it("returns the entry unchanged when no _copy and strips _copy from non-resolvable", () => {
    const entry: ReferenceItemEntry = { name: "Lone", bonusAc: "+1" };
    const resolved = resolveCopy(entry, new Map());
    expect(resolved.bonusAc).toBe("+1");
  });

  it("handles two-level _copy chains", () => {
    const grand: ReferenceItemEntry = { name: "Grand", bonusAc: "+1", resist: ["cold"] };
    const parent: ReferenceItemEntry = { name: "Parent", _copy: { name: "Grand" }, immune: ["fire"] };
    const child: ReferenceItemEntry = { name: "Child", _copy: { name: "Parent" } };
    const index = buildSlugIndex([grand, parent, child]);
    const resolved = resolveCopy(child, index);
    expect(resolved.bonusAc).toBe("+1");
    expect(resolved.resist).toEqual(["cold"]);
    expect(resolved.immune).toEqual(["fire"]);
  });

  it("bounds recursion depth", () => {
    const cyclic: ReferenceItemEntry = { name: "A", _copy: { name: "A" } };
    const index = buildSlugIndex([cyclic]);
    // Should not infinite-loop — returns a value within depth limit.
    expect(() => resolveCopy(cyclic, index)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// mapReferenceFields
// ---------------------------------------------------------------------------

describe("mapReferenceFields", () => {
  it("maps bonusAc to bonuses.ac", () => {
    const out = mapReferenceFields({ name: "X", bonusAc: "+2" } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ ac: 2 });
  });

  it("maps bonusSavingThrow alongside bonusAc", () => {
    const out = mapReferenceFields({
      name: "X",
      bonusAc: "+1",
      bonusSavingThrow: "+1",
    } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ ac: 1, saving_throws: 1 });
  });

  it("maps bonusWeapon to BOTH attack and damage", () => {
    const out = mapReferenceFields({ name: "X", bonusWeapon: "+1" } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ weapon_attack: 1, weapon_damage: 1 });
  });

  it("prefers explicit bonusWeaponAttack/bonusWeaponDamage over bonusWeapon", () => {
    const out = mapReferenceFields({
      name: "X",
      bonusWeapon: "+1",
      bonusWeaponAttack: "+2",
    } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ weapon_attack: 2, weapon_damage: 1 });
  });

  it("warns and skips unparseable bonus strings", () => {
    const warnings: string[] = [];
    const out = mapReferenceFields(
      { name: "X", bonusWeapon: "+1 (lawful good only)" } as ReferenceItemEntry,
      warnings,
    );
    expect(out.bonuses).toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("maps spell bonuses", () => {
    const out = mapReferenceFields({
      name: "X",
      bonusSpellAttack: "+2",
      bonusSpellSaveDc: "+2",
    } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ spell_attack: 2, spell_save_dc: 2 });
  });

  it("maps ability.static into bonuses.ability_scores.static", () => {
    const out = mapReferenceFields({
      name: "Belt",
      ability: { static: { str: 21 } },
    } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ ability_scores: { static: { str: 21 } } });
  });

  it("maps top-level ability bonuses into bonuses.ability_scores.bonus", () => {
    const out = mapReferenceFields({
      name: "Belt",
      ability: { con: 2 },
    } as ReferenceItemEntry);
    expect(out.bonuses).toEqual({ ability_scores: { bonus: { con: 2 } } });
  });

  it("maps resist/immune/vulnerable/condition_immune (camel -> snake)", () => {
    const out = mapReferenceFields({
      name: "X",
      resist: ["cold"],
      immune: ["fire"],
      vulnerable: ["thunder"],
      conditionImmune: ["charmed"],
    } as ReferenceItemEntry);
    expect(out.resist).toEqual(["cold"]);
    expect(out.immune).toEqual(["fire"]);
    expect(out.vulnerable).toEqual(["thunder"]);
    expect(out.condition_immune).toEqual(["charmed"]);
  });

  it("maps numeric charges with no recharge to a bare number", () => {
    const out = mapReferenceFields({ name: "X", charges: 3 } as ReferenceItemEntry);
    expect(out.charges).toBe(3);
  });

  it("expands charges into an object when recharge info is present", () => {
    const out = mapReferenceFields({
      name: "Wand",
      charges: 7,
      recharge: "dawn",
      rechargeAmount: "{@dice 1d6 + 1}",
    } as ReferenceItemEntry);
    expect(out.charges).toEqual({ max: 7, recharge: "dawn", recharge_amount: "1d6 + 1" });
  });

  it("maps attached_spells through with the same shape", () => {
    const out = mapReferenceFields({
      name: "Cape",
      attachedSpells: { daily: { "1": ["dimension door"] } },
    } as ReferenceItemEntry);
    expect(out.attached_spells).toEqual({ daily: { "1": ["dimension door"] } });
  });

  it("emits canonical attunement object form when reqAttune=true", () => {
    const out = mapReferenceFields({ name: "X", reqAttune: true } as ReferenceItemEntry);
    expect(out.attunement).toEqual({ required: true });
  });

  it("emits attunement.restriction when reqAttune is a string", () => {
    const out = mapReferenceFields({
      name: "X",
      reqAttune: "by a sorcerer, warlock, or wizard",
    } as ReferenceItemEntry);
    expect(out.attunement).toEqual({
      required: true,
      restriction: "by a sorcerer, warlock, or wizard",
    });
  });

  it("strips pipe-source from reqAttuneTags class names", () => {
    const out = mapReferenceFields({
      name: "X",
      reqAttune: true,
      reqAttuneTags: [{ class: "wizard|tce" }, { class: "sorcerer" }],
    } as ReferenceItemEntry);
    const att = out.attunement as { required: boolean; tags: { class: string }[] };
    expect(att.tags).toEqual([{ class: "wizard" }, { class: "sorcerer" }]);
  });

  it("maps grantsLanguage / grantsProficiency into grants.*", () => {
    const out = mapReferenceFields({
      name: "X",
      grantsLanguage: true,
      grantsProficiency: true,
    } as ReferenceItemEntry);
    expect(out.grants).toEqual({ languages: true, proficiency: true });
  });

  it("maps tier", () => {
    const out = mapReferenceFields({ name: "X", tier: "major" } as ReferenceItemEntry);
    expect(out.tier).toBe("major");
  });

  it("maps baseItem with pipe-source stripped", () => {
    const out = mapReferenceFields({ name: "X", baseItem: "Dagger|PHB" } as ReferenceItemEntry);
    expect(out.base_item).toBe("Dagger");
  });
});

// ---------------------------------------------------------------------------
// augmentItems (end-to-end, in-memory)
// ---------------------------------------------------------------------------

describe("augmentItems", () => {
  // Open5e-shaped fixture (3 items)
  const openItems: OpenItemRecord[] = [
    {
      name: "Bracers of Defense",
      type: "Wondrous item",
      rarity: "rare",
      desc: "While wearing these bracers, you gain a +2 bonus to AC.",
      requires_attunement: "requires attunement",
    },
    {
      name: "Ring of Protection",
      type: "Ring",
      rarity: "rare",
      desc: "You gain a +1 bonus to AC and saving throws while wearing this ring.",
      requires_attunement: "requires attunement",
    },
    {
      name: "Mystery Item",
      type: "Wondrous item",
      rarity: "uncommon",
      desc: "Nothing matches this in the reference data.",
      requires_attunement: "",
    },
  ];

  // 5 reference entries, including a _copy chain (Cape Awakened -> Cape Dormant)
  const referenceConcrete: ReferenceItemEntry[] = [
    { name: "Bracers of Defense", srd: true, bonusAc: "+2", reqAttune: true, tier: "major" },
    {
      name: "Ring of Protection",
      srd: true,
      bonusAc: "+1",
      bonusSavingThrow: "+1",
      reqAttune: true,
    },
    {
      name: "Belt of Hill Giant Strength",
      srd: true,
      ability: { static: { str: 21 } },
      reqAttune: true,
    },
    {
      name: "Cape Dormant",
      bonusAc: "+1",
      resist: ["fire"],
    },
    {
      name: "Cape Awakened",
      _copy: { name: "Cape Dormant" },
      bonusAc: "+2", // override
    },
  ];

  it("augments matching items with structured fields", () => {
    const { items, augmentedCount } = augmentItems(openItems, referenceConcrete, []);
    expect(augmentedCount).toBe(2);
    const bracers = items.find((i) => i.name === "Bracers of Defense");
    expect(bracers?.bonuses).toEqual({ ac: 2 });
    expect(bracers?.attunement).toEqual({ required: true });
    expect(bracers?.tier).toBe("major");
    const ring = items.find((i) => i.name === "Ring of Protection");
    expect(ring?.bonuses).toEqual({ ac: 1, saving_throws: 1 });
  });

  it("leaves unmatched items completely untouched", () => {
    const { items } = augmentItems(openItems, referenceConcrete, []);
    const mystery = items.find((i) => i.name === "Mystery Item");
    expect(mystery?.bonuses).toBeUndefined();
    expect(mystery?.desc).toBe("Nothing matches this in the reference data.");
  });

  it("preserves existing fields on the open record", () => {
    const { items } = augmentItems(openItems, referenceConcrete, []);
    const bracers = items.find((i) => i.name === "Bracers of Defense");
    expect(bracers?.desc).toBe(
      "While wearing these bracers, you gain a +2 bonus to AC.",
    );
    expect(bracers?.rarity).toBe("rare");
    expect(bracers?.requires_attunement).toBe("requires attunement");
  });

  it("resolves _copy chains during augmentation", () => {
    const open: OpenItemRecord[] = [
      { name: "Cape Awakened", desc: "An awakened cape." },
    ];
    const { items, augmentedCount } = augmentItems(open, referenceConcrete, []);
    expect(augmentedCount).toBe(1);
    const cape = items[0];
    // Override from Awakened wins for bonusAc (+2 -> ac: 2).
    expect(cape.bonuses).toEqual({ ac: 2 });
    // Inherited from Dormant.
    expect(cape.resist).toEqual(["fire"]);
  });

  it("merges base-item entries with concrete entries (concrete preferred)", () => {
    const concrete: ReferenceItemEntry[] = [
      { name: "Foo", srd: true, bonusAc: "+2" },
    ];
    const base: ReferenceItemEntry[] = [
      { name: "Foo", srd: true, bonusAc: "+1" },
    ];
    const open: OpenItemRecord[] = [{ name: "Foo" }];
    const { items } = augmentItems(open, concrete, base);
    expect(items[0].bonuses).toEqual({ ac: 2 });
  });
});
