/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import {
  WeaponsTable,
  renderMasteryTooltip,
} from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithAttacks(attacks: AttackRow[]): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

type Mastery = NonNullable<AttackRow["mastery"]>;

const rowWithMastery = (mastery: Mastery | undefined): AttackRow =>
  ({
    id: "0:standard", name: "Maul", range: "melee 5 ft.", toHit: 6,
    damageDice: "2d6 + 4", damageType: "bludgeoning",
    properties: ["heavy", "two-handed"], proficient: true,
    breakdown: { toHit: [], damage: [] },
    informational: [], slotKey: "mainhand",
    mastery,
  } as unknown as AttackRow);

const topple: Mastery = {
  slug: "topple", label: "Topple",
  description: "On a hit, the target must succeed on a Constitution saving throw or have the Prone condition.",
  derived: { label: "Save DC", value: 15 },
};

describe("WeaponsTable — 2024 weapon mastery chip", () => {
  it("renders a mastery chip + tooltip for a row with mastery", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithAttacks([rowWithMastery(topple)]));

    const chips = root.querySelectorAll(".pc-mastery-tag");
    expect(chips.length).toBe(1);
    const chip = chips[0] as HTMLElement;
    expect(chip.textContent).toContain("Topple");

    // Tooltip renders lazily on mouseenter.
    expect(root.querySelector(".pc-stat-tooltip")).toBeNull();
    chip.dispatchEvent(new MouseEvent("mouseenter"));
    const tip = root.querySelector(".pc-stat-tooltip");
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toContain("Constitution saving throw");
    expect(tip?.textContent).toContain("Save DC 15");
  });

  it("renders the mastery chip inside the weapon name cell (no 6th grid column)", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithAttacks([rowWithMastery(topple)]));
    const nameCell = root.querySelector(".pc-weapon-name");
    expect(nameCell?.querySelector(".pc-mastery-tag")).not.toBeNull();
  });

  it("renders no chip when mastery is absent", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithAttacks([rowWithMastery(undefined)]));
    expect(root.querySelector(".pc-mastery-tag")).toBeNull();
  });

  it("renderMasteryTooltip writes the description and derived line into the host", () => {
    installObsidianDomHelpers();
    const host = document.createElement("div");
    renderMasteryTooltip(host, topple);
    expect(host.textContent).toContain("Constitution saving throw");
    expect(host.querySelector(".pc-mastery-derived")?.textContent).toBe("Save DC 15");
  });

  it("renderMasteryTooltip omits the derived line when no derived value is present", () => {
    const host = document.createElement("div");
    renderMasteryTooltip(host, { slug: "sap", label: "Sap", description: "Disadvantage on its next attack." });
    expect(host.textContent).toContain("Disadvantage on its next attack.");
    expect(host.querySelector(".pc-mastery-derived")).toBeNull();
  });
});
