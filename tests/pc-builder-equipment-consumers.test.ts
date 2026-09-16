/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderProfsEquipment } from "../packages/obsidian/src/modules/pc/components/builder/class-chronicle";

beforeAll(() => installObsidianDomHelpers());

describe("class chronicle equipment fold (structured)", () => {
  it("renders each choice option label as a badged eqopt row", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [{ kind: "choice", options: [
        { label: "Chain Mail, Greatsword", grants: [] },
        { label: "Studded Leather, Longbow", grants: [] },
      ] }],
    } as never);
    const rows = c.querySelectorAll(".pc-cb-eqopt");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Chain Mail");
  });

  it("renders a fixed entry's label (or its grants) as the Equipment prop", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [
        { kind: "fixed", grants: [{ item: "leather-armor" }, { item: "dagger", qty: 2 }] },
      ],
    } as never);
    const equipProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Equipment")!;
    expect(equipProp).toBeTruthy();
    expect(equipProp.textContent).toContain("Leather Armor");
    expect(equipProp.textContent).toContain("Dagger ×2");
  });

  it("renders NO Equipment prop for a fixed entry with no label and empty grants", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [{ kind: "fixed", grants: [] }],
    } as never);
    const equipProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Equipment");
    expect(equipProp).toBeUndefined();
  });

  it("renders a gold entry as the Gold prop", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [{ kind: "gold", amount: 90 }],
    } as never);
    const goldProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Gold")!;
    expect(goldProp).toBeTruthy();
    expect(goldProp.textContent).toContain("90 GP");
  });
});

// R4-G7 T8 RIDER-30 (F-HUMAN in the builder preview; wave B review Important 1): the class preview's proficiency props print
// each value through dnd5e's `proficiencyLabel`, the ONE rule the sheet's proficiency rail uses since RIDER-14. Authored prose
// (a value with a space AND an uppercase letter) prints as authored; a slug or an all-lowercase phrase keeps the title case.
// Before, the builder title-cased B001-D3's "Martial weapons that have the Light property" word by word while the sheet did not.
describe("class chronicle proficiency props (RIDER-30)", () => {
  const propValue = (c: HTMLElement, label: string): string | undefined =>
    Array.from(c.querySelectorAll(".pc-cb-prop"))
      .find((p) => p.querySelector(".pc-cb-prop-l")?.textContent === label)
      ?.querySelector("span:not(.pc-cb-prop-l)")?.textContent ?? undefined;

  it("prints authored weapon prose as authored and keeps slug and lowercase values title-cased", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      proficiencies: { weapons: { categories: ["simple"], fixed: ["Martial weapons that have the Light property", "hand crossbows"] }, armor: [] },
    } as never);
    expect(propValue(c, "Weapons")).toBe("Simple, Martial weapons that have the Light property, Hand Crossbows");
  });

  it("prints authored armor prose as authored beside a slug", () => {
    const c = mountContainer();
    renderProfsEquipment(c, { proficiencies: { armor: ["light", "Medium armor"] } } as never);
    expect(propValue(c, "Armor")).toBe("Light, Medium armor");
  });

  it("prints the Bladesinger's 2H / H prose as authored, every word's case untouched", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      proficiencies: { weapons: { fixed: ["Melee Martial weapons that don't have the 2H or H property"] } },
    } as never);
    expect(propValue(c, "Weapons")).toBe("Melee Martial weapons that don't have the 2H or H property");
  });
});
