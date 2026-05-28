/** @vitest-environment jsdom */

import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { renderClassStub } from "../src/modules/class/class.renderer";
import type { ClassEntity } from "../src/modules/class/class.types";

beforeAll(() => installObsidianDomHelpers());

const wizard: ClassEntity = {
  name: "Wizard",
  description: "A scholarly magic-user.",
  hit_die: "d6",
  primary_abilities: ["int"],
  saving_throws: ["int", "wis"],
  proficiencies: { armor: [], weapons: [], tools: [], skills_count: 2, skill_choices: [] },
  starting_equipment: [],
  spellcasting: undefined,
  subclass_level: 2,
  subclass_feature_name: "Arcane Tradition",
  weapon_mastery: undefined,
  table: {
    1: { level: 1, proficiency_bonus: "+2", features: ["Spellcasting", "Arcane Recovery"], columns: { cantrips_known: "3", "1st_slots": "2" } },
    2: { level: 2, proficiency_bonus: "+2", features: ["Arcane Tradition"], columns: { cantrips_known: "3", "1st_slots": "3" } },
    3: { level: 3, proficiency_bonus: "+2", features: [], columns: { cantrips_known: "3", "1st_slots": "4", "2nd_slots": "2" } },
    4: { level: 4, proficiency_bonus: "+2", features: ["ASI"], columns: { cantrips_known: "4", "1st_slots": "4", "2nd_slots": "3" } },
    5: { level: 5, proficiency_bonus: "+3", features: [], columns: { cantrips_known: "4", "1st_slots": "4", "2nd_slots": "3", "3rd_slots": "2" } },
  } as unknown as ClassEntity["table"],
  features_by_level: {},
};

describe("renderClassStub — full progression block", () => {
  it("renders an .archivist-class-block wrapper", () => {
    const parent = document.createElement("div");
    renderClassStub(parent, wizard, {} as never);
    expect(parent.querySelector(".archivist-class-block")).not.toBeNull();
  });

  it("renders the progression table with one row per level", () => {
    const parent = document.createElement("div");
    renderClassStub(parent, wizard, {} as never);
    const t = parent.querySelector("table.archivist-table");
    expect(t).not.toBeNull();
    expect(t?.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("first column shows level (1, 2, 3, 4, 5)", () => {
    const parent = document.createElement("div");
    renderClassStub(parent, wizard, {} as never);
    const cells = Array.from(parent.querySelectorAll("table.archivist-table tbody tr td:first-child"));
    expect(cells.map(c => c.textContent)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("level-4 features cell reads 'ASI'", () => {
    const parent = document.createElement("div");
    renderClassStub(parent, wizard, {} as never);
    const rows = Array.from(parent.querySelectorAll("table.archivist-table tbody tr"));
    const lvl4 = rows[3];
    expect(lvl4.textContent ?? "").toContain("ASI");
  });
});
