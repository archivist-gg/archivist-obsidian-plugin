/** @vitest-environment jsdom */
/**
 * R4-G2 Task 7 · spec §2.1 / §11 floor 3.
 *
 * The spell edit view used to build its serialization object TWICE (a
 * `buildClean()` closure and an inline duplicate in `saveAndExit()`), each
 * copying 12 fields and silently dropping five DECLARED `Spell` fields
 * (`damage`, `saving_throw`, `casting_options`, `source`, `edition`) on every
 * user save. One shared `buildSpellYamlObject` now serves both call sites and
 * preserves every declared field.
 *
 * Assertions are exact-object (`toStrictEqual`) rather than presence checks on
 * purpose: vitest's `toEqual` treats `{k: undefined}` as equal to `{}`, so an
 * unguarded `clean.k = draft.k` mutant that writes `undefined` keys would slip
 * through the absent-optionals and falsy tests. `toStrictEqual` fails on an
 * `undefined`-valued key, so it kills that mutant.
 */
import { describe, it, expect } from "vitest";
import { buildSpellYamlObject } from "../packages/obsidian/src/modules/spell/spell.edit-render";
import type { Spell } from "@archivist-gg/dnd5e/spell/spell.types";

/** Every declared `Spell` field, all populated TRUTHY. */
const FULL_SPELL: Spell = {
  name: "Fireball",
  level: 3,
  school: "Evocation",
  casting_time: "1 action",
  range: "150 feet",
  components: "V, S, M",
  duration: "Instantaneous",
  concentration: true,
  ritual: true,
  classes: ["Sorcerer", "Wizard"],
  description: "A bright streak flashes from your pointing finger.",
  at_higher_levels: ["The damage increases by 1d6 for each slot above 3rd."],
  damage: { types: ["fire"] },
  saving_throw: { ability: "dex" },
  casting_options: [{ type: "higher_level", damage_roll: "8d6" }],
  rendering_hint: "compact",
  misc_tags: ["AAD", "SGT"],
  area_tags: ["S"],
  condition_inflict: ["prone"],
  affects_creature_type: ["undead"],
  spell_attack: "ranged",
  ability_check: ["dex"],
  damage_resist: ["fire"],
  damage_immune: ["cold"],
  condition_immune: ["charmed"],
  damage_vulnerable: ["thunder"],
  has_fluff: true,
  image: "spells/fireball.webp",
  has_fluff_images: true,
  source: "SRD 5e",
  edition: "2014",
};

/** The emission order the builder writes (`yaml.dump(..., {sortKeys:false})`
 *  makes insertion order user-visible in the saved block): the 12 historic
 *  fields in their existing order, then the five restored fields, then the
 *  fourteen §2 keys in spec-table order. */
const FULL_KEY_ORDER = [
  "name", "level", "school", "casting_time", "range", "components", "duration",
  "concentration", "ritual", "description", "at_higher_levels", "classes",
  "damage", "saving_throw", "casting_options", "source", "edition",
  "rendering_hint", "misc_tags", "area_tags", "condition_inflict",
  "affects_creature_type", "spell_attack", "ability_check", "damage_resist",
  "damage_immune", "condition_immune", "damage_vulnerable", "has_fluff",
  "image", "has_fluff_images",
];

describe("buildSpellYamlObject (spell edit-writer, spec §2.1)", () => {
  it("preserves EVERY declared Spell field when all are populated truthy, source/edition INCLUDED", () => {
    const out = buildSpellYamlObject(FULL_SPELL);

    // Exact object: key set AND values, no extra key, no undefined-valued key.
    expect(out).toStrictEqual({
      name: "Fireball",
      level: 3,
      school: "Evocation",
      casting_time: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      concentration: true,
      ritual: true,
      description: "A bright streak flashes from your pointing finger.",
      at_higher_levels: ["The damage increases by 1d6 for each slot above 3rd."],
      classes: ["Sorcerer", "Wizard"],
      damage: { types: ["fire"] },
      saving_throw: { ability: "dex" },
      casting_options: [{ type: "higher_level", damage_roll: "8d6" }],
      source: "SRD 5e",
      edition: "2014",
      rendering_hint: "compact",
      misc_tags: ["AAD", "SGT"],
      area_tags: ["S"],
      condition_inflict: ["prone"],
      affects_creature_type: ["undead"],
      spell_attack: "ranged",
      ability_check: ["dex"],
      damage_resist: ["fire"],
      damage_immune: ["cold"],
      condition_immune: ["charmed"],
      damage_vulnerable: ["thunder"],
      has_fluff: true,
      image: "spells/fireball.webp",
      has_fluff_images: true,
    });

    // The populated key set is exactly the declared key set (nothing dropped).
    expect(Object.keys(out).sort()).toStrictEqual(Object.keys(FULL_SPELL).sort());
    // The five fields the old duplicate builders dropped on every save.
    expect(Object.keys(out)).toEqual(
      expect.arrayContaining(["damage", "saving_throw", "casting_options", "source", "edition"]),
    );
    // Emission order is user-visible in the saved YAML block.
    expect(Object.keys(out)).toStrictEqual(FULL_KEY_ORDER);
  });

  it("leaves absent optionals absent — no undefined-valued keys", () => {
    const out = buildSpellYamlObject({ name: "Prestidigitation" });

    expect(out).toStrictEqual({ name: "Prestidigitation" });
    expect(Object.keys(out)).toStrictEqual(["name"]);
  });

  it("FALSY DISCRIMINATOR: today's truthiness guards are pinned, the new !=null guards are not", () => {
    const out = buildSpellYamlObject({
      name: "Mage Hand",
      // Historic fields, falsy: today's guards keep every one of these ABSENT.
      concentration: false,
      ritual: false,
      description: "",
      classes: [],
      at_higher_levels: [],
      school: "",
      casting_time: "",
      range: "",
      components: "",
      duration: "",
      // A falsy value the historic guards DO emit (the `=== 0` literal write).
      level: 0,
      // New field on a `!= null` guard: the empty string MUST survive
      // (all 1,048 converter values are '').
      rendering_hint: "",
    });

    expect(out).toStrictEqual({ name: "Mage Hand", level: 0, rendering_hint: "" });
    expect(Object.keys(out)).toStrictEqual(["name", "level", "rendering_hint"]);
  });

  it("FALSY DISCRIMINATOR (new keys): falsy-but-present new values all survive the !=null guards", () => {
    const out = buildSpellYamlObject({
      name: "Guidance",
      misc_tags: [],
      has_fluff: false,
      has_fluff_images: false,
      image: "",
      source: "",
      edition: "",
    });

    expect(out).toStrictEqual({
      name: "Guidance",
      source: "",
      edition: "",
      misc_tags: [],
      has_fluff: false,
      image: "",
      has_fluff_images: false,
    });
  });
});
