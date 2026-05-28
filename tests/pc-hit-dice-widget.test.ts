/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
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

describe("HitDiceWidget — interactive (SP4)", () => {
  function interactiveCtx(dice: Record<string, { used: number; total: number }>, activeHitDie: string | null = null) {
    const editState = {
      sessionState: { activeHitDie },
      spendHitDie: vi.fn(),
      restoreHitDie: vi.fn(),
      setActiveHitDie: vi.fn((die: string) => {
        editState.sessionState.activeHitDie = die;
      }),
    };
    return {
      ctx: {
        derived: {},
        resolved: { state: { hit_dice: dice } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("− click calls spendHitDie with the active die", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ d10: { used: 0, total: 3 } });
    new HitDiceWidget().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click();
    expect(editState.spendHitDie).toHaveBeenCalledWith("d10");
  });

  it("+ click calls restoreHitDie with the active die", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ d10: { used: 2, total: 3 } });
    new HitDiceWidget().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-hd-plus")!.click();
    expect(editState.restoreHitDie).toHaveBeenCalledWith("d10");
  });

  it("chip click calls setActiveHitDie with the chip's die", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({
      d8: { used: 0, total: 2 },
      d10: { used: 0, total: 3 },
    });
    new HitDiceWidget().render(root, ctx);
    const chips = [...root.querySelectorAll<HTMLElement>(".pc-hd-chip")];
    expect(chips.length).toBe(2);
    chips[1].click();
    expect(editState.setActiveHitDie).toHaveBeenCalledWith("d10");
  });

  it("shows the active die's counts when sessionState.activeHitDie is set", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({
      d8: { used: 0, total: 2 },
      d10: { used: 1, total: 3 },
    }, "d10");
    new HitDiceWidget().render(root, ctx);
    expect(root.querySelector(".pc-hd-rem")?.textContent).toBe("2");
    expect(root.querySelector(".pc-hd-tot")?.textContent).toBe("3");
    expect(root.querySelector(".pc-hd-label")?.textContent).toBe("HIT DICE · d10");
  });
});
