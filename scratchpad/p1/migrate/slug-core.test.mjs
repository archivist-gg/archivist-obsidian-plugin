import { test } from "node:test";
import assert from "node:assert";
import {
  TYPES,
  slugifyName,
  compendiumPrefix,
  computeNewSlug,
  parseSlug,
  isMigrated,
} from "./slug-core.mjs";

// Reference implementation copied verbatim from the app
// (archivist-dnd5e/src/entities/slug.ts) — computed slugs MUST equal this.
const appSlugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

test("slugifyName is byte-identical to the app slugify", () => {
  const names = [
    "Bedevil",
    "Cloak of the Stalwart Bulwark",
    "Ring of Evasion",
    "Sonya, the Ascendant Stargate", // comma between letters+space
    "Acheron's Chain", // apostrophe
    "Dis's Onslaught",
    "Architect of Ruin",
    "DMG 2024",
    "Eberron - Forge of the Artificer", // existing hyphen + spaces
    "MCDM",
    "Me",
    "Aegis of the Adamant Bulwark",
  ];
  for (const n of names) {
    assert.equal(slugifyName(n), appSlugify(n), `mismatch for "${n}"`);
  }
});

test("slugifyName STRIPS (not hyphenates) inner punctuation", () => {
  // The distinguishing behaviour vs a naive non-alnum->'-' slugifier:
  // a comma/apostrophe between letters is dropped, not turned into a hyphen.
  assert.equal(slugifyName("Sonya, the Ascendant Stargate"), "sonya-the-ascendant-stargate");
  assert.equal(slugifyName("Acheron's Chain"), "acherons-chain");
});

test("compendiumPrefix", () => {
  assert.equal(compendiumPrefix("MCDM"), "mcdm");
  assert.equal(compendiumPrefix("DMG 2024"), "dmg-2024");
  assert.equal(compendiumPrefix("Eberron - Forge of the Artificer"), "eberron-forge-of-the-artificer");
  assert.equal(compendiumPrefix("Me"), "me");
});

test("computeNewSlug from frontmatter", () => {
  assert.equal(
    computeNewSlug({ compendium: "MCDM", entityType: "optional-feature", name: "Bedevil" }),
    "mcdm_optional-feature_bedevil",
  );
  assert.equal(
    computeNewSlug({ compendium: "Me", entityType: "item", name: "Cloak of the Stalwart Bulwark" }),
    "me_item_cloak-of-the-stalwart-bulwark",
  );
  assert.equal(
    computeNewSlug({ compendium: "DMG 2024", entityType: "item", name: "Ring of Evasion" }),
    "dmg-2024_item_ring-of-evasion",
  );
  assert.equal(
    computeNewSlug({ compendium: "MCDM", entityType: "class", name: "Illrigger" }),
    "mcdm_class_illrigger",
  );
  assert.equal(
    computeNewSlug({ compendium: "Eberron - Forge of the Artificer", entityType: "race", name: "Kalashtar" }),
    "eberron-forge-of-the-artificer_race_kalashtar",
  );
  assert.equal(
    computeNewSlug({ compendium: "Me", entityType: "monster", name: "Sonya, the Ascendant Stargate" }),
    "me_monster_sonya-the-ascendant-stargate",
  );
});

test("isMigrated", () => {
  assert.equal(isMigrated("mcdm_optional-feature_bedevil"), true);
  assert.equal(isMigrated("me_item_cloak-of-the-stalwart-bulwark"), true);
  assert.equal(isMigrated("eberron-forge-of-the-artificer_race_kalashtar"), true);
  // legacy / not migrated
  assert.equal(isMigrated("bedevil"), false); // bare
  assert.equal(isMigrated("mcdm_illrigger"), false); // 2-part
  assert.equal(isMigrated("dmg-2024_ring-of-evasion"), false); // 2-part
  assert.equal(isMigrated("eberron-forge-of-the-artificer_illrigger"), false); // 2-part
  assert.equal(isMigrated("sonya-the-ascendant-stargate"), false); // bare
  // a 2-part slug whose tail happens to be a type name is NOT migrated
  assert.equal(isMigrated("foo_item"), false);
});

test("isMigrated is idempotent: computed slugs are already migrated", () => {
  const s = computeNewSlug({ compendium: "MCDM", entityType: "class", name: "Illrigger" });
  assert.equal(isMigrated(s), true);
  // re-computing/checking a migrated slug stays true
  assert.equal(isMigrated(s), true);
});

test("parseSlug", () => {
  const m = parseSlug("mcdm_optional-feature_bedevil");
  assert.deepEqual(m, {
    raw: "mcdm_optional-feature_bedevil",
    parts: ["mcdm", "optional-feature", "bedevil"],
    migrated: true,
    prefix: "mcdm",
    type: "optional-feature",
    name: "bedevil",
  });
  const legacy = parseSlug("mcdm_illrigger");
  assert.equal(legacy.migrated, false);
  assert.equal(legacy.type, null);
  assert.equal(legacy.name, null);
  assert.equal(legacy.prefix, "mcdm");
});

test("TYPES covers the 12 canonical entity types", () => {
  assert.equal(TYPES.length, 12);
  for (const t of ["item", "class", "subclass", "monster", "spell", "background", "race", "optional-feature"]) {
    assert.ok(TYPES.includes(t), `TYPES missing ${t}`);
  }
});
