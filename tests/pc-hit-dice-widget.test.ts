/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { HitDiceWidget } from "../src/modules/pc/components/hit-dice-widget";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(hd: Record<string, { used: number; total: number }>): ComponentRenderContext {
  return { resolved: { state: { hit_dice: hd } } } as unknown as ComponentRenderContext;
}

describe("HitDiceWidget", () => {
  it("mono-class: remaining/total + 'HIT DICE · d8' label, no chips", () => {
    const root = mountContainer();
    new HitDiceWidget().render(root, ctx({ d8: { used: 3, total: 13 } }));
    const wrap = root.querySelector(".pc-panel.pc-hd-widget");
    expect(wrap).not.toBeNull();
    expect(wrap?.querySelector(".pc-hd-nums")?.textContent).toContain("10");   // 13 - 3
    expect(wrap?.querySelector(".pc-hd-nums")?.textContent).toContain("13");
    expect(wrap?.querySelector(".pc-hd-label")?.textContent).toBe("HIT DICE · d8");
    expect(wrap?.querySelector(".pc-hd-chips")).toBeNull();
  });

  it("renders + (top) and − (bottom) buttons; inert in SP3", () => {
    const root = mountContainer();
    new HitDiceWidget().render(root, ctx({ d8: { used: 0, total: 13 } }));
    const btns = [...root.querySelectorAll<HTMLButtonElement>(".pc-hd-actions button")];
    expect(btns.length).toBe(2);
    expect(btns[0].textContent).toBe("+");
    expect(btns[1].textContent).toBe("−");   // U+2212
    expect(() => btns[0].click()).not.toThrow();
  });

  it("multiclass: chip row appears, first chip active, displayed data follows it", () => {
    const root = mountContainer();
    new HitDiceWidget().render(root, ctx({
      d8: { used: 0, total: 10 },
      d10: { used: 1, total: 3 },
    }));
    const chips = [...root.querySelectorAll<HTMLElement>(".pc-hd-chip")];
    expect(chips.length).toBe(2);
    expect(chips[0].classList.contains("active")).toBe(true);
    expect(chips[0].textContent).toBe("d8");
    expect(chips[1].textContent).toBe("d10");
    expect(root.querySelector(".pc-hd-nums")?.textContent).toContain("10");
    expect(root.querySelector(".pc-hd-label")?.textContent).toBe("HIT DICE · d8");
  });

  it("empty hit_dice: placeholder — no actions, no numbers", () => {
    const root = mountContainer();
    new HitDiceWidget().render(root, ctx({}));
    const wrap = root.querySelector(".pc-panel.pc-hd-widget");
    expect(wrap?.querySelector(".pc-hd-empty")?.textContent).toBe("—");
    expect(wrap?.querySelector(".pc-hd-actions")).toBeNull();
  });
});
