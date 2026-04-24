/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AbilityRow } from "../src/modules/pc/components/ability-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { SaveChip } from "../src/modules/pc/components/save-chip";
import { ABILITY_KEYS } from "../src/shared/dnd/constants";
import type { Ability } from "../src/shared/types";

beforeAll(() => installObsidianDomHelpers());

function ctx(): ComponentRenderContext {
  return {
    derived: {
      scores: { str: 4, dex: 15, con: 12, int: 21, wis: 13, cha: 10 },
      mods: { str: -3, dex: 2, con: 1, int: 5, wis: 1, cha: 0 },
      saves: {
        str: { bonus: -3, proficient: false },
        dex: { bonus: 2, proficient: false },
        con: { bonus: 6, proficient: true },
        int: { bonus: 10, proficient: true },
        wis: { bonus: 1, proficient: false },
        cha: { bonus: 0, proficient: false },
      },
    },
    resolved: { definition: { overrides: {} } },
    editState: null,
  } as unknown as ComponentRenderContext;
}

function makeRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const abl of ABILITY_KEYS as readonly Ability[]) {
    r.register(new SaveChip(abl));
  }
  return r;
}

describe("AbilityRow (V7)", () => {
  it("renders 6 ability stacks, each with an ability card + save chip", () => {
    const root = mountContainer();
    new AbilityRow(makeRegistry()).render(root, ctx());
    expect(root.querySelectorAll(".pc-ab-stack").length).toBe(6);
    expect(root.querySelectorAll(".pc-ab-stack .pc-ab").length).toBe(6);
    expect(root.querySelectorAll(".pc-ab-stack .pc-save-chip").length).toBe(6);
  });

  it("renders label / modifier / score inside each cartouche card", () => {
    const root = mountContainer();
    new AbilityRow(makeRegistry()).render(root, ctx());
    expect(root.querySelectorAll(".pc-ab .pc-ab-label").length).toBe(6);
    expect(root.querySelectorAll(".pc-ab .pc-ab-mod").length).toBe(6);
    expect(root.querySelectorAll(".pc-ab .pc-ab-score").length).toBe(6);
    expect(root.querySelector(".pc-ab[data-ability='str'] .pc-ab-score")?.textContent).toBe("4");
    expect(root.querySelector(".pc-ab[data-ability='int'] .pc-ab-mod")?.textContent).toBe("+5");
  });

  it("marks CON and INT saves proficient; STR/DEX/WIS/CHA plain", () => {
    const root = mountContainer();
    new AbilityRow(makeRegistry()).render(root, ctx());
    const byAb = (ab: string) =>
      [...root.querySelectorAll<HTMLElement>(".pc-ab-stack")].find(
        (s) => s.querySelector(`.pc-ab[data-ability='${ab}']`)
      )!;
    expect(byAb("con").querySelector(".pc-save-chip.prof")).not.toBeNull();
    expect(byAb("int").querySelector(".pc-save-chip.prof")).not.toBeNull();
    expect(byAb("str").querySelector(".pc-save-chip.prof")).toBeNull();
    expect(byAb("cha").querySelector(".pc-save-chip.prof")).toBeNull();
  });

  it("has NO outer container (.pc-ability-container), abilities float free", () => {
    const root = mountContainer();
    new AbilityRow(makeRegistry()).render(root, ctx());
    expect(root.querySelector(".pc-ability-container")).toBeNull();
  });
});
