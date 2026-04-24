/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SensesPanel } from "../src/modules/pc/components/senses-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {
    passives: { perception: 14, investigation: 10, insight: 11 },
  } as DerivedStats,
  core: {} as never,
  editState: null,
};

describe("SensesPanel", () => {
  it("renders three passive rows", () => {
    const container = mountContainer();
    new SensesPanel().render(container, ctx);
    expect(container.querySelectorAll(".pc-sense-row").length).toBe(3);
  });
  it("shows perception, investigation, insight values", () => {
    const container = mountContainer();
    new SensesPanel().render(container, ctx);
    const vals = [...container.querySelectorAll(".pc-sense-val")].map((v) => v.textContent);
    expect(vals).toEqual(["14", "10", "11"]);
  });
});
