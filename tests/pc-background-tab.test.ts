/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { BackgroundTab } from "../src/modules/pc/components/background-tab";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) {
    el.createDiv({ cls: `probe-${this.type}`, text: this.type });
  }
}

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {} as DerivedStats,
  core: {} as never,
  editState: null,
};

describe("BackgroundTab", () => {
  it("delegates rendering to the registered background-block", () => {
    const reg = new ComponentRegistry();
    reg.register(new Probe("background-block"));
    const container = mountContainer();
    new BackgroundTab(reg).render(container, ctx);
    const body = container.querySelector(".pc-background-body");
    expect(body).not.toBeNull();
    expect(body?.querySelector(".probe-background-block")).not.toBeNull();
  });
  it("shows an empty line when no background-block is registered", () => {
    const reg = new ComponentRegistry();
    const container = mountContainer();
    new BackgroundTab(reg).render(container, ctx);
    expect(container.querySelector(".pc-empty-line")).not.toBeNull();
    expect(container.querySelector(".probe-background-block")).toBeNull();
  });
});
