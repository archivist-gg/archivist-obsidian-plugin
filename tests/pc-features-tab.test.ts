/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { FeaturesTab } from "../src/modules/pc/components/features-tab";
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
};

describe("FeaturesTab", () => {
  it("renders block components in canonical order when registered", () => {
    const reg = new ComponentRegistry();
    reg.register(new Probe("class-block"));
    reg.register(new Probe("race-block"));
    reg.register(new Probe("feat-block"));
    // subclass-block intentionally missing
    const container = mountContainer();
    new FeaturesTab(reg).render(container, ctx);
    const sections = [...container.querySelectorAll<HTMLDivElement>(".pc-features-section")];
    const classes = sections.map((s) => s.className);
    expect(classes[0]).toContain("pc-features-class-block");
    expect(classes[1]).toContain("pc-features-race-block");
    expect(classes[2]).toContain("pc-features-feat-block");
  });
  it("skips missing block components silently", () => {
    const reg = new ComponentRegistry();
    const container = mountContainer();
    new FeaturesTab(reg).render(container, ctx);
    expect(container.querySelectorAll(".pc-features-section").length).toBe(0);
  });
});
