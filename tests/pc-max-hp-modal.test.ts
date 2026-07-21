/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

// Mock Obsidian's Modal with a minimal real class (mirrors pc-rest-modal.test.ts),
// plus a hoisted instance registry so tests can reach `contentEl` even though
// the MaxHpModal class itself is not exported (only the three module functions
// are — see max-hp-modal.ts's Produces contract).
interface MockModalInstance {
  contentEl: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
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
      open(): void { this.onOpen?.(); }
      close(): void { this.onClose?.(); }
      onOpen?(): void {}
      onClose?(): void {}
    },
  };
});

import { openMaxHpModal, refreshMaxHpModal, closeMaxHpModal } from "../packages/obsidian/src/modules/pc/components/max-hp-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { HPBreakdown } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

afterEach(() => {
  closeMaxHpModal();
  modalInstances.length = 0;
});

function lastModal(): MockModalInstance {
  return modalInstances[modalInstances.length - 1];
}

function baseBreakdown(overrides: Partial<HPBreakdown> = {}): HPBreakdown {
  return {
    diceSum: 0,
    diceSource: "average",
    averageDiceSum: 0,
    conMod: 0,
    conLevels: 0,
    clampApplied: false,
    perLevelTerms: [],
    modifier: null,
    exhaustionMultiplier: 1,
    exhaustionLevel: 0,
    derivedMax: 0,
    override: null,
    final: 0,
    ...overrides,
  };
}

function makeEditState() {
  return {
    setRolledHp: vi.fn(),
    clearRolledHp: vi.fn(),
    setHpModifier: vi.fn(),
    clearHpModifier: vi.fn(),
    setMaxHpOverride: vi.fn(),
    clearMaxHpOverride: vi.fn(),
  };
}
type FakeEditState = ReturnType<typeof makeEditState>;

function makeCtx(opts: {
  breakdown?: Partial<HPBreakdown>;
  editState?: FakeEditState | null;
  classes?: unknown[];
}): ComponentRenderContext {
  return {
    app: {},
    derived: { hpBreakdown: baseBreakdown(opts.breakdown ?? {}) },
    resolved: { classes: opts.classes ?? [] },
    editState: opts.editState === undefined ? makeEditState() : opts.editState,
  } as unknown as ComponentRenderContext;
}

describe("MaxHpModal", () => {
  it("1. no editState -> openMaxHpModal is a no-op (no singleton registered)", () => {
    const ctx = makeCtx({ editState: null });
    openMaxHpModal(ctx);
    expect(modalInstances.length).toBe(0);
    expect(() => refreshMaxHpModal(ctx)).not.toThrow();
    expect(() => closeMaxHpModal()).not.toThrow();
  });

  it("2. average state: big=final, equation '70 average', rolled placeholder+hint, modifier +0, override none", () => {
    const ctx = makeCtx({
      breakdown: {
        diceSum: 70, diceSource: "average", averageDiceSum: 70,
        conMod: 0, conLevels: 0, modifier: null,
        exhaustionMultiplier: 1, exhaustionLevel: 0,
        override: null, final: 70, derivedMax: 70,
      },
    });
    openMaxHpModal(ctx);
    const contentEl = lastModal().contentEl;

    expect(contentEl.querySelector(".pc-maxhp-big")?.textContent).toBe("70");
    expect(contentEl.querySelector(".pc-maxhp-eq")?.textContent).toContain("70 average");

    const fields = contentEl.querySelectorAll(".pc-maxhp-field");
    const rolledField = fields[0];
    const rolledBox = rolledField.querySelector(".pc-maxhp-box");
    expect(rolledBox?.classList.contains("is-placeholder")).toBe(true);
    expect(rolledField.querySelector(".pc-maxhp-field-hint")?.textContent).toBe("average: 70");

    const modField = fields[1];
    expect(modField.querySelector(".pc-maxhp-box")?.textContent).toBe("+0");

    const overrideField = fields[2];
    expect(overrideField.querySelector(".pc-maxhp-box")?.textContent).toBe("none");
  });

  it("3. rolled-set state: equation '62 rolled'; rolled shows 62 + clear mark; clicking mark calls clearRolledHp", () => {
    const es = makeEditState();
    const ctx = makeCtx({
      breakdown: {
        diceSum: 62, diceSource: "rolled", averageDiceSum: 70,
        conMod: 0, conLevels: 0, modifier: null,
        exhaustionMultiplier: 1, exhaustionLevel: 0,
        override: null, final: 62, derivedMax: 62,
      },
      editState: es,
    });
    openMaxHpModal(ctx);
    const contentEl = lastModal().contentEl;

    expect(contentEl.querySelector(".pc-maxhp-eq")?.textContent).toContain("62 rolled");

    const rolledField = contentEl.querySelectorAll(".pc-maxhp-field")[0];
    expect(rolledField.querySelector(".pc-maxhp-box")?.textContent).toBe("62");
    // hint reads "average: N" in BOTH states, not just the placeholder state.
    expect(rolledField.querySelector(".pc-maxhp-field-hint")?.textContent).toBe("average: 70");
    const mark = rolledField.querySelector(".archivist-override-mark") as HTMLElement;
    expect(mark).not.toBeNull();
    mark.click();
    expect(es.clearRolledHp).toHaveBeenCalledTimes(1);
  });

  it("4. buff + exhaustion: one term per perLevelTerms label; exhaustion term when multiplier<1; CON absent when conLevels===0", () => {
    const ctx = makeCtx({
      breakdown: {
        diceSum: 40, diceSource: "average", averageDiceSum: 40,
        conMod: 3, conLevels: 0, // conMod is nonzero but conLevels IS 0 -> CON term must be absent
        perLevelTerms: [{ label: "Tough", perLevel: 2, levels: 10, total: 20 }],
        modifier: null,
        exhaustionMultiplier: 0.5, exhaustionLevel: 4,
        override: null, final: 30, derivedMax: 30,
      },
    });
    openMaxHpModal(ctx);
    const eq = lastModal().contentEl.querySelector(".pc-maxhp-eq")!;

    expect(eq.textContent).toContain("Tough");
    expect(eq.textContent).toContain("× 0.5 (exhaustion 4)");
    expect(eq.textContent).not.toContain("CON");
  });

  it("5. override-set state: big number = override; equation carries .is-greyed", () => {
    const ctx = makeCtx({
      breakdown: {
        diceSum: 62, diceSource: "rolled", averageDiceSum: 70,
        conMod: 2, conLevels: 11,
        override: 100, final: 100, derivedMax: 84,
      },
    });
    openMaxHpModal(ctx);
    const contentEl = lastModal().contentEl;

    expect(contentEl.querySelector(".pc-maxhp-big")?.textContent).toBe("100");
    expect(contentEl.querySelector(".pc-maxhp-eq")?.classList.contains("is-greyed")).toBe(true);
  });

  it("6. field commit: clicking the rolled box swaps in input.pc-edit-inline; committing 62 calls setRolledHp(62); modifier commit of 0 calls setHpModifier(0)", () => {
    const es = makeEditState();
    const ctx = makeCtx({
      breakdown: { diceSum: 70, diceSource: "average", averageDiceSum: 70, final: 70 },
      editState: es,
    });
    openMaxHpModal(ctx);
    const contentEl = lastModal().contentEl;
    const fields = contentEl.querySelectorAll(".pc-maxhp-field");
    const rolledField = fields[0] as HTMLElement;
    const modField = fields[1] as HTMLElement;

    const rolledBox = rolledField.querySelector(".pc-maxhp-box") as HTMLElement;
    rolledBox.click();
    const rolledInput = rolledField.querySelector("input.pc-edit-inline") as HTMLInputElement;
    expect(rolledInput).not.toBeNull();
    rolledInput.value = "62";
    rolledInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(es.setRolledHp).toHaveBeenCalledWith(62);

    const modBox = modField.querySelector(".pc-maxhp-box") as HTMLElement;
    modBox.click();
    const modInput = modField.querySelector("input.pc-edit-inline") as HTMLInputElement;
    expect(modInput).not.toBeNull();
    modInput.value = "0";
    modInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(es.setHpModifier).toHaveBeenCalledWith(0);
  });

  it("7. refreshMaxHpModal with the SAME editState re-renders values (84 -> 79 visible)", () => {
    const es = makeEditState();
    const ctx1 = makeCtx({
      breakdown: { diceSum: 84, diceSource: "average", averageDiceSum: 84, final: 84, derivedMax: 84 },
      editState: es,
    });
    openMaxHpModal(ctx1);
    expect(lastModal().contentEl.querySelector(".pc-maxhp-big")?.textContent).toBe("84");

    const ctx2 = makeCtx({
      breakdown: { diceSum: 79, diceSource: "average", averageDiceSum: 79, final: 79, derivedMax: 79 },
      editState: es,
    });
    refreshMaxHpModal(ctx2);

    expect(modalInstances.length).toBe(1); // same modal instance, not re-opened
    expect(lastModal().contentEl.querySelector(".pc-maxhp-big")?.textContent).toBe("79");
  });

  it("8. refreshMaxHpModal with a DIFFERENT editState identity closes the modal", () => {
    const es1 = makeEditState();
    const ctx1 = makeCtx({ breakdown: { final: 50 }, editState: es1 });
    openMaxHpModal(ctx1);
    expect(lastModal().contentEl.children.length).toBeGreaterThan(0);

    const es2 = makeEditState();
    const ctx2 = makeCtx({ breakdown: { final: 60 }, editState: es2 });
    refreshMaxHpModal(ctx2);

    expect(modalInstances.length).toBe(1); // refresh did not construct a new modal
    expect(lastModal().contentEl.children.length).toBe(0); // onClose emptied contentEl

    // Identity guard actually severed the singleton: a fresh open now constructs
    // a brand-new modal rather than reusing/updating the closed one.
    openMaxHpModal(ctx2);
    expect(modalInstances.length).toBe(2);
  });

  it("9. closeMaxHpModal closes and unregisters the singleton (double-call safe)", () => {
    const ctx = makeCtx({ breakdown: { final: 40 } });
    openMaxHpModal(ctx);
    expect(lastModal().contentEl.children.length).toBeGreaterThan(0);

    closeMaxHpModal();
    expect(lastModal().contentEl.children.length).toBe(0);

    expect(() => closeMaxHpModal()).not.toThrow();

    // Singleton unregistered: a fresh open constructs a brand-new modal.
    const before = modalInstances.length;
    openMaxHpModal(ctx);
    expect(modalInstances.length).toBe(before + 1);
  });
});
