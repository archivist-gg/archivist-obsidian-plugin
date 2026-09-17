/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { renderCardResource } from "../packages/obsidian/src/modules/pc/components/actions/feature-rows";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { resolveFeatureResources } from "@archivist-gg/dnd5e/pc/pc.resources";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// R4-G5 G8 · BANKED ROLLS (the v7 model, docs/design/portent-banked-variants-v7).
//
// The bank is the tracker for a resource whose FEATURE carries
// `rendering_hint: prerolled-dice` and whose resource declares a `die`: the plain
// pip row is replaced by number-over-box COLUMNS (value i above box i), empty
// slots are ghost dice, and a Roll pill fills them. `feature_uses[id].used` stays
// the single usage truth (the SPENT BOUNDARY: value i is spent iff i < used) and
// `feature_rolls[id]` carries the values.
//
// The mount is the PASSIVE tab, the one working feature-row mount precedent in
// this suite; the ctx builder is tests/pc-feature-rows-effect-captions.test.ts's,
// copied (as that file copied it) so this one stands alone, plus `featureRolls`.
//
// DOM queries use `Array.from`: the repo's `lib` has no `DOM.Iterable`, so a
// spread over `querySelectorAll` is a tsc error.
// ─────────────────────────────────────────────────────────────

const FORETELLING = "wizard-2024:foretelling-roll";

const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "wizard", level: 3 }, ...extra }) as unknown as ResolvedFeature;

/** The Portent shape the vault note carries (T5): the hint sits at FEATURE level, the
 *  die on the resource. `hint: null` drops it, which is the NON-banked control. */
const portent = (o: { hint?: string | null; face?: string; resourceHint?: string } = {}): Record<string, unknown> => {
  const resource: Record<string, unknown> = {
    id: FORETELLING, name: "Foretelling Roll", max_formula: "2",
    die: { base: o.face ?? "d20" }, reset: "long-rest",
  };
  if (o.resourceHint !== undefined) resource.rendering_hint = o.resourceHint;
  const feature: Record<string, unknown> = { id: "portent", name: "Portent", resources: [resource] };
  if (o.hint !== null) feature.rendering_hint = o.hint ?? "prerolled-dice";
  return feature;
};

interface RenderOpts {
  featureUses?: Record<string, { used: number; max: number }>;
  featureRolls?: Record<string, number[]>;
  classes?: object[];
  totalLevel?: number;
  editState?: object | null;
}

function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  const ctx: ComponentRenderContext = {
    resolved: {
      definition: { equipment: [], edition: "2024" },
      race: null, classes: opts.classes ?? [{ entity: { slug: "wizard" }, level: 3 }], background: null, feats: [],
      totalLevel: opts.totalLevel ?? 3, features, pools: [],
      state: { feature_uses: opts.featureUses ?? {}, feature_rolls: opts.featureRolls ?? {}, active_buffs: [] },
    } as unknown as ResolvedCharacter,
    derived: { attacks: [], attacksPerAction: 1 } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
  (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources(features);
  return ctx;
}

/** Mount one feature on the passive tab and hand back its `.pc-feature-detail` slot. */
function detailFor(feature: object, opts: RenderOpts = {}): HTMLElement {
  const root = mountContainer();
  new PassiveFeaturesTab().render(root, renderCtx([rf(feature)], opts));
  const row = Array.from(root.querySelectorAll<HTMLElement>(".pc-feature-row")).find(
    (r) => r.querySelector(".pc-action-row-name")?.textContent === (feature as { name: string }).name,
  )!;
  return row.querySelector<HTMLElement>(".pc-feature-detail")!;
}

/** The Portent detail slot at a given bank + spent boundary. */
const bankDetail = (bank: number[], used: number, opts: RenderOpts = {}): HTMLElement =>
  detailFor(portent(), {
    featureUses: { [FORETELLING]: { used, max: 2 } },
    featureRolls: bank.length ? { [FORETELLING]: bank } : {},
    ...opts,
  });

const slots = (detail: HTMLElement): HTMLElement[] =>
  Array.from(detail.querySelectorAll<HTMLElement>(".pc-bank-slot"));
const ghosts = (detail: HTMLElement): HTMLElement[] =>
  Array.from(detail.querySelectorAll<HTMLElement>(".pc-bank-entry"));
const boxOf = (slot: HTMLElement): HTMLElement =>
  slot.querySelector<HTMLElement>(".archivist-toggle-box")!;
const isChecked = (slot: HTMLElement): boolean =>
  boxOf(slot).classList.contains("archivist-toggle-box-checked");

describe("the banked-rolls tracker (G8, v7 §Design)", () => {
  it("bank [-7,16] (the 7 SPENT) draws two number-over-box columns, the spent one grayed and checked (sign encoding)", () => {
    const detail = bankDetail([-7, 16], 1);
    const cols = slots(detail);
    expect(cols.length).toBe(2);
    expect(cols.map((s) => s.querySelector(".pc-bank-val")?.textContent)).toEqual(["7", "16"]);
    // Ruling 3: the SPENT number grays (the class the CSS colours) and keeps no other mark;
    // ruling 2: the box is the spend mark, checked iff the slot's value is NEGATIVE.
    expect(cols[0].classList.contains("pc-bank-slot-spent")).toBe(true);
    expect(isChecked(cols[0])).toBe(true);
    expect(cols[1].classList.contains("pc-bank-slot-spent")).toBe(false);
    expect(isChecked(cols[1])).toBe(false);
    // A full bank has no empty slot to ghost.
    expect(ghosts(detail).length).toBe(0);
  });

  it("the plain pip row is REPLACED by the columns, and the `/ Long Rest` caption stays (ruling 6)", () => {
    const detail = bankDetail([7, 16], 1);
    // No second set of boxes: every box on the row lives inside a bank slot.
    expect(detail.querySelectorAll(".archivist-toggle-box").length).toBe(2);
    expect(detail.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(0);
    expect(detail.querySelector(".pc-feature-track .pc-charge-recovery")?.textContent).toBe("/ Long Rest");
    // The die label keeps its shipped place, first in the slot.
    expect(detail.querySelector(".pc-resource-die")?.textContent).toBe("d20");
  });

  it("an empty slot is a GHOST DIE whose glyph is MAPPED from the resource's own face (ruling 4)", () => {
    const one = bankDetail([7], 0);
    expect(slots(one).length).toBe(1);
    expect(ghosts(one).length).toBe(1);
    expect(ghosts(one)[0].querySelector<HTMLElement>(".pc-bank-entry-glyph")!.style.getPropertyValue("--pc-bank-die-mask"))
      .toBe("var(--pc-bank-die-d20)");

    const empty = bankDetail([], 0);
    expect(slots(empty).length).toBe(0);
    expect(ghosts(empty).length).toBe(2);

    // The map is keyed on the DATA, not on Portent: a d6 resource ghosts a d6.
    const d6 = detailFor(portent({ face: "d6" }), { featureUses: { [FORETELLING]: { used: 0, max: 3 } } });
    expect(ghosts(d6).length).toBe(3);
    expect(ghosts(d6)[0].querySelector<HTMLElement>(".pc-bank-entry-glyph")!.style.getPropertyValue("--pc-bank-die-mask"))
      .toBe("var(--pc-bank-die-d6)");
  });

  it("the Roll pill reads `Roll {max}{face}` and is disabled once the bank is full (ruling 6)", () => {
    const partial = bankDetail([7], 0);
    const pill = partial.querySelector<HTMLButtonElement>(".pc-spend .pc-spend-control")!;
    expect(pill.textContent).toBe("Roll 2d20");
    expect(pill.disabled).toBe(false);
    expect(bankDetail([7, 16], 0).querySelector<HTMLButtonElement>(".pc-spend .pc-spend-control")!.disabled).toBe(true);
  });

  it("the pill's count is the RESOLVED max and its face is normalised, while the die label stays verbatim", () => {
    // The 2024 corpus spells some faces `1d20`; the label prints the data verbatim (R4-G5 §4.3.1) and
    // the pill must not read "Roll 21d20".
    const detail = detailFor(portent({ face: "1d20" }), { featureUses: { [FORETELLING]: { used: 0, max: 3 } } });
    expect(detail.querySelector(".pc-resource-die")?.textContent).toBe("1d20");
    expect(detail.querySelector(".pc-spend-control")?.textContent).toBe("Roll 3d20");
  });

  it("the pill fills every EMPTY slot with a legal roll of the resource's die and banks them whole", () => {
    const setFeatureRolls = vi.fn();
    const detail = bankDetail([7], 0, { editState: { setFeatureRolls } });
    detail.querySelector<HTMLButtonElement>(".pc-spend-control")!.click();
    expect(setFeatureRolls).toHaveBeenCalledTimes(1);
    const [id, values] = setFeatureRolls.mock.calls[0] as [string, number[]];
    expect(id).toBe(FORETELLING);
    // The banked 7 survives; one ghost was filled, and a d20 rolls 1..20.
    expect(values.length).toBe(2);
    expect(values[0]).toBe(7);
    expect(Number.isInteger(values[1])).toBe(true);
    expect(values[1]).toBeGreaterThanOrEqual(1);
    expect(values[1]).toBeLessThanOrEqual(20);
  });

  it("a box click spends/restores THAT slot through the per-index writers (ruling 7's positional pairing, sign encoding)", () => {
    const spendFeatureRoll = vi.fn();
    const restoreFeatureRoll = vi.fn();
    // The 7 is spent (negative); clicking the LIVE 16's box spends it, clicking the spent 7's
    // box restores it · and the sign is what routes the click, so a hand-edited file whose count
    // disagrees with its signs still routes each box correctly.
    const detail = bankDetail([-7, 16], 1, { editState: { spendFeatureRoll, restoreFeatureRoll } });
    const cols = slots(detail);
    boxOf(cols[1]).click();
    expect(spendFeatureRoll).toHaveBeenCalledWith(FORETELLING, 1);
    expect(restoreFeatureRoll).not.toHaveBeenCalled();
    boxOf(cols[0]).click();
    expect(restoreFeatureRoll).toHaveBeenCalledWith(FORETELLING, 0);
    expect(spendFeatureRoll).toHaveBeenCalledTimes(1);
  });

  it("clicking a number edits it in place: the bank is written back whole with that index replaced (ruling 1)", () => {
    const setFeatureRolls = vi.fn();
    const detail = bankDetail([7, 16], 1, { editState: { setFeatureRolls } });
    slots(detail)[1].querySelector<HTMLElement>(".pc-bank-val")!.click();
    const input = detail.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    expect(input.value).toBe("16");
    input.value = "12";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(setFeatureRolls).toHaveBeenCalledWith(FORETELLING, [7, 12]);
  });

  it("a SPENT number stays editable (its only spend mark is the box's X, ruling 3)", () => {
    const setFeatureRolls = vi.fn();
    const detail = bankDetail([7, 16], 1, { editState: { setFeatureRolls } });
    slots(detail)[0].querySelector<HTMLElement>(".pc-bank-val")!.click();
    const input = detail.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "3";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(setFeatureRolls).toHaveBeenCalledWith(FORETELLING, [3, 16]);
  });

  it("typing into a ghost banks the value at the first EMPTY slot, never a hole (ruling 6)", () => {
    const setFeatureRolls = vi.fn();
    const detail = bankDetail([7], 0, { editState: { setFeatureRolls } });
    ghosts(detail)[0].click();
    const input = detail.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "19";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(setFeatureRolls).toHaveBeenCalledWith(FORETELLING, [7, 19]);
  });

  it("an entry above the die's own face count clamps to it, so no impossible roll is banked", () => {
    const setFeatureRolls = vi.fn();
    const detail = bankDetail([], 0, { editState: { setFeatureRolls } });
    ghosts(detail)[0].click();
    const input = detail.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "99";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(setFeatureRolls).toHaveBeenCalledWith(FORETELLING, [20]);
  });
});

describe("the gate: only a prerolled-dice feature banks (G8 T1)", () => {
  it("RED FIRST: a resource with NO hint keeps the SHIPPED tracker, pips and all", () => {
    const detail = detailFor(portent({ hint: null }), { featureUses: { [FORETELLING]: { used: 1, max: 2 } } });
    expect(detail.querySelector(".pc-bank")).toBeNull();
    expect(detail.querySelector(".pc-spend-control")).toBeNull();
    expect(detail.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(2);
    expect(detail.querySelector(".pc-feature-track .pc-charge-recovery")?.textContent).toBe("/ Long Rest");
    expect(detail.querySelector(".pc-resource-die")?.textContent).toBe("d20");
  });

  it("some OTHER hint is not the bank's, and a banked hint with no die cannot ghost a face", () => {
    const other = detailFor(portent({ hint: "counter" }), { featureUses: { [FORETELLING]: { used: 0, max: 2 } } });
    expect(other.querySelector(".pc-bank")).toBeNull();
    expect(other.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(2);

    const dieless = { id: "portent", name: "Portent", rendering_hint: "prerolled-dice",
      resources: [{ id: FORETELLING, name: "Foretelling Roll", max_formula: "2", reset: "long-rest" }] };
    const plain = detailFor(dieless, { featureUses: { [FORETELLING]: { used: 0, max: 2 } } });
    expect(plain.querySelector(".pc-bank")).toBeNull();
    expect(plain.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(2);
  });

  it("the card site banks on the owning FEATURE's hint and keeps the shipped tracker without it", () => {
    const feature = portent();
    const resource = (feature.resources as Resource[])[0];
    const ctx = renderCtx([rf(feature)], {
      featureUses: { [FORETELLING]: { used: 1, max: 2 } },
      featureRolls: { [FORETELLING]: [7, 16] },
    });

    const banked = mountContainer();
    renderCardResource(banked, resource, ctx, "prerolled-dice");
    expect(banked.querySelectorAll(".pc-bank-slot").length).toBe(2);
    expect(banked.querySelector(".pc-card-resource-name")?.textContent).toBe("Foretelling Roll");
    expect(banked.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(0);

    const plain = mountContainer();
    renderCardResource(plain, resource, ctx);
    expect(plain.querySelector(".pc-bank")).toBeNull();
    expect(plain.querySelectorAll(".archivist-toggle-box").length).toBe(2);
  });
});
