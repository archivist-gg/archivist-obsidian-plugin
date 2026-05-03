/** @vitest-environment jsdom */

import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { renderItemMechanicalSummary } from "../src/modules/item/item.renderer";
import type { ItemEntity } from "../src/modules/item/item.types";

beforeAll(() => installObsidianDomHelpers());

function makeItem(overrides: Partial<ItemEntity>): ItemEntity {
  return { name: "Test", ...overrides } as ItemEntity;
}

describe("renderItemMechanicalSummary", () => {
  it("renders flat AC bonus without marker", () => {
    const el = renderItemMechanicalSummary(makeItem({ bonuses: { ac: 1 } }));
    expect(el?.outerHTML ?? "").toContain("AC +1");
    expect(el?.outerHTML ?? "").not.toContain("*");
  });

  it("renders conditional AC bonus with star marker", () => {
    const el = renderItemMechanicalSummary(
      makeItem({ bonuses: { ac: { value: 2, when: [{ kind: "no_armor" }] } } }),
    );
    expect(el?.outerHTML ?? "").toContain("AC +2*");
  });

  it("renders mixed bonuses with markers per field", () => {
    const el = renderItemMechanicalSummary(
      makeItem({
        bonuses: {
          ac: 1,
          weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] },
        },
      }),
    );
    const html = el?.outerHTML ?? "";
    expect(html).toContain("AC +1");
    expect(html).toContain("Dmg +2*");
  });

  it("renders conditional speed bonus with marker", () => {
    const el = renderItemMechanicalSummary(
      makeItem({
        bonuses: {
          speed: { swim: { value: 60, when: [{ kind: "underwater" }] } },
        },
      }),
    );
    expect(el?.outerHTML ?? "").toContain("swim 60 ft*");
  });
});
