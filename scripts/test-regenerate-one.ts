// scripts/test-regenerate-one.ts

import * as fs from "fs";
import { convertDescToTags } from "../src/shared/dnd/srd-tag-converter";

const file = process.argv[2] || "/Users/shinoobi/w/archivist/server/data/srd/monsters/knight.json";
const json = JSON.parse(fs.readFileSync(file, "utf-8"));
console.log("Monster:", json.name);
console.log("STR:", json.strength, "DEX:", json.dexterity, "CR:", json.challenge_rating);

const profBonus = (() => {
  const cr = typeof json.challenge_rating === "string" ? Number(json.challenge_rating) : (json.challenge_rating ?? 0);
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  return 6;
})();

const abilities = {
  str: json.strength,
  dex: json.dexterity,
  con: json.constitution,
  int: json.intelligence,
  wis: json.wisdom,
  cha: json.charisma,
};

for (const action of json.actions ?? []) {
  console.log(`\n--- ${action.name} ---`);
  console.log("Original:", action.desc);
  const converted = convertDescToTags(action.desc, {
    abilities,
    profBonus,
    actionName: action.name,
    actionCategory: "action",
  });
  console.log("Converted:", converted);
}
