import { describe, it, expect } from "vitest";
import { parseClass } from "../src/modules/class/class.parser";

const minimalYaml = `
slug: rogue
name: Rogue
edition: "2014"
source: "SRD 5.1"
description: Stealthy.
hit_die: d8
primary_abilities: [dex]
saving_throws: [dex, int]
proficiencies:
  armor: [light]
  weapons: { fixed: [simple, hand-crossbow, longsword, rapier, shortsword] }
  tools: { fixed: [thieves-tools] }
skill_choices:
  count: 4
  from: [stealth, deception, investigation, sleight-of-hand]
starting_equipment:
  - { kind: fixed, items: [leather-armor] }
spellcasting: null
subclass_level: 3
subclass_feature_name: "Roguish Archetype"
weapon_mastery: null
epic_boon_level: null
table:
  "1": { prof_bonus: 2, feature_ids: [expertise, sneak-attack] }
features_by_level:
  "1":
    - name: Expertise
      description: "Choose two skills."
resources: []
`;

describe("parseClass", () => {
  it("parses a minimal valid class YAML", () => {
    const result = parseClass(minimalYaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("rogue");
      expect(result.data.hit_die).toBe("d8");
    }
  });

  it("returns error on missing required field", () => {
    expect(parseClass(`slug: rogue`).success).toBe(false);
  });

  it("returns error on schema violation", () => {
    expect(parseClass(minimalYaml.replace("hit_die: d8", "hit_die: d4")).success).toBe(false);
  });
});
