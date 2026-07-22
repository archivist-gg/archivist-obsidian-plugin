/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

const closeCoinModalMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/coin-modal", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../packages/obsidian/src/modules/pc/components/coin-modal",
  );
  return { ...actual, closeCoinModal: closeCoinModalMock };
});

import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("builder entry closes the coin modal", () => {
  it("calls closeCoinModal when rendering a builder-flagged character", () => {
    closeCoinModalMock.mockClear();
    const root = mountContainer();
    // An EMPTY ComponentRegistry makes every safeRender render its
    // "(No renderer for X)" placeholder without throwing (safeRender has NO
    // try/catch — a bare `{}` registry would TypeError on registry.get and
    // abort before the assertion). The builder branch still runs its
    // closeCoinModal() teardown first, which is all this test asserts.
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
  });
  it("does NOT close it on a normal (non-builder) sheet render", () => {
    closeCoinModalMock.mockClear();
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
  });
});
