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

import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("builder entry closes the sheet-owned modals", () => {
  it("closes the coin and proficiency modals when rendering a builder-flagged character", () => {
    closeCoinModalMock.mockClear();
    closeProficiencyModalMock.mockClear();
    const root = mountContainer();
    // An EMPTY ComponentRegistry makes every safeRender render its
    // "(No renderer for X)" placeholder without throwing (safeRender has NO
    // try/catch · a bare `{}` registry would TypeError on registry.get and
    // abort before the assertions). The builder branch still runs its
    // closeCoinModal() and closeProficiencyModal() teardown first, which is what
    // the two assertions below check.
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
  });
  it("does NOT close them on a normal (non-builder) sheet render", () => {
    closeCoinModalMock.mockClear();
    closeProficiencyModalMock.mockClear();
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
  });
});
