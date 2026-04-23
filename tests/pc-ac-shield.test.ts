/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AcShield } from "../src/modules/pc/components/ac-shield";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(ac: number): ComponentRenderContext {
  return { derived: { ac } } as unknown as ComponentRenderContext;
}

describe("AcShield", () => {
  it("renders a shield with ARMOR / number / CLASS text", () => {
    const root = mountContainer();
    new AcShield().render(root, ctx(14));
    const shield = root.querySelector(".pc-ac-shield");
    expect(shield).not.toBeNull();
    expect(shield?.querySelector(".pc-ac-shield-shell")).not.toBeNull();
    expect(shield?.querySelector(".pc-ac-shield-trim")).not.toBeNull();
    expect(shield?.querySelector(".pc-ac-shield-label-top")?.textContent).toBe("ARMOR");
    expect(shield?.querySelector(".pc-ac-shield-num")?.textContent).toBe("14");
    expect(shield?.querySelector(".pc-ac-shield-label-bot")?.textContent).toBe("CLASS");
  });
});
