/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import {
  renderWeaponsGroup,
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

type WeaponActionEntry = { kind: "weapon"; attack: AttackRow };

/** Group driver: build weapon entries and render the whole sub-group (header +
 *  rows), mirroring how section-renderer dispatches the weapons sub-group. */
function renderGroup(root: HTMLElement, attacks: AttackRow[]): HTMLElement {
  const list = root.createDiv({ cls: "pc-actions-table pc-weapons-table" });
  const entries: WeaponActionEntry[] = attacks.map((attack) => ({ kind: "weapon", attack }));
  renderWeaponsGroup(list, entries, ctxWithAttacks(attacks));
  return list;
}

const rowWithRange = (range: string, thrownRange?: string): AttackRow =>
  ({
    id: "0:standard", name: "Dagger", range, thrownRange, toHit: 5,
    damageDice: "1d4 + 3", damageType: "piercing",
    properties: ["finesse", "light", "thrown"], proficient: true,
    breakdown: { toHit: [], damage: [] },
    informational: [], slotKey: "mainhand",
  } as unknown as AttackRow);

describe("WeaponsTable · Range cell (stacked thrown-range line)", () => {
  it("renders .pc-weapon-range-main over a muted .pc-weapon-range-thrown for a throwable melee weapon", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithRange("5 ft", "20/60 ft")]);

    const cell = root.querySelector(".pc-weapon-range") as HTMLElement;
    expect(cell).not.toBeNull();

    const main = cell.querySelector(".pc-weapon-range-main") as HTMLElement;
    expect(main).not.toBeNull();
    expect(main.textContent).toBe("5 ft");

    const thrown = cell.querySelector(".pc-weapon-range-thrown") as HTMLElement;
    expect(thrown).not.toBeNull();
    expect(thrown.textContent).toBe("20/60 ft");
    expect(thrown.title).toBe("Thrown range");
  });

  it("renders ONLY .pc-weapon-range-main (no thrown line) for a single-range weapon", () => {
    const root = mountContainer();
    renderGroup(root, [rowWithRange("150/600 ft")]);

    const cell = root.querySelector(".pc-weapon-range") as HTMLElement;
    const main = cell.querySelector(".pc-weapon-range-main") as HTMLElement;
    expect(main).not.toBeNull();
    expect(main.textContent).toBe("150/600 ft");

    expect(cell.querySelector(".pc-weapon-range-thrown")).toBeNull();
  });
});
