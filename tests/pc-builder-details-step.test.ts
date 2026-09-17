/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDetailsStep } from "../packages/obsidian/src/modules/pc/components/builder/details-step";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function mkCtx(over: {
  name?: string;
  alignment?: string | null;
  age?: string | null;
  editState?: unknown;
  bag?: Map<string, unknown>;
} = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: {
        name: over.name ?? "T",
        alignment: over.alignment ?? undefined,
        age: over.age ?? undefined,
        class: [],
      },
    },
    derived: {},
    editState: over.editState ?? null,
    builderUiState: over.bag ?? new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderDetailsStep", () => {
  it("renders Name input prefilled, 3×3 alignment grid, Age input", () => {
    const body = mountContainer();
    renderDetailsStep(body, mkCtx());
    const nameInput = body.querySelector<HTMLInputElement>(".pc-binp");
    expect(nameInput?.value).toBe("T");

    const cells = [...body.querySelectorAll(".pc-bal")];
    expect(cells.length).toBe(9);
    const order = cells.map((c) => c.querySelector(".pc-bal-ab")?.textContent);
    expect(order).toEqual(["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"]);

    expect(body.querySelector(".pc-bage input")).not.toBeNull();
  });

  it("name input commits on change via setName", () => {
    const setName = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setName } }));
    const nameInput = body.querySelector<HTMLInputElement>(".pc-binp")!;
    nameInput.value = "Valeria";
    nameInput.dispatchEvent(new Event("change"));
    expect(setName).toHaveBeenCalledWith("Valeria");
  });

  it("alignment cell click writes the full alignment text; clicking the active cell clears", () => {
    const setAlignment = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setAlignment } }));
    const cg = [...body.querySelectorAll<HTMLElement>(".pc-bal")].find(
      (c) => c.querySelector(".pc-bal-ab")?.textContent === "CG",
    )!;
    cg.click();
    expect(setAlignment).toHaveBeenCalledWith("Chaotic Good");

    // With alignment already "Chaotic Good", CG carries .on and re-click clears.
    const body2 = mountContainer();
    const setAlignment2 = vi.fn();
    renderDetailsStep(body2, mkCtx({ alignment: "Chaotic Good", editState: { setAlignment: setAlignment2 } }));
    const cg2 = [...body2.querySelectorAll<HTMLElement>(".pc-bal")].find(
      (c) => c.querySelector(".pc-bal-ab")?.textContent === "CG",
    )!;
    expect(cg2.classList.contains("on")).toBe(true);
    cg2.click();
    expect(setAlignment2).toHaveBeenCalledWith(null);
  });

  it("age input commits via setAge; empty commits null", () => {
    const setAge = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setAge } }));
    const age = body.querySelector<HTMLInputElement>(".pc-bage input")!;
    age.value = "26";
    age.dispatchEvent(new Event("change"));
    expect(setAge).toHaveBeenCalledWith("26");

    age.value = "";
    age.dispatchEvent(new Event("change"));
    expect(setAge).toHaveBeenCalledWith(null);
  });
});

describe("renderDetailsStep — hit points, three modes (R5 redesign)", () => {
  function mkHpCtx(over: {
    bag?: Map<string, unknown>;
    editState?: unknown;
    breakdown?: Record<string, unknown>;
  } = {}): ComponentRenderContext {
    const breakdown = {
      diceSum: 30, diceSource: "average", averageDiceSum: 30,
      conMod: 1, conLevels: 1, clampApplied: false,
      perLevelTerms: [{ label: "Durable feat", perLevel: 2, levels: 1, total: 2 }],
      modifier: null, exhaustionMultiplier: 1, exhaustionLevel: 0,
      derivedMax: 33, override: null, final: 33,
      ...over.breakdown,
    };
    return {
      resolved: { definition: { name: "T", class: [] } },
      derived: { hpBreakdown: breakdown, hp: { max: 33 } },
      editState: over.editState ?? null,
      builderUiState: over.bag ?? new Map(),
    } as unknown as ComponentRenderContext;
  }

  it("renders the HP field-card: big number, equation terms, Average selected by default, the first-level-max hint", () => {
    const body = mountContainer();
    renderDetailsStep(body, mkHpCtx());
    const card = body.querySelector(".pc-bhp");
    expect(card).not.toBeNull();
    expect(card.querySelector(".pc-bhp-big")?.textContent).toBe("33");
    const terms = [...card.querySelectorAll(".pc-bhp-term")].map((t) => t.textContent);
    expect(terms.some((t) => t.includes("d6"))).toBe(false); // no dice context in this fixture
    expect(terms.some((t) => t.includes("CON"))).toBe(true);
    expect(terms.some((t) => t.includes("Durable"))).toBe(true);
    const segs = [...card.querySelectorAll(".pc-bseg-opt")].map((b) => ({ t: b.textContent, on: b.classList.contains("on") }));
    expect(segs).toEqual([{ t: "Average", on: true }, { t: "Rolled", on: false }, { t: "Override", on: false }]);
    expect(card.querySelector(".pc-bhint")?.textContent).toContain("average");
  });

  it("Rolled shows the input, writes hp.rolled through setRolledHp, keeps the average as the ghost", () => {
    const setRolledHp = vi.fn();
    const bag = new Map<string, unknown>();
    const body = mountContainer();
    renderDetailsStep(body, mkHpCtx({ bag, editState: { setRolledHp } }));
    const rolled = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Rolled")!;
    rolled.click();
    expect(setRolledHp).toHaveBeenCalledWith(30);
    const input = body.querySelector<HTMLInputElement>(".pc-bhp input[type=number]");
    expect(input).not.toBeNull();
    expect(input.value).toBe("30"); // seeded with the average as the starting point
    input.value = "38";
    input.dispatchEvent(new Event("change"));
    expect(setRolledHp).toHaveBeenCalledWith(38);
    expect(bag.get("builder.details.hp")).toMatchObject({ mode: "rolled" });
  });

  it("Override writes overrides.hp.max via setMaxHpOverride and the equation grays", () => {
    const setMaxHpOverride = vi.fn();
    const bag = new Map<string, unknown>();
    const body = mountContainer();
    renderDetailsStep(body, mkHpCtx({ bag, editState: { setMaxHpOverride } }));
    const over = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Override")!;
    over.click();
    expect(setMaxHpOverride).toHaveBeenCalledWith(33);
    expect(body.querySelector(".pc-bhp-eq")?.classList.contains("is-greyed")).toBe(true);
    const input = body.querySelector<HTMLInputElement>(".pc-bhp input[type=number]")!;
    input.value = "45";
    input.dispatchEvent(new Event("change"));
    expect(setMaxHpOverride).toHaveBeenCalledWith(45);
  });

  it("switching back to Average clears what the other modes wrote", () => {
    const clearRolledHp = vi.fn();
    const clearMaxHpOverride = vi.fn();
    const setRolledHp = vi.fn();
    const setMaxHpOverride = vi.fn();
    const bag = new Map<string, unknown>();
    const body = mountContainer();
    renderDetailsStep(body, mkHpCtx({ bag, editState: { clearRolledHp, clearMaxHpOverride, setRolledHp, setMaxHpOverride } }));
    const rolled = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Rolled")!;
    rolled.click();
    const over = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Override")!;
    over.click();
    const avg = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Average")!;
    avg.click();
    expect(clearRolledHp).toHaveBeenCalled();
    expect(clearMaxHpOverride).toHaveBeenCalled();
    expect(body.querySelector(".pc-bhp input[type=number]")).toBeNull();
  });

  it("recovers the saved mode from derived HP when the session bag is reset", () => {
    const rolled = mountContainer();
    renderDetailsStep(rolled, mkHpCtx({ breakdown: { diceSource: "rolled", diceSum: 38, final: 41 } }));
    expect(rolled.querySelector(".pc-bseg-opt.on")?.textContent).toBe("Rolled");
    expect(rolled.querySelector<HTMLInputElement>(".pc-bhp-input")?.value).toBe("38");

    const override = mountContainer();
    renderDetailsStep(override, mkHpCtx({ breakdown: { override: 45, final: 45 } }));
    expect(override.querySelector(".pc-bseg-opt.on")?.textContent).toBe("Override");
    expect(override.querySelector<HTMLInputElement>(".pc-bhp-input")?.value).toBe("45");
  });
});
