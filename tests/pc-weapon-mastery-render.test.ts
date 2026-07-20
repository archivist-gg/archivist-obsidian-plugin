/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import {
  renderWeaponsGroup,
} from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { renderWeaponBlock } from "../packages/obsidian/src/modules/weapon/weapon.renderer";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";
import type { WeaponEntity } from "@archivist-gg/dnd5e/weapon/weapon.types";

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
type WeaponActionEntry = { kind: "weapon"; attack: AttackRow };

/** Group driver: build weapon entries and render the whole sub-group (header +
 *  rows), mirroring how section-renderer dispatches the weapons sub-group. */
function renderGroup(root: HTMLElement, attacks: AttackRow[]): HTMLElement {
  const list = root.createDiv({ cls: "pc-actions-table pc-weapons-table" });
  const entries: WeaponActionEntry[] = attacks.map((attack) => ({ kind: "weapon", attack }));
  renderWeaponsGroup(list, entries, ctxWithAttacks(attacks));
  return list;
}

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
  description: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw. On a failed save, the creature has the Prone condition.",
  gist: "on fail: Prone",
  derived: { label: "Save DC", value: 13 },
};

const sap: Mastery = {
  slug: "sap", label: "Sap",
  description: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  gist: "on hit: target Disadvantage",
};

const battleaxe: WeaponEntity = {
  name: "Battleaxe",
  category: "martial-melee",
  damage: { dice: "1d8", type: "slashing" },
  properties: ["versatile"],
} as unknown as WeaponEntity;

describe("WeaponsTable · 2024 weapon mastery column (in-block, no hover)", () => {
  it("renders a labeled header row + a trailing .pc-weapon-mastery CELL over the gist for a has-mastery group", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithMastery(topple)]);

    // (a) header row: blank leading cost cell + Name / Range / Hit / Damage / Mastery.
    const header = root.querySelector(".pc-weapon-header");
    expect(header).not.toBeNull();
    expect(header?.classList.contains("has-mastery")).toBe(true);
    const headerText = header?.textContent ?? "";
    for (const label of ["Name", "Range", "Hit", "Damage", "Mastery"]) {
      expect(headerText, label).toContain(label);
    }
    // Leading cost cell is blank (no label over the cost badge column).
    const leadingCell = header?.firstElementChild as HTMLElement;
    expect(leadingCell?.textContent).toBe("");

    // The row carries the 6-col has-mastery grid template class.
    const row = root.querySelector(".pc-action-row") as HTMLElement;
    expect(row.classList.contains("has-mastery")).toBe(true);

    // (a) a REAL trailing grid cell (direct child of the row), NOT a sub-line
    // inside .pc-weapon-name.
    const cell = row.querySelector(":scope > .pc-weapon-mastery") as HTMLElement;
    expect(cell).not.toBeNull();
    expect(root.querySelector(".pc-weapon-name .pc-weapon-mastery")).toBeNull();

    // Chip stacked over the compact "Save DC 13 · on fail: Prone" line.
    const chip = cell.querySelector(".pc-mastery-tag") as HTMLElement;
    expect(chip.textContent).toBe("Topple");
    expect(chip.classList.contains("pc-meta-chip")).toBe(true);
    const gist = cell.querySelector(".pc-weapon-mastery-gist") as HTMLElement;
    expect(gist.textContent).toBe("Save DC 13 · on fail: Prone");
  });

  it("renders a non-derived mastery gist with no leading derived value", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithMastery(sap)]);
    const gist = root.querySelector(".pc-weapon-mastery-gist") as HTMLElement;
    expect(gist.textContent).toBe("on hit: target Disadvantage");
  });

  it("renders NO header + NO Mastery cell for a no-mastery group (unchanged 5-col grid)", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithMastery(undefined)]);
    expect(root.querySelector(".pc-weapon-header")).toBeNull();
    expect(root.querySelector(".pc-weapon-mastery")).toBeNull();
    const row = root.querySelector(".pc-action-row") as HTMLElement;
    expect(row.classList.contains("has-mastery")).toBe(false);
  });

  it("mounts NO hover tooltip on the mastery chip (attachStatTooltip removed)", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithMastery(topple)]);
    const chip = root.querySelector(".pc-mastery-tag") as HTMLElement;
    expect(root.querySelector(".pc-stat-tooltip")).toBeNull();
    chip.dispatchEvent(new MouseEvent("mouseenter"));
    // No lazy tooltip host is created: the detail now lives in the column + card.
    expect(root.querySelector(".pc-stat-tooltip")).toBeNull();
  });

  it("renders a Weapon Mastery · <Label> in-card section with the Save DC + glossary prose", () => {
    const block = renderWeaponBlock(battleaxe, topple);
    const section = block.querySelector(".archivist-weapon-mastery-section") as HTMLElement;
    expect(section).not.toBeNull();
    const heading = section.querySelector(".archivist-weapon-mastery-heading")?.textContent ?? "";
    expect(heading).toContain("Weapon Mastery · Topple");
    expect(heading).toContain("Save DC 13");
    expect(section.textContent).toContain("Prone condition");
  });

  it("renders NO mastery section when renderWeaponBlock is called without a mastery arg", () => {
    const block = renderWeaponBlock(battleaxe);
    expect(block.querySelector(".archivist-weapon-mastery-section")).toBeNull();
  });

  it("emits no em dash (U+2014) in any rendered mastery text", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithMastery(topple)]);
    const cell = root.querySelector(".pc-weapon-mastery") as HTMLElement;
    expect(cell.textContent).not.toContain("—");
    const block = renderWeaponBlock(battleaxe, topple);
    const section = block.querySelector(".archivist-weapon-mastery-section") as HTMLElement;
    expect(section.textContent).not.toContain("—");
  });
});
