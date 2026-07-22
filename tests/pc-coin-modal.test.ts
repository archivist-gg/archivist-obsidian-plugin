/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

interface MockModalInstance {
  contentEl: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
  close?: () => void;
}
const modalInstances = vi.hoisted(() => [] as MockModalInstance[]);

vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    Modal: class {
      app: unknown;
      contentEl: HTMLElement;
      constructor(app: unknown) {
        this.app = app;
        this.contentEl = document.createElement("div");
        modalInstances.push(this as unknown as MockModalInstance);
      }
      open(): void { (this as unknown as MockModalInstance).onOpen?.(); }
      close(): void { (this as unknown as MockModalInstance).onClose?.(); }
    },
  };
});

import { openCoinModal, refreshCoinModal, closeCoinModal } from "../packages/obsidian/src/modules/pc/components/coin-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";

beforeAll(() => installObsidianDomHelpers());
afterEach(() => { closeCoinModal(); modalInstances.length = 0; });

function lastModal(): MockModalInstance { return modalInstances[modalInstances.length - 1]; }

function makeEditState(): CharacterEditState {
  return { setCurrency: vi.fn(), adjustCurrency: vi.fn() } as unknown as CharacterEditState;
}

function makeCtx(
  currency: Partial<Record<"pp" | "gp" | "ep" | "sp" | "cp", number>> | undefined,
  editState: CharacterEditState | null,
): ComponentRenderContext {
  return {
    resolved: { definition: { currency } } as never,
    derived: {} as never, services: {} as never, app: {} as never,
    editState,
  } as ComponentRenderContext;
}

function boxes(el: HTMLElement): HTMLInputElement[] {
  return [...el.querySelectorAll("input.pc-coin-adjust-input")] as HTMLInputElement[];
}
function pressKey(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("openCoinModal / refreshCoinModal guards", () => {
  it("no-ops without editState", () => {
    openCoinModal(makeCtx({ gp: 1 }, null));
    expect(modalInstances.length).toBe(0);
  });
  it("repaints (not reopens) on same-editState reopen; closes a different-editState modal first", () => {
    const es1 = makeEditState();
    openCoinModal(makeCtx({ gp: 1 }, es1));
    expect(modalInstances.length).toBe(1);
    openCoinModal(makeCtx({ gp: 2 }, es1));
    expect(modalInstances.length).toBe(1);
    const es2 = makeEditState();
    openCoinModal(makeCtx({ gp: 3 }, es2));
    expect(modalInstances.length).toBe(2);
  });
  it("refresh with a different editState closes; same identity repaints values", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 5 }, es));
    const el = lastModal().contentEl;
    refreshCoinModal(makeCtx({ gp: 9 }, es));
    expect([...el.querySelectorAll(".pc-coin-lrow-val")].map((v) => v.textContent))
      .toEqual(["0", "9", "0", "0", "0"]);
    const onCloseSpy = vi.fn();
    const inst = lastModal(); const origOnClose = inst.onClose;
    inst.onClose = () => { onCloseSpy(); origOnClose?.call(inst); };
    refreshCoinModal(makeCtx({ gp: 9 }, makeEditState()));
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});

describe("skeleton (AC3 structure)", () => {
  it("builds title, total num + unit, five PP→CP rows (gp row hintless), 5 adjust cells, 3 buttons, NO .pc-coin-hint", () => {
    openCoinModal(makeCtx({ pp: 2, gp: 148, ep: 4, sp: 23, cp: 57 }, makeEditState()));
    const el = lastModal().contentEl;
    expect(el.querySelector(".pc-coin-title")?.textContent).toBe("Currency");
    expect(el.querySelector(".pc-coin-total-num")?.textContent).toBe("172.87");
    expect(el.querySelector(".pc-coin-total-unit")?.textContent).toBe("gp total");
    const rows = [...el.querySelectorAll(".pc-coin-lrow")];
    expect(rows.length).toBe(5);
    expect(rows.map((r) => r.querySelector(".pc-coin-lrow-name")?.textContent))
      .toEqual(["Platinum(pp)", "Gold(gp)", "Electrum(ep)", "Silver(sp)", "Copper(cp)"]);
    expect(rows.map((r) => r.querySelector(".pc-coin-lrow-hint")?.textContent ?? null))
      .toEqual(["1 pp = 10 gp", null, "1 gp = 2 ep", "1 gp = 10 sp", "1 gp = 100 cp"]);
    expect(rows.map((r) => r.querySelectorAll("svg.pc-coin-shape").length)).toEqual([1, 1, 1, 1, 1]);
    expect(boxes(el).length).toBe(5);
    expect([...el.querySelectorAll("button.pc-coin-btn")].map((b) => b.textContent))
      .toEqual(["+ Add", "− Subtract", "× Clear"]);
    expect(el.querySelector(".pc-coin-hint")).toBeNull();
  });
  it("always lists EP even at 0", () => {
    openCoinModal(makeCtx({ gp: 1 }, makeEditState()));
    expect([...lastModal().contentEl.querySelectorAll(".pc-coin-lrow")].length).toBe(5);
  });
});

describe("direct set (ledger value)", () => {
  it("Enter commits via setCurrency; a subsequent repaint leaves NO orphaned input (ledger rebuild)", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 148 }, es));
    const el = lastModal().contentEl;
    const gpVal = [...el.querySelectorAll(".pc-coin-lrow-val")][1] as HTMLElement;
    gpVal.click();
    const inline = el.querySelector("input.pc-edit-inline") as HTMLInputElement;
    expect(inline).toBeTruthy();
    inline.value = "200";
    pressKey(inline, "Enter");
    expect(es.setCurrency).toHaveBeenCalledWith("gp", 200);
    refreshCoinModal(makeCtx({ gp: 200 }, es)); // the onChange repaint
    expect(el.querySelector("input.pc-edit-inline")).toBeNull();
    expect([...el.querySelectorAll(".pc-coin-lrow-val")][1].textContent).toBe("200");
  });
  it("Escape cancels the inline edit and the modal STAYS open", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 148 }, es));
    const el = lastModal().contentEl;
    ([...el.querySelectorAll(".pc-coin-lrow-val")][1] as HTMLElement).click();
    const inline = el.querySelector("input.pc-edit-inline") as HTMLInputElement;
    pressKey(inline, "Escape");
    expect(es.setCurrency).not.toHaveBeenCalled();
    expect(el.querySelector(".pc-coin-title")).toBeTruthy();
    expect(el.querySelectorAll(".pc-coin-lrow").length).toBe(5);
  });
});

describe("adjust section", () => {
  it("Add applies every filled box in ONE adjustCurrency call and clears the boxes", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 }, makeEditState()));
    closeCoinModal();
    openCoinModal(makeCtx({ pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 }, es));
    const el = lastModal().contentEl;
    const [ppB, gpB, , spB] = boxes(el);
    gpB.value = "37"; spB.value = "5"; ppB.value = "0";
    ([...el.querySelectorAll("button.pc-coin-btn")][0] as HTMLButtonElement).click();
    expect(es.adjustCurrency).toHaveBeenCalledTimes(1);
    expect(es.adjustCurrency).toHaveBeenCalledWith({ gp: 37, sp: 5 });
    expect(boxes(el).every((b) => b.value === "")).toBe(true);
  });
  it("all-empty / all-zero Add is a COMPLETE no-op", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 10 }, es));
    const el = lastModal().contentEl;
    boxes(el)[1].value = "0";
    ([...el.querySelectorAll("button.pc-coin-btn")][0] as HTMLButtonElement).click();
    expect(es.adjustCurrency).not.toHaveBeenCalled();
    expect(boxes(el)[1].value).toBe("0");
    expect(boxes(el)[1].classList.contains("is-error")).toBe(false);
  });
  it("Subtract that would go negative atomically rejects: is-error on offenders, NOTHING written, values retained", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 10, sp: 3 }, es));
    const el = lastModal().contentEl;
    const [, gpB, , spB, cpB] = boxes(el);
    gpB.value = "5"; spB.value = "4";
    ([...el.querySelectorAll("button.pc-coin-btn")][1] as HTMLButtonElement).click();
    expect(es.adjustCurrency).not.toHaveBeenCalled();
    expect(spB.classList.contains("is-error")).toBe(true);
    expect(gpB.classList.contains("is-error")).toBe(false);
    expect(gpB.value).toBe("5");
    expect(spB.value).toBe("4");
    expect(cpB.classList.contains("is-error")).toBe(false);
    spB.value = "3";
    spB.dispatchEvent(new Event("input", { bubbles: true }));
    expect(spB.classList.contains("is-error")).toBe(false);
  });
  it("input strips non-digits ('12a'→'12', '007' kept for parseInt→7)", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 10 }, es));
    const el = lastModal().contentEl;
    const gpB = boxes(el)[1];
    gpB.value = "12a";
    gpB.dispatchEvent(new Event("input", { bubbles: true }));
    expect(gpB.value).toBe("12");
    gpB.value = "007";
    ([...el.querySelectorAll("button.pc-coin-btn")][0] as HTMLButtonElement).click();
    expect(es.adjustCurrency).toHaveBeenCalledWith({ gp: 7 });
  });
  it("Enter in a box triggers Add; Escape in a box closes the modal (handled locally)", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 10 }, es));
    const el = lastModal().contentEl;
    const gpB = boxes(el)[1];
    gpB.value = "2";
    pressKey(gpB, "Enter");
    expect(es.adjustCurrency).toHaveBeenCalledWith({ gp: 2 });
    const inst = lastModal();
    const onCloseSpy = vi.fn(); const orig = inst.onClose;
    inst.onClose = () => { onCloseSpy(); orig?.call(inst); };
    pressKey(boxes(el)[1], "Escape");
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
  it("Clear empties boxes and error classes without writing", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 1 }, es));
    const el = lastModal().contentEl;
    const gpB = boxes(el)[1];
    gpB.value = "9"; gpB.classList.add("is-error");
    ([...el.querySelectorAll("button.pc-coin-btn")][2] as HTMLButtonElement).click();
    expect(gpB.value).toBe("");
    expect(gpB.classList.contains("is-error")).toBe(false);
    expect(es.adjustCurrency).not.toHaveBeenCalled();
  });
  it("adjust boxes survive a repaint (adjust section never rebuilt)", () => {
    const es = makeEditState();
    openCoinModal(makeCtx({ gp: 10 }, es));
    const el = lastModal().contentEl;
    const gpB = boxes(el)[1];
    gpB.value = "37";
    refreshCoinModal(makeCtx({ gp: 12 }, es));
    expect(boxes(el)[1]).toBe(gpB);
    expect(gpB.value).toBe("37");
  });
});
