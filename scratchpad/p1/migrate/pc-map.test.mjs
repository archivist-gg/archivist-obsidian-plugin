import { test } from "node:test";
import assert from "node:assert";
import {
  registerEntity,
  contextFor,
  resolveRef,
  slugShaped,
  extractCore,
  splitKeyValue,
  migratePcContent,
  migrateNoteRefs,
} from "./migrate-pc-and-notes.mjs";

// ---------------------------------------------------------------------------
// Synthetic lookup universe. Hermetic on purpose: the dead-ref semantics test
// (srd-2024_ring-of-evasion) must exercise the resolver's "no same-prefix
// match -> leave" path regardless of what the live regenerated bundle happens
// to contain. Each entity is registered from its (migrated) frontmatter slug.
// ---------------------------------------------------------------------------
function mkUniverse(entities) {
  const u = {
    knownPrefixes: new Set(),
    compendiums: new Set(),
    byPrefixNameType: new Map(),
    byPrefixName: new Map(),
    byNameType: new Map(),
    stats: { bundle: 0, homebrew: 0 },
  };
  for (const e of entities) registerEntity(u, e);
  return u;
}

const U = mkUniverse([
  // SRD 2024 — NOTE: deliberately NO ring-of-evasion under srd-2024.
  { compendium: "SRD 2024", entity_type: "armor", name: "Shield", slug: "srd-2024_armor_shield" },
  { compendium: "SRD 2024", entity_type: "spell", name: "Shield", slug: "srd-2024_spell_shield" },
  { compendium: "SRD 2024", entity_type: "weapon", name: "Greatsword", slug: "srd-2024_weapon_greatsword" },
  { compendium: "SRD 2024", entity_type: "weapon", name: "Longsword", slug: "srd-2024_weapon_longsword" },
  { compendium: "SRD 2024", entity_type: "item", name: "Spell Scroll (3rd Level)", slug: "srd-2024_item_spell-scroll-3rd-level" },
  { compendium: "SRD 2024", entity_type: "spell", name: "Fireball", slug: "srd-2024_spell_fireball" },
  { compendium: "SRD 2024", entity_type: "feat", name: "Ability Score Improvement", slug: "srd-2024_feat_ability-score-improvement" },
  { compendium: "SRD 2024", entity_type: "background", name: "Acolyte", slug: "srd-2024_background_acolyte" },
  { compendium: "SRD 2024", entity_type: "class", name: "Fighter", slug: "srd-2024_class_fighter" },
  { compendium: "SRD 2024", entity_type: "race", name: "Elf", slug: "srd-2024_race_elf" },
  { compendium: "SRD 2024", entity_type: "item", name: "Plate Armor, Armor of Fire Resistance", slug: "srd-2024_item_plate-armor-armor-of-fire-resistance" },
  // SRD 5e
  { compendium: "SRD 5e", entity_type: "item", name: "Plate Armor, Armor of Fire Resistance", slug: "srd-5e_item_plate-armor-armor-of-fire-resistance" },
  { compendium: "SRD 5e", entity_type: "spell", name: "Shield", slug: "srd-5e_spell_shield" },
  { compendium: "SRD 5e", entity_type: "class", name: "Wizard", slug: "srd-5e_class_wizard" },
  // Homebrew
  { compendium: "MCDM", entity_type: "optional-feature", name: "Bedevil", slug: "mcdm_optional-feature_bedevil" },
  { compendium: "MCDM", entity_type: "class", name: "Illrigger", slug: "mcdm_class_illrigger" },
  { compendium: "MCDM", entity_type: "subclass", name: "Hellspeaker", slug: "mcdm_subclass_hellspeaker" },
  { compendium: "Eberron - Forge of the Artificer", entity_type: "race", name: "Kalashtar", slug: "eberron-forge-of-the-artificer_race_kalashtar" },
]);

const T = (arr) => new Set(arr);
const CTX = {
  equip: { kind: "equipment", types: T(["armor", "weapon", "item"]) },
  spell: { kind: "types", types: T(["spell"]) },
  weapon: { kind: "types", types: T(["weapon"]) },
  feat: { kind: "types", types: T(["feat"]) },
  clazz: { kind: "types", types: T(["class"]) },
  boon: { kind: "boon", types: T(["optional-feature"]) },
  dynamic: { kind: "dynamic", types: T(["armor", "weapon", "item", "spell", "monster", "class", "subclass", "background", "race", "feat", "optional-feature", "condition"]) },
};

// --- Shield collision -------------------------------------------------------
test("Shield collision: equipment[].item resolves to the ARMOR", () => {
  assert.equal(resolveRef("srd-2024_shield", CTX.equip, "2024", U).result, "srd-2024_armor_shield");
});
test("Shield collision: spells.known resolves to the SPELL", () => {
  assert.equal(resolveRef("srd-2024_shield", CTX.spell, "2024", U).result, "srd-2024_spell_shield");
  // srd-5e prefix in a spell context stays on its own prefix
  assert.equal(resolveRef("srd-5e_shield", CTX.spell, "2014", U).result, "srd-5e_spell_shield");
});

// --- dead ref (no same-prefix match) ---------------------------------------
test("dead ref: srd-2024_ring-of-evasion with no same-prefix match is LEFT (null)", () => {
  const r = resolveRef("srd-2024_ring-of-evasion", CTX.equip, "2024", U);
  assert.equal(r.result, null);
  assert.equal(r.status, "left-dead");
});

// --- dynamic choice key -----------------------------------------------------
test("dynamic key lies-weapon: srd-2024_greatsword -> weapon", () => {
  assert.equal(contextFor(["class", "choices", "2", "lies-weapon"]).kind, "dynamic");
  assert.equal(resolveRef("srd-2024_greatsword", CTX.dynamic, "2024", U).result, "srd-2024_weapon_greatsword");
});

// --- boon pick --------------------------------------------------------------
test("boon pick bare `bedevil` -> mcdm_optional-feature_bedevil", () => {
  assert.equal(contextFor(["class", "choices", "2", "interdict-boons"]).kind, "boon");
  assert.equal(resolveRef("bedevil", CTX.boon, "2014", U).result, "mcdm_optional-feature_bedevil");
});

// --- non-slug / non-ref values untouched -----------------------------------
test("non-slug and prefix-less non-ref values are never rewritten", () => {
  assert.equal(resolveRef("Traveler pack", CTX.equip, "2024", U).result, null);
  assert.equal(resolveRef("Traveler pack", CTX.equip, "2024", U).status, "skip-nonslug");
  assert.equal(resolveRef("cleric", CTX.spell, "2024", U).result, null); // spell-list value
  assert.equal(resolveRef("wis", CTX.dynamic, "2024", U).result, null); // spellcasting-ability
  assert.equal(resolveRef("deception", CTX.dynamic, "2024", U).result, null); // moloch-skill
  assert.equal(resolveRef("lies", CTX.dynamic, "2024", U).result, null); // combat-mastery
});

// --- prefix-less composite-variant equipment (branch 2) --------------------
test("prefix-less plate-armor-armor-of-fire-resistance, edition 2014 -> srd-5e_item_...", () => {
  const r = resolveRef("plate-armor-armor-of-fire-resistance", CTX.equip, "2014", U);
  assert.equal(r.result, "srd-5e_item_plate-armor-armor-of-fire-resistance");
  assert.equal(r.via, "prefixless-equipment");
});
test("prefix-less composite variant, edition 2024 prefers srd-2024", () => {
  const r = resolveRef("plate-armor-armor-of-fire-resistance", CTX.equip, "2024", U);
  assert.equal(r.result, "srd-2024_item_plate-armor-armor-of-fire-resistance");
});

// --- idempotency ------------------------------------------------------------
test("already-migrated 3-part refs are skipped (idempotent)", () => {
  assert.equal(resolveRef("srd-2024_armor_shield", CTX.equip, "2024", U).status, "skip-migrated");
  assert.equal(resolveRef("mcdm_optional-feature_bedevil", CTX.boon, "2014", U).status, "skip-migrated");
});

// --- context mapping (D7.3 field-context sets) -----------------------------
test("contextFor maps the enumerated ref fields", () => {
  assert.deepEqual(contextFor(["race"]), { kind: "types", types: T(["race"]) });
  assert.deepEqual(contextFor(["subrace"]), { kind: "types", types: T(["race"]) });
  assert.deepEqual(contextFor(["background"]), { kind: "types", types: T(["background"]) });
  assert.deepEqual(contextFor(["class", "name"]), { kind: "types", types: T(["class"]) });
  assert.deepEqual(contextFor(["class", "subclass"]), { kind: "types", types: T(["subclass"]) });
  assert.deepEqual(contextFor(["class", "choices", "1", "weapon-mastery"]), { kind: "types", types: T(["weapon"]) });
  assert.deepEqual(contextFor(["class", "choices", "4", "feat"]), { kind: "types", types: T(["feat"]) });
  assert.deepEqual(contextFor(["spells", "known"]), { kind: "types", types: T(["spell"]) });
  assert.deepEqual(contextFor(["spells", "known", "spell"]), { kind: "types", types: T(["spell"]) });
  assert.deepEqual(contextFor(["spells", "known", "class"]), { kind: "types", types: T(["class"]) });
  assert.equal(contextFor(["equipment", "item"]).kind, "equipment");
  assert.deepEqual(contextFor(["equipment", "overrides", "spell"]), { kind: "types", types: T(["spell"]) });
  assert.deepEqual(contextFor(["origin_choices", "background:feat:mi-cantrips"]), { kind: "types", types: T(["spell"]) });
  assert.deepEqual(contextFor(["origin_choices", "background:feat:mi-level1"]), { kind: "types", types: T(["spell"]) });
  assert.deepEqual(contextFor(["state", "concentration"]), { kind: "types", types: T(["spell"]) });
});
test("contextFor returns null (never touch) for non-ref fields", () => {
  assert.equal(contextFor(["name"]), null);
  assert.equal(contextFor(["edition"]), null);
  assert.equal(contextFor(["class", "choices", "1", "skills"]), null);
  assert.equal(contextFor(["class", "level"]), null);
  assert.equal(contextFor(["spells", "known", "prepared"]), null);
  assert.equal(contextFor(["equipment", "spell_ability"]), null);
  assert.equal(contextFor(["equipment", "overrides", "spell_ability"]), null);
  assert.equal(contextFor(["equipment", "granted_by"]), null);
  assert.equal(contextFor(["state", "feature_uses", "illrigger:seals"]), null);
  assert.equal(contextFor(["state", "conditions"]), null);
  assert.equal(contextFor(["abilities", "str"]), null);
});

// --- low-level helpers ------------------------------------------------------
test("splitKeyValue handles colon-bearing keys", () => {
  assert.deepEqual(splitKeyValue("combat-mastery: lies"), { key: "combat-mastery", value: "lies" });
  assert.deepEqual(splitKeyValue("lies-weapon: srd-2024_longsword"), { key: "lies-weapon", value: "srd-2024_longsword" });
  assert.deepEqual(splitKeyValue("feat:asi:"), { key: "feat:asi", value: "" });
  assert.deepEqual(splitKeyValue("background:feat:spell-list: cleric"), { key: "background:feat:spell-list", value: "cleric" });
  assert.deepEqual(splitKeyValue('"1":'), { key: "1", value: "" });
});
test("extractCore unwraps quotes and wikilinks", () => {
  assert.deepEqual(extractCore('"[[srd-2024_shield]]"'), { core: "srd-2024_shield", wrap: "wikilink" });
  assert.deepEqual(extractCore("srd-2024_longsword"), { core: "srd-2024_longsword", wrap: "bare" });
  assert.equal(extractCore("null").core, "null");
});
test("slugShaped", () => {
  assert.ok(slugShaped("srd-2024_longsword"));
  assert.ok(slugShaped("bedevil"));
  assert.ok(slugShaped("plate-armor-armor-of-fire-resistance"));
  assert.ok(!slugShaped("Traveler pack"));
  assert.ok(!slugShaped("Lawful Good"));
  assert.ok(!slugShaped("builder:starting"));
});

// --- note refs --------------------------------------------------------------
test("{{monster:srd-2024_adult-black-dragon}} -> 3-part", () => {
  const { newContent, changes } = migrateNoteRefs("{{monster:srd-2024_adult-black-dragon}}");
  assert.equal(newContent, "{{monster:srd-2024_monster_adult-black-dragon}}");
  assert.equal(changes[0].to, "{{monster:srd-2024_monster_adult-black-dragon}}");
});
test("note refs: spell/item types + idempotent on 3-part", () => {
  assert.equal(
    migrateNoteRefs("{{spell:srd-2024_fireball}}").newContent,
    "{{spell:srd-2024_spell_fireball}}",
  );
  assert.equal(
    migrateNoteRefs("{{item:srd-5e_flame-tongue-greatsword}}").newContent,
    "{{item:srd-5e_item_flame-tongue-greatsword}}",
  );
  // already 3-part -> unchanged
  const already = "{{monster:srd-2024_monster_adult-black-dragon}}";
  assert.equal(migrateNoteRefs(already).newContent, already);
});

// --- PC identity slug + feature_uses keys untouched (walker integration) ----
const SAMPLE_PC = `---
archivist: true
archivist-type: pc
slug: untitled-character-2
name: Untitled Character 2
compendium: Me
---

\`\`\`pc
name: Ser Baelor Nightwarden
edition: "2014"
race: "[[eberron-forge-of-the-artificer_kalashtar]]"
background: "[[srd-2024_acolyte]]"
class:
  - name: "[[mcdm_illrigger]]"
    level: 10
    subclass: "[[mcdm_hellspeaker]]"
    choices:
      "2":
        combat-mastery: lies
        lies-weapon: srd-2024_longsword
      "4":
        asi-or-feat: feat
        feat: srd-2024_ability-score-improvement
spells:
  known: []
equipment:
  - item: "[[srd-2024_shield]]"
    equipped: false
  - item: "[[plate-armor-armor-of-fire-resistance]]"
    equipped: true
state:
  concentration: null
  feature_uses:
    illrigger:seals:
      used: 0
      max: 5
\`\`\`
`;

test("walker rewrites refs but never the identity slug or feature_uses keys", () => {
  const r = migratePcContent(SAMPLE_PC, U);
  assert.ok(r.changed);
  assert.equal(r.outside.length, 0, "no change may fall outside the pc fence");
  const out = r.newContent;
  // identity frontmatter untouched
  assert.match(out, /^slug: untitled-character-2$/m);
  assert.match(out, /^name: Untitled Character 2$/m);
  // refs rewritten with correct context types
  assert.match(out, /race: "\[\[eberron-forge-of-the-artificer_race_kalashtar\]\]"/);
  assert.match(out, /background: "\[\[srd-2024_background_acolyte\]\]"/);
  assert.match(out, /- name: "\[\[mcdm_class_illrigger\]\]"/);
  assert.match(out, /subclass: "\[\[mcdm_subclass_hellspeaker\]\]"/);
  assert.match(out, /lies-weapon: srd-2024_weapon_longsword/);
  assert.match(out, /feat: srd-2024_feat_ability-score-improvement/);
  assert.match(out, /- item: "\[\[srd-2024_armor_shield\]\]"/); // Shield -> armor
  assert.match(out, /- item: "\[\[srd-5e_item_plate-armor-armor-of-fire-resistance\]\]"/);
  // non-ref choice values untouched
  assert.match(out, /combat-mastery: lies/);
  assert.match(out, /asi-or-feat: feat/);
  // feature_uses key untouched
  assert.match(out, /illrigger:seals:/);
});

test("walker is idempotent: a second pass is a zero-diff no-op", () => {
  const once = migratePcContent(SAMPLE_PC, U).newContent;
  const twice = migratePcContent(once, U);
  assert.equal(twice.changed, false);
  assert.equal(twice.newContent, once);
});
