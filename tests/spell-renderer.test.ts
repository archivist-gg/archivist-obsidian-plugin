/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { renderSpellBlock } from "../src/modules/spell/spell.renderer";
import type { Spell } from "../src/modules/spell/spell.types";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

beforeEach(() => {
  document.body.replaceChildren();
});

describe("renderSpellBlock with casting_options", () => {
  it("renders a slot-scaling table when casting_options has slot rows", () => {
    const root = mountContainer();
    const spell: Spell = {
      name: "Fireball",
      level: 3,
      school: "evocation",
      casting_options: [
        { type: "slot_level_4", damage_roll: "9d6" },
        { type: "slot_level_5", damage_roll: "10d6" },
      ],
    };
    const wrapper = renderSpellBlock(spell);
    root.appendChild(wrapper);
    expect(root.querySelector(".spell-slot-scaling-table")).toBeTruthy();
    expect(root.textContent).toContain("4th");
    expect(root.textContent).toContain("9d6");
    expect(root.textContent).toContain("5th");
    expect(root.textContent).toContain("10d6");
  });

  it("falls back to at_higher_levels prose when casting_options absent", () => {
    const root = mountContainer();
    const spell: Spell = {
      name: "Cure Wounds",
      level: 1,
      school: "evocation",
      at_higher_levels: [
        "When you cast this spell using a spell slot of 2nd level or higher...",
      ],
    };
    const wrapper = renderSpellBlock(spell);
    root.appendChild(wrapper);
    expect(root.querySelector(".spell-slot-scaling-table")).toBeFalsy();
    expect(root.textContent).toContain("When you cast this spell");
  });

  it("renders slot-scaling table even when damage_roll is missing (target_count-only spells)", () => {
    const root = mountContainer();
    const spell: Spell = {
      name: "Magic Missile",
      level: 1,
      school: "evocation",
      casting_options: [
        { type: "slot_level_2", target_count: 2 },
        { type: "slot_level_3", target_count: 3 },
      ],
    };
    const wrapper = renderSpellBlock(spell);
    root.appendChild(wrapper);
    expect(root.querySelector(".spell-slot-scaling-table")).toBeTruthy();
    expect(root.textContent).toContain("2nd");
    expect(root.textContent).toContain("3rd");
    // Damage cell falls back to em-dash placeholder
    expect(root.textContent).toContain("—");
  });

  it("ignores non-slot casting_options (e.g. player_level_*) and falls back to prose", () => {
    const root = mountContainer();
    const spell: Spell = {
      name: "Acid Splash",
      level: 0,
      school: "conjuration",
      at_higher_levels: [
        "This spell's damage increases by 1d6 when you reach 5th level...",
      ],
      casting_options: [
        { type: "player_level_5", damage_roll: "2d6" },
        { type: "player_level_11", damage_roll: "3d6" },
      ],
    };
    const wrapper = renderSpellBlock(spell);
    root.appendChild(wrapper);
    expect(root.querySelector(".spell-slot-scaling-table")).toBeFalsy();
    expect(root.textContent).toContain("This spell's damage increases");
  });
});
