/** @vitest-environment jsdom */
import { it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { BuilderView } from "../packages/obsidian/src/modules/pc/components/builder-view";

beforeAll(() => installObsidianDomHelpers());

it("renders the equipment step body (not the placeholder) when active", () => {
  const c = mountContainer();
  // The step's single reconcile site now runs in EVERY mode, `empty` included,
  // and `?.` guards a null editState rather than a missing method · a stub
  // without these two would throw instead of asserting anything.
  const adjustCurrency = vi.fn();
  const syncStartingEquipment = vi.fn();
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
    services: { entities: { search: () => [], getBySlug: () => null, getByTypeAndSlug: () => undefined } },
    app: {},
    editState: { setBuilderEquipmentMode: () => {}, adjustCurrency, syncStartingEquipment },
    builderUiState: new Map(),
  } as never);
  expect(c.querySelector(".pc-bmethods")).not.toBeNull();
  expect(c.querySelector(".pc-builder-placeholder")).toBeNull();
  // The adopt writes nothing.
  expect(adjustCurrency).not.toHaveBeenCalled();
  expect(syncStartingEquipment).not.toHaveBeenCalled();
});
