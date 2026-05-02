/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { renderMonsterBlock } from "../src/modules/monster/monster.renderer";
import type { Monster } from "../src/modules/monster/monster.types";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

beforeEach(() => {
  document.body.replaceChildren();
});

describe("Monster renderer with structured attacks", () => {
  it("renders attack roll bonus, reach, and damage when Feature.attacks is present (melee)", () => {
    const root = mountContainer();
    const monster: Monster = {
      name: "Aboleth",
      actions: [
        {
          name: "Tail",
          attacks: [
            {
              name: "Tail attack",
              type: "melee",
              bonus: 9,
              damage: "3d6+5",
              damage_type: "bludgeoning",
              range: { reach: 10 },
            },
          ],
        },
      ],
    };
    const wrapper = renderMonsterBlock(monster);
    root.appendChild(wrapper);
    const text = root.textContent ?? "";
    expect(text).toContain("+9");
    expect(text).toContain("to hit");
    expect(text).toContain("reach 10 ft.");
    expect(text).toContain("3d6+5");
    expect(text).toContain("bludgeoning");
    expect(text).toContain("Hit:");
  });

  it("renders range for ranged attacks", () => {
    const root = mountContainer();
    const monster: Monster = {
      name: "Archer",
      actions: [
        {
          name: "Longbow",
          attacks: [
            {
              name: "Longbow attack",
              type: "ranged",
              bonus: 5,
              damage: "1d8+3",
              damage_type: "piercing",
              range: { normal: 150, long: 600 },
            },
          ],
        },
      ],
    };
    const wrapper = renderMonsterBlock(monster);
    root.appendChild(wrapper);
    const text = root.textContent ?? "";
    expect(text).toContain("+5");
    expect(text).toContain("range 150/600 ft.");
    expect(text).toContain("1d8+3");
    expect(text).toContain("piercing");
  });

  it("renders extra_damage when present", () => {
    const root = mountContainer();
    const monster: Monster = {
      name: "Fire Snake",
      actions: [
        {
          name: "Bite",
          attacks: [
            {
              name: "Bite",
              type: "melee",
              bonus: 4,
              damage: "1d4+2",
              damage_type: "piercing",
              extra_damage: { dice: "1d6", type: "fire" },
              range: { reach: 5 },
            },
          ],
        },
      ],
    };
    const wrapper = renderMonsterBlock(monster);
    root.appendChild(wrapper);
    const text = root.textContent ?? "";
    expect(text).toContain("plus");
    expect(text).toContain("1d6");
    expect(text).toContain("fire");
  });

  it("falls back to entries[] prose when attacks absent", () => {
    const root = mountContainer();
    const monster: Monster = {
      name: "Goblin",
      actions: [
        {
          name: "Scimitar",
          entries: [
            "Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6+2) slashing damage.",
          ],
        },
      ],
    };
    const wrapper = renderMonsterBlock(monster);
    root.appendChild(wrapper);
    const text = root.textContent ?? "";
    expect(text).toContain("Melee Weapon Attack");
  });

  it("prefers entries prose over structured attacks when both present", () => {
    const root = mountContainer();
    const monster: Monster = {
      name: "Adult Black Dragon",
      actions: [
        {
          name: "Rend",
          entries: ["Custom prose."],
          attacks: [
            {
              name: "Rend attack",
              type: "melee",
              bonus: 9,
              damage: "2d6+5",
              damage_type: "slashing",
              range: { reach: 10 },
            },
          ],
        },
      ],
    };
    const wrapper = renderMonsterBlock(monster);
    root.appendChild(wrapper);
    const text = root.textContent ?? "";
    expect(text).toContain("Custom prose");
    expect(text).not.toContain("+9 to hit");
  });
});
