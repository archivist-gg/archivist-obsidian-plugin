/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

const closeCoinModalMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/coin-modal", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../packages/obsidian/src/modules/pc/components/coin-modal",
  );
  return { ...actual, closeCoinModal: closeCoinModalMock };
});

// Twin spy for closeProficiencyModal. The builder shell renders NO
// ProficienciesPanel at all (the sidebar is skipped entirely), so the modal's
// only refresh source is gone the moment the builder opens · the same hazard the
// coin spy above exists for. Keep the rest of the module real: the sheet path
// calls refreshProficiencyModal on every render and that must stay live.
const closeProficiencyModalMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/proficiency-edit-modal", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../packages/obsidian/src/modules/pc/components/proficiency-edit-modal",
  );
  return { ...actual, closeProficiencyModal: closeProficiencyModalMock };
});

// The two defenses popovers ride with the modals on builder entry. The defense
// picker has the same measured hazard the two spies above exist for · the builder
// renders no DefensesConditionsPanel, which is the sole caller of
// refreshDefenseTypePopover, so an open picker loses its only refresh source at
// this boundary. Keep refreshDefenseTypePopover real: the sheet path calls it on
// every render and the negative case below depends on that path being live.
const closeDefenseTypePopoverMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/defense-type-popover", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../packages/obsidian/src/modules/pc/components/defense-type-popover",
  );
  return { ...actual, closeDefenseTypePopover: closeDefenseTypePopoverMock };
});

// Twin spy for closeConditionsPopover. Unlike the three above it loses NO
// refresh source here (it has none anywhere); it is closed because the builder
// shows no conditions surface for it to float over and the `+` it is anchored to
// was just detached by renderPCSheet's root.empty().
const closeConditionsPopoverMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/conditions-popover", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../packages/obsidian/src/modules/pc/components/conditions-popover",
  );
  return { ...actual, closeConditionsPopover: closeConditionsPopoverMock };
});

import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("builder entry closes the sheet-owned modals and popovers", () => {
  it("closes the coin and proficiency modals and both defenses popovers when rendering a builder-flagged character", () => {
    closeCoinModalMock.mockClear();
    closeProficiencyModalMock.mockClear();
    closeDefenseTypePopoverMock.mockClear();
    closeConditionsPopoverMock.mockClear();
    const root = mountContainer();
    // An EMPTY ComponentRegistry makes every safeRender render its
    // "(No renderer for X)" placeholder without throwing (safeRender has NO
    // try/catch · a bare `{}` registry would TypeError on registry.get and
    // abort before the assertions). The builder branch still runs its full
    // close cluster first, which is what the four assertions below check.
    renderPCSheet({
      root,
      resolved: { definition: { builder: true, class: [] } },
      derived: {},
      services: {},
      app: {},
      registry: new ComponentRegistry(),
      editState: null,
      warnings: [],
    } as never);
    expect(closeCoinModalMock).toHaveBeenCalledTimes(1);
    expect(closeProficiencyModalMock).toHaveBeenCalledTimes(1);
    expect(closeDefenseTypePopoverMock).toHaveBeenCalledTimes(1);
    expect(closeConditionsPopoverMock).toHaveBeenCalledTimes(1);
  });
  it("does NOT close them on a normal (non-builder) sheet render", () => {
    // Load-bearing for the defense picker specifically: hoisting either popover
    // close out of the builder branch would tear the picker down on EVERY sheet
    // render, which is exactly the repaint-through-render behaviour R4-P5 task 10
    // added. Nothing else covers that · the task-10 tests drive
    // DefensesConditionsPanel.render directly and never go through renderPCSheet.
    closeCoinModalMock.mockClear();
    closeProficiencyModalMock.mockClear();
    closeDefenseTypePopoverMock.mockClear();
    closeConditionsPopoverMock.mockClear();
    const root = mountContainer();
    renderPCSheet({
      root,
      resolved: { definition: { builder: false, class: [{ class: "[[x]]", level: 1 }] } },
      derived: {},
      services: {},
      app: {},
      registry: new ComponentRegistry(),
      editState: null,
      warnings: [],
    } as never);
    expect(closeCoinModalMock).not.toHaveBeenCalled();
    expect(closeProficiencyModalMock).not.toHaveBeenCalled();
    expect(closeDefenseTypePopoverMock).not.toHaveBeenCalled();
    expect(closeConditionsPopoverMock).not.toHaveBeenCalled();
  });
});
