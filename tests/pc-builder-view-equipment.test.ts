/** @vitest-environment jsdom */
import { it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { BuilderView } from "../packages/obsidian/src/modules/pc/components/builder-view";

beforeAll(() => installObsidianDomHelpers());

it("renders the equipment step body (not the placeholder) when active", () => {
  const c = mountContainer();
  // The step's single reconcile site now runs in EVERY mode, `empty` included:
  // `reconcileGold(ctx, 0)` fires here. With a bag present that is a first-render
  // ADOPT · goldStep rule 1 lands 0, so adjustCurrency is never reached · and
  // reconcileGear does not run in `empty` mode at all. These two mocks pin that
  // ZERO-WRITE adopt, so a future "adopt then apply" regression fails them by
  // assertion rather than as a stub TypeError.
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
