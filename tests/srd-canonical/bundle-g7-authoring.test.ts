/**
 * R4-G7 T5 · what the ONE SRD regen authored (spec §15 row 15, every clause).
 *
 * Reads the TRACKED `.compendium-bundle/index.json` · the exact bytes esbuild inlines into
 * `main.js` · rather than the loose `.md`, which are gitignored and rebuilt. Every assertion goes
 * through the SHIPPED parser, so a value that reaches the file but not the parsed entity fails here
 * rather than passing on a substring match.
 *
 * The four families this pins, each measured RED against the 0.3.3 bundle before the regen:
 *   1. the typed class mechanics (extra-attack, unarmed-strike, unarmored-ac, speed-bonus), of
 *      which the whole bundle carried ZERO of every kind;
 *   2. the two 2024 name typos (`Unarmoed Movement` 22 sites, `Studdied Attacks` 3) and the
 *      saving-throw pair they ship beside;
 *   3. the monster data floor (the save / skill proficiency predicate, and the four creatures whose
 *      speed the upstream cache leaves empty);
 *   4. the point-pool trackers and the two broken origin-feat links of the T1 harvest.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseClass } from "@archivist-gg/dnd5e/class/class.parser";
import { parseMonster } from "@archivist-gg/dnd5e/monster/monster.parser";
import { parseBackground } from "@archivist-gg/dnd5e/background/background.parser";

/** The tracked bundle, unless a mutation control points this at a scratch one.
 *
 *  G7_BUNDLE_INDEX exists for the §15 controls that have to prove this file's kill power, and the
 *  only honest way to prove it is to re-run the WHOLE generator against a deliberately broken
 *  overlay and measure THIS file against that output. Rewriting the tracked bundle to do so would
 *  make the control itself the accident it is testing for, so the generator is pointed at a temp dir
 *  (CANONICAL_OUT_DIR / RUNTIME_OUT_DIR / BUNDLE_OUT_DIR / OVERLAY_DIR) and this variable follows it.
 *  Unset in every normal run, including CI. */
const BUNDLE_INDEX = process.env.G7_BUNDLE_INDEX
  ? path.resolve(process.env.G7_BUNDLE_INDEX)
  : path.resolve(__dirname, "../../.compendium-bundle/index.json");
const bundle = JSON.parse(fs.readFileSync(BUNDLE_INDEX, "utf-8")) as Record<string, string>;

function body(entryPath: string, lang: string): string {
  const md = bundle[entryPath];
  if (!md) throw new Error(`Bundle entry not found: ${entryPath}`);
  const m = md.match(new RegExp("```" + lang + "\\r?\\n([\\s\\S]*?)\\r?\\n```"));
  if (!m) throw new Error(`No ${lang} codeblock in ${entryPath}`);
  return m[1];
}

interface Effect {
  kind: string;
  count?: number;
  value?: number;
  mode?: string;
  set?: boolean;
  dice?: unknown;
  abilities?: string[];
  allow_shield?: boolean;
  scales_at?: Array<{ level: number; count?: number; value?: number }>;
}
interface ClassFeature { id?: string; name: string; effects?: Effect[]; resources?: Array<Record<string, unknown>> }

function klass(edition: string, name: string): {
  saving_throws: string[];
  features_by_level: Record<string, ClassFeature[]>;
  table: Record<string, { columns?: Record<string, string | number> }>;
} {
  const r = parseClass(body(`${edition}/Classes/${name}.md`, "class"));
  if (!r.success) throw new Error(`parseClass failed for ${edition}/${name}: ${JSON.stringify(r.error).slice(0, 300)}`);
  return r.data as never;
}

/** Every emitted copy of the feature with this id, across every level bucket. */
function featureCopies(
  doc: { features_by_level: Record<string, ClassFeature[]> },
  id: string,
): Array<{ level: string; feature: ClassFeature }> {
  const out: Array<{ level: string; feature: ClassFeature }> = [];
  for (const [level, list] of Object.entries(doc.features_by_level)) {
    for (const feature of list) if (feature.id === id) out.push({ level, feature });
  }
  return out;
}

const EDITIONS = ["SRD 5e", "SRD 2024"];
/** The ten SRD class documents carrying an Extra Attack feature (MEASURED at 0.3.3). */
const EXTRA_ATTACK_CLASSES = ["Barbarian", "Fighter", "Monk", "Paladin", "Ranger"];

describe("R4-G7 T5 · the authored class mechanics (spec §15 row 15)", () => {
  it.each(EDITIONS)("%s Monk: Martial Arts authors the unarmed strike off the class-table column", (ed) => {
    // ONE expect, and it is both the non-vacuity floor and the value assertion: an empty copy list,
    // a copy at the wrong level and a wrong column name each fail this same line. Splitting the
    // floor off into its own earlier `expect` would put a mutant's RED on the second assertion.
    // MEASURED: martial-arts is gained at level 1 only, in both editions.
    expect(featureCopies(klass(ed, "Monk"), "martial-arts").map(({ level, feature }) => [level, feature.effects]))
      .toEqual([["1", [{ kind: "unarmed-strike", dice: { column: "Martial Arts" }, abilities: ["dex"] }]]]);
  });

  it.each(EDITIONS)("%s Monk and Barbarian: Unarmored Defense authors unarmored-ac with its own abilities", (ed) => {
    for (const { feature } of featureCopies(klass(ed, "Monk"), "unarmored-defense")) {
      expect(feature.effects, `${ed} Monk`).toEqual([{ kind: "unarmored-ac", abilities: ["dex", "wis"] }]);
    }
    for (const { feature } of featureCopies(klass(ed, "Barbarian"), "unarmored-defense")) {
      expect(feature.effects, `${ed} Barbarian`).toEqual([
        { kind: "unarmored-ac", abilities: ["dex", "con"], allow_shield: true },
      ]);
    }
    expect(featureCopies(klass(ed, "Monk"), "unarmored-defense").length).toBeGreaterThan(0);
    expect(featureCopies(klass(ed, "Barbarian"), "unarmored-defense").length).toBeGreaterThan(0);
  });

  it.each(EDITIONS)("%s: the Monk's speed bonus scales in four steps and the Barbarian's is flat, both walk-mode", (ed) => {
    // The key spelling holds in BOTH editions: the 2024 upstream name is "Unarmoed Movement", so
    // this id existing at all is the normaliser's output.
    const monk = featureCopies(klass(ed, "Monk"), "unarmored-movement");
    expect(monk.length, `${ed} Monk unarmored-movement copies`).toBeGreaterThan(0);
    for (const { feature } of monk) {
      expect(feature.effects).toEqual([{
        kind: "speed-bonus", mode: "walk", value: 10,
        scales_at: [{ level: 6, value: 15 }, { level: 10, value: 20 }, { level: 14, value: 25 }, { level: 18, value: 30 }],
      }]);
      // No `set` key at all: the bonus is ADDITIVE, not an absolute floor.
      expect(Object.keys(feature.effects![0])).not.toContain("set");
    }
    const barb = featureCopies(klass(ed, "Barbarian"), "fast-movement");
    expect(barb.length, `${ed} Barbarian fast-movement copies`).toBeGreaterThan(0);
    for (const { feature } of barb) {
      expect(feature.effects).toEqual([{ kind: "speed-bonus", mode: "walk", value: 10 }]);
    }
  });

  it.each(EDITIONS)("%s: every Extra Attack feature carries exactly ONE extra-attack effect, identical across its copies", (ed) => {
    for (const name of EXTRA_ATTACK_CLASSES) {
      const copies = featureCopies(klass(ed, name), "extra-attack");
      expect(copies.length, `${ed} ${name} extra-attack copies`).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const { level, feature } of copies) {
        expect(feature.effects, `${ed} ${name} @ ${level}`).toHaveLength(1);
        expect(feature.effects![0].kind).toBe("extra-attack");
        // `count` is EXTRA attacks: 1 is RAW's "attack twice" at level 5.
        expect(feature.effects![0].count, `${ed} ${name} @ ${level} count`).toBe(1);
        seen.add(JSON.stringify(feature.effects));
      }
      // One overlay record is emitted into every bucket, so the copies must be byte-identical.
      expect(seen.size, `${ed} ${name}: copies disagree`).toBe(1);
    }
  });

  it("the SRD 5e Fighter's one Extra Attack feature carries the whole 5 / 11 / 20 progression", () => {
    const copies = featureCopies(klass("SRD 5e", "Fighter"), "extra-attack");
    expect(copies.map((c) => c.level).sort((a, b) => Number(a) - Number(b))).toEqual(["5", "11", "20"]);
    for (const { feature } of copies) {
      expect(feature.effects![0].scales_at).toEqual([{ level: 11, count: 2 }, { level: 20, count: 3 }]);
    }
  });

  it("the SRD 2024 Fighter carries its progression as three separately-named features", () => {
    const fighter = klass("SRD 2024", "Fighter");
    expect(featureCopies(fighter, "extra-attack").map((c) => c.level)).toEqual(["5"]);
    expect(featureCopies(fighter, "extra-attack")[0].feature.effects).toEqual([{ kind: "extra-attack", count: 1 }]);
    const two = featureCopies(fighter, "two-extra-attacks");
    const three = featureCopies(fighter, "three-extra-attacks");
    expect(two.map((c) => c.level)).toEqual(["11"]);
    expect(three.map((c) => c.level)).toEqual(["20"]);
    expect(two[0].feature.effects).toEqual([{ kind: "extra-attack", count: 2 }]);
    expect(three[0].feature.effects).toEqual([{ kind: "extra-attack", count: 3 }]);
  });

  it("the SRD 2024 Fighter saves with STR and CON", () => {
    expect(klass("SRD 2024", "Fighter").saving_throws).toEqual(["str", "con"]);
    // The 5e twin is untouched and already agrees on the pair.
    expect(klass("SRD 5e", "Fighter").saving_throws.slice().sort()).toEqual(["con", "str"]);
  });
});

describe("R4-G7 T5 · the two 2024 name typos are gone from the whole bundle", () => {
  it.each([["unarmoed", 22], ["studdied", 3]])("%s appears 0 times (was %i sites)", (needle) => {
    const hits: string[] = [];
    for (const [entryPath, md] of Object.entries(bundle)) {
      const n = (md.match(new RegExp(needle, "gi")) ?? []).length;
      if (n > 0) hits.push(`${entryPath} x${n}`);
    }
    expect(hits).toEqual([]);
  });

  it("the corrected names reach the feature, the id, the table row and the column label", () => {
    const monk = klass("SRD 2024", "Monk");
    const copies = featureCopies(monk, "unarmored-movement");
    expect(copies.length).toBeGreaterThan(0);
    expect(copies[0].feature.name).toBe("Unarmored Movement");
    expect(Object.keys(monk.table["2"].columns ?? {})).toContain("Unarmored Movement");
    const fighter = klass("SRD 2024", "Fighter");
    expect(featureCopies(fighter, "studied-attacks")[0]?.feature.name).toBe("Studied Attacks");
  });
});

describe("R4-G7 T5 · the point-pool trackers and the origin-feat links (T1 harvest sections 5 and 2)", () => {
  it("the SRD 5e Monk's Ki and Sorcerer's Font of Magic author the pool their class table promises", () => {
    const ki = featureCopies(klass("SRD 5e", "Monk"), "ki")[0]?.feature;
    expect(ki?.resources).toEqual([
      { id: "monk:ki-points", name: "Ki Points", max_formula: "class_level", reset: "short-rest" },
    ]);
    const font = featureCopies(klass("SRD 5e", "Sorcerer"), "font-of-magic")[0]?.feature;
    expect(font?.resources).toEqual([
      { id: "sorcerer:sorcery-points", name: "Sorcery Points", max_formula: "class_level", reset: "long-rest" },
    ]);
  });

  it("the SRD 2024 Fighter's Second Wind scales where its own class table says it does", () => {
    const sw = featureCopies(klass("SRD 2024", "Fighter"), "second-wind")[0]?.feature;
    expect(sw?.resources?.[0].scales_at).toEqual([{ level: 4, max: "3" }, { level: 10, max: "4" }]);
    // The table column is the authority the resource now agrees with.
    const table = klass("SRD 2024", "Fighter").table;
    expect(String(table["4"].columns?.["Second Wind"])).toBe("3");
    expect(String(table["10"].columns?.["Second Wind"])).toBe("4");
  });

  it("every SRD 2024 origin_feat link points at a feat document the bundle ships", () => {
    const missing: string[] = [];
    for (const [entryPath, md] of Object.entries(bundle)) {
      if (!entryPath.startsWith("SRD 2024/Backgrounds/")) continue;
      const r = parseBackground(body(entryPath, "background"));
      if (!r.success) throw new Error(`parseBackground failed for ${entryPath}`);
      const link = (r.data as { origin_feat?: string | null }).origin_feat;
      if (!link) continue;
      const target = `${link.replace(/^\[\[/, "").replace(/\]\]$/, "")}.md`;
      if (!bundle[target]) missing.push(`${entryPath} -> ${target}`);
    }
    expect(missing).toEqual([]);
  });
});

describe("R4-G7 T5 · the SRD monster data floor (spec §8.1 item 4)", () => {
  const ABILITY_OF_SKILL: Record<string, string> = {
    acrobatics: "dex", animal_handling: "wis", arcana: "int", athletics: "str", deception: "cha",
    history: "int", insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis",
    nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int",
    sleight_of_hand: "dex", stealth: "dex", survival: "wis",
  };
  const mod = (score: number): number => Math.floor((score - 10) / 2);

  interface Mon {
    name: string;
    speed?: Record<string, unknown>;
    hp?: { average?: number; formula?: string };
    abilities?: Record<string, number>;
    saves?: Record<string, number>;
    skills?: Record<string, number>;
    subtype?: string;
  }

  const monsters: Array<{ entryPath: string; m: Mon }> = Object.keys(bundle)
    .filter((p) => /^SRD (5e|2024)\/Monsters\/.+\.md$/.test(p))
    .map((entryPath) => {
      const r = parseMonster(body(entryPath, "monster"));
      if (!r.success) throw new Error(`parseMonster failed for ${entryPath}`);
      return { entryPath, m: r.data as unknown as Mon };
    });

  it("reads every SRD monster note (the non-vacuity floor)", () => {
    expect(monsters.length).toBe(656);
  });

  it("no SRD monster carries an empty speed block", () => {
    expect(monsters.filter(({ m }) => Object.keys(m.speed ?? {}).length === 0).map((x) => x.entryPath)).toEqual([]);
  });

  it("every emitted save entry exceeds its plain ability modifier", () => {
    const bad: string[] = [];
    for (const { entryPath, m } of monsters) {
      for (const [ab, bonus] of Object.entries(m.saves ?? {})) {
        const score = m.abilities?.[ab];
        if (score === undefined) continue;
        if (!(bonus > mod(score))) bad.push(`${entryPath}: ${ab} ${bonus} vs mod ${mod(score)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every emitted skill entry exceeds its governing ability modifier", () => {
    const bad: string[] = [];
    for (const { entryPath, m } of monsters) {
      for (const [skill, bonus] of Object.entries(m.skills ?? {})) {
        const ab = ABILITY_OF_SKILL[skill.toLowerCase().replace(/[- ]/g, "_")];
        const score = ab === undefined ? undefined : m.abilities?.[ab];
        if (score === undefined) continue;
        if (!(bonus > mod(score))) bad.push(`${entryPath}: ${skill} ${bonus} vs mod ${mod(score)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the Archmage carries exactly its two proficient saves, and the Donkey none", () => {
    const archmage = monsters.find((x) => x.entryPath === "SRD 5e/Monsters/Archmage.md")!.m;
    expect(Object.keys(archmage.saves ?? {}).sort()).toEqual(["int", "wis"]);
    const donkey = monsters.find((x) => x.entryPath === "SRD 5e/Monsters/Donkey.md")!.m;
    expect(Object.keys(donkey.saves ?? {})).toEqual([]);
    expect(Object.keys(donkey.skills ?? {})).toEqual([]);
  });

  it("the four creatures the cache leaves empty carry their authored SRD 5.1 speed and hit dice", () => {
    const find = (n: string): Mon => monsters.find((x) => x.entryPath === `SRD 5e/Monsters/${n}.md`)!.m;
    expect(find("Donkey").speed).toEqual({ walk: 40 });
    expect(find("Donkey").hp?.formula).toBe("2d8+2");
    expect(find("Elf, Drow").speed).toEqual({ walk: 30 });
    expect(find("Elf, Drow").hp?.formula).toBe("3d8");
    expect(find("Gnome, Deep (Svirfneblin)").speed).toEqual({ walk: 20 });
    expect(find("Gnome, Deep (Svirfneblin)").hp?.formula).toBe("3d6+6");
    // RAW: a Shrieker is a fungus and its speed IS 0 ft. Authored as a measured zero rather than
    // left as "no data"; `formatSpeed` renders both as the same empty string.
    expect(find("Shrieker").speed).toEqual({ walk: 0 });
  });

  /* THE `subtype` DECISION (spec §8.1 item 5), taken at T5 with the count: BOOKED, not rendered.
   *
   * The population is 117 SRD 5e notes and 0 SRD 2024 (MEASURED, pinned below). The spec framed the
   * open half as the RENDERER, which never reads the field. T5 measured the field itself and found
   * the open half is its PROVENANCE: `creature-merge` fills `subtype` from Open5e's `subcategory`,
   * which is a bestiary GROUPING, not a RAW creature subtype. All 24 distinct values are plural,
   * title-cased list headings ("Dragons, Metallic", "Lycanthropes", "Animated Objects",
   * "Half-Dragon Template"), and the notes that DO have a RAW subtype do not carry it: the Goblin,
   * whose RAW line is "Small humanoid (goblinoid)", has no `subtype` at all.
   *
   * So printing it in RAW's `Medium beast (goblinoid)` slot would ship "Huge dragon (Dragons,
   * Metallic)" on 20 documents and still miss every real subtype. The ask that goes to G8 is to
   * re-source the field (or rename it to what it is), and rendering waits on that.
   *
   * This assertion is the booking's EVIDENCE, and it goes red the moment the field's provenance
   * changes · which is exactly when the render decision should be re-opened.
   */
  it("the subtype field is a bestiary grouping on 117 SRD 5e notes and absent from SRD 2024 (booked to G8)", () => {
    const withSubtype = monsters.filter(({ m }) => typeof m.subtype === "string" && m.subtype.length > 0);
    expect(withSubtype.filter((x) => x.entryPath.startsWith("SRD 5e/")).length).toBe(117);
    expect(withSubtype.filter((x) => x.entryPath.startsWith("SRD 2024/")).length).toBe(0);
    const values = [...new Set(withSubtype.map((x) => x.m.subtype!))].sort();
    expect(values).toEqual([
      "Angels", "Animated Objects", "Demons", "Devils", "Dinosaurs", "Dragons, Chromatic",
      "Dragons, Metallic", "Elementals", "Fungi", "Genies", "Ghouls", "Giants", "Golems", "Hags",
      "Half-Dragon Template", "Lycanthropes", "Mephits", "Mummies", "Nagas", "Oozes", "Skeletons",
      "Sphinxes", "Vampires", "Zombies",
    ]);
    // Not one of them is a RAW subtype token, which is what makes the render decision a booking.
    expect(values.filter((v) => /^[a-z]+$/.test(v))).toEqual([]);
  });
});
