/** @vitest-environment jsdom */
import { it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { BuilderView } from "../packages/obsidian/src/modules/pc/components/builder-view";

beforeAll(() => installObsidianDomHelpers());

it("renders the equipment step body (not the placeholder) when active", () => {
  const c = mountContainer();
  new BuilderView().render(c, {
    activeStepId: "equipment",
    resolved: {
      definition: {
        name: "X",
        class: [],
        background: null,
        equipment: [],
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        builder_equipment_mode: "empty",
      },
      classes: [],
      background: null,
    },
    derived: { totalLevel: 0, proficiencyBonus: 2 },
    core: { entities: { search: () => [], getBySlug: () => null, getByTypeAndSlug: () => undefined } },
    app: {},
    editState: { setBuilderEquipmentMode: () => {} },
    builderUiState: new Map(),
  } as never);
  expect(c.querySelector(".pc-bmethods")).not.toBeNull();
  expect(c.querySelector(".pc-builder-placeholder")).toBeNull();
});
