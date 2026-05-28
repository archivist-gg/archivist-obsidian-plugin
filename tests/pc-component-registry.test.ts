/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import type {
  SheetComponent,
  ComponentRenderContext,
} from "../src/modules/pc/components/component.types";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

class FakeComponent implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) {
    el.createDiv({ cls: "fake", text: this.type });
  }
}

describe("ComponentRegistry", () => {
  it("registers and retrieves components by type", () => {
    const reg = new ComponentRegistry();
    reg.register(new FakeComponent("a"));
    expect(reg.has("a")).toBe(true);
    expect(reg.get("a")?.type).toBe("a");
  });

  it("throws on duplicate type", () => {
    const reg = new ComponentRegistry();
    reg.register(new FakeComponent("a"));
    expect(() => reg.register(new FakeComponent("a"))).toThrow(/Duplicate/);
  });

  it("returns undefined for unknown types", () => {
    expect(new ComponentRegistry().get("nope")).toBeUndefined();
  });

  it("tracks size", () => {
    const reg = new ComponentRegistry();
    expect(reg.size()).toBe(0);
    reg.register(new FakeComponent("a"));
    reg.register(new FakeComponent("b"));
    expect(reg.size()).toBe(2);
  });

  it("components render into a DOM element", () => {
    const container = mountContainer();
    new FakeComponent("x").render(container);
    expect(container.querySelector(".fake")?.textContent).toBe("x");
  });
});
