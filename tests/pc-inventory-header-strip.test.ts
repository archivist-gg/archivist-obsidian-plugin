/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { HeaderStrip } from "../src/modules/pc/components/inventory/header-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeCtx(): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } } } as never,
    derived: { attunementUsed: 0, attunementLimit: 3 } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("HeaderStrip", () => {
  it("renders root .pc-header-strip with attune-section + divider + currency-section", () => {
    const root = mountContainer();
    new HeaderStrip().render(root, makeCtx());
    expect(root.querySelector(".pc-header-strip")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-attune")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-divider")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-currency")).toBeTruthy();
  });
});
