import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import yaml from "js-yaml";
import { parseContainer } from "@archivist-gg/core";
import { monsterCodec } from "@archivist-gg/dnd5e";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { monsterToEditable, editableToMonster } from "../packages/obsidian/src/modules/monster/monster.edit-state";
import { editableToYaml } from "../packages/obsidian/src/modules/monster/monster.yaml-serializer";

/** R4-G6 §9 · the edit round trip is LOSSLESS for every key the editor does not manage (invariant 7, `toEqual`). */
const ROOT = process.env.G6_CONVERTER_ROOT ?? "/Users/shinoobi/w/archivist-import-5etools/output";
const NOTES = [
  "Fizban's Treasury of Dragons/Monsters/Aspect of Tiamat.md",           // cr "30" (string)
  "Monster Manual (2014)/Monsters/Archmage.md",                          // cr "12" (string)
  "Monster Manual (2025)/Monsters/Animal Lord; Hunter.md",               // cr "20" (string)
  "Astarion's Book of Hungers/Monsters/Vampire Infernalist.md",          // cr { cr: "14", xp_lair: 13000 } (OBJECT: spec §12.6 / C5-I-1)
];
const RECOMPUTED = new Set(["saves", "skills", "senses", "passive_perception"]);

function load(rel: string): Monster {
  const doc = parseContainer(readFileSync(`${ROOT}/${rel}`, "utf8"));
  if (!doc.success) throw new Error(rel);
  const r = monsterCodec.parse(doc.data);
  if (!r.success) throw new Error(`${rel}: ${r.error}`);
  return r.data as Monster;
}
function unmanaged(m: Monster): Record<string, unknown> {
  return Object.fromEntries(Object.entries(m).filter(([k, v]) => !RECOMPUTED.has(k) && v !== undefined));
}

describe("editableToMonster(monsterToEditable(m)) keeps every unmanaged key", () => {
  it("the converter root exists", () => { expect(existsSync(ROOT), ROOT).toBe(true); });
  for (const rel of NOTES) {
    it(`round-trips ${rel}`, () => {
      const m = load(rel);
      const back = editableToMonster(monsterToEditable(m));
      expect(unmanaged(back)).toEqual(unmanaged(m));
      const reparsed = yaml.load(editableToYaml(monsterToEditable(m))) as Monster;
      expect(unmanaged(reparsed)).toEqual(unmanaged(m));
    });
  }
  it("never emits the edit-state's own fields, and keeps raw.xp", () => {
    const m = { name: "X", raw: { xp: 50 } } as Monster;
    const out = yaml.load(editableToYaml(monsterToEditable(m))) as Record<string, unknown>;
    for (const k of ["overrides", "saveProficiencies", "skillProficiencies", "activeSenses", "customSenses", "activeSections", "xp", "proficiencyBonus", "extras"]) expect(out[k], k).toBeUndefined();
    expect(out.raw).toEqual({ xp: 50 });
  });
  it("Archmage keeps spellcasting; Animal Lord keeps bonus_actions", () => {
    expect((editableToMonster(monsterToEditable(load(NOTES[1]))).spellcasting ?? []).length).toBeGreaterThan(0);
    expect((editableToMonster(monsterToEditable(load(NOTES[2]))).bonus_actions ?? []).length).toBeGreaterThan(0);
  });
  it("Vampire Infernalist's OBJECT cr survives the round trip (the editable's cr FIELD is never narrowed)", () => {
    expect(editableToMonster(monsterToEditable(load(NOTES[3]))).cr).toEqual({ cr: "14", xp_lair: 13000 });
  });
});
