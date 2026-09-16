/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ResourcesTab } from "../packages/obsidian/src/modules/pc/components/resources-tab";
import { ResourceBand } from "../packages/obsidian/src/modules/pc/components/resource-band";
import { HitDiceWidget } from "../packages/obsidian/src/modules/pc/components/hit-dice-widget";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { dieLadder } from "../packages/obsidian/src/modules/pc/components/resources/die-icon";
import { collectResourceGroups, collectBandRows } from "../packages/obsidian/src/modules/pc/components/resources/resource-model";
import { renderSpendControl } from "../packages/obsidian/src/modules/pc/components/actions/spend-control";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Resource, ResetTrigger } from "@archivist-gg/dnd5e/types/resource";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Fixtures
//
// Both surfaces read a resolved character through `resolveResourceIndex`, which
// walks `features[].feature.resources` and `pools[]`. So a fixture feature is
// `{feature: {id, name, resources: [...]}, source}` and the seeded counter lives
// in `state.feature_uses`, exactly as the resolver + seed leave them.
// ─────────────────────────────────────────────────────────────

const res = (id: string, reset: ResetTrigger, over: Partial<Resource> = {}): Resource =>
  ({ id, name: id, max_formula: "1", reset, ...over }) as Resource;

/** A class-sourced feature carrying one resource. */
const classFeat = (name: string, r: Resource): ResolvedFeature =>
  ({ feature: { id: r.id, name, resources: [{ ...r, name }] }, source: { kind: "class", slug: "fighter", level: 5 } }) as unknown as ResolvedFeature;

/** A DM grant (`character.additional_features`). */
const grant = (name: string, r: Resource): ResolvedFeature =>
  ({ feature: { id: r.id, name, resources: [{ ...r, name }] }, source: { kind: "campaign", slug: r.id } }) as unknown as ResolvedFeature;

interface CtxOpts {
  features?: ResolvedFeature[];
  featureUses?: Record<string, { used: number; max: number }>;
  hitDice?: Record<string, { used: number; total: number }>;
  equipment?: unknown[];
  editState?: object | null;
  entities?: Array<{ slug: string; entityType: string; data: unknown }>;
}

function renderCtx(opts: CtxOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: opts.equipment ?? [], edition: "2014" },
      classes: [{ entity: { slug: "fighter", name: "Fighter" }, level: 5, subclass: null }],
      race: null, background: null, feats: [], totalLevel: 5,
      features: opts.features ?? [], pools: [],
      state: {
        feature_uses: opts.featureUses ?? {},
        hit_dice: opts.hitDice ?? {},
        active_buffs: [],
      },
    } as unknown as ResolvedCharacter,
    derived: { attacks: [], attacksPerAction: 1 } as never,
    services: { entities: buildMockRegistry(opts.entities ?? []) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

/** The band mounts the SHIPPED hit-dice widget through the registry. */
function bandRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  r.register(new HitDiceWidget());
  return r;
}
const renderBand = (root: HTMLElement, ctx: ComponentRenderContext): void =>
  new ResourceBand(bandRegistry()).render(root, ctx);

/** The cell a `surface: band` resource drew. Cell 0 is ALWAYS the hit-dice
 *  widget (rider N-3-18), so a band resource is never the first cell — asserting
 *  on `.pc-rband-cell` unqualified would read the dice and pass for the wrong
 *  reason. Fails loudly rather than returning the dice cell when there is none. */
const bandResourceCell = (root: HTMLElement): Element => {
  const cells = [...root.querySelectorAll(".pc-rband-cell")];
  if (cells.length < 2) throw new Error(`expected a band-resource cell after the hit-dice one; got ${cells.length} cell(s)`);
  return cells[1];
};

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-resources-heading-label")].map((n) => n.textContent ?? "");
const rowNames = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent ?? "");
/** The heading a named row files under. */
const groupOf = (root: HTMLElement, name: string): string => {
  const row = [...root.querySelectorAll<HTMLElement>(".pc-feature-row")]
    .find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;
  let n: Element | null = row.closest(".pc-feature-list")!.previousElementSibling;
  while (n && !n.classList.contains("pc-tab-heading")) n = n.previousElementSibling;
  return n?.querySelector(".pc-resources-heading-label")?.textContent ?? "";
};
const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>(".pc-feature-row")]
    .find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;

// ─────────────────────────────────────────────────────────────
// The Resources tab — THREE groups, because a rest has two lengths
// ─────────────────────────────────────────────────────────────

describe("ResourcesTab — grouping by what a rest gives back", () => {
  const groupingCtx = () => renderCtx({
    features: [
      classFeat("Focus Shot", res("focus", "short-rest")),
      classFeat("Flash of Genius", res("flash", "long-rest")),
      classFeat("Second Wind", res("second-wind", "either")),
      classFeat("Sanity", res("sanity", "custom")),
      classFeat("Sunlit Blade", res("sunlit", "dawn")),
    ],
    featureUses: {
      focus: { used: 0, max: 2 }, flash: { used: 1, max: 6 },
      "second-wind": { used: 0, max: 1 }, sanity: { used: 19, max: 65 },
      sunlit: { used: 0, max: 3 },
    },
  });

  it("files every resource under one of THREE headings, in a fixed order", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, groupingCtx());
    expect(headings(root)).toEqual(["Short Rest", "Long Rest", "Doesn't reset"]);
    expect(groupOf(root, "Focus Shot")).toBe("Short Rest");
    expect(groupOf(root, "Flash of Genius")).toBe("Long Rest");
  });

  it("BOUNDARY `either`: short OR long rest files under Short Rest — the earliest rest that returns it", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, groupingCtx());
    expect(groupOf(root, "Second Wind")).toBe("Short Rest");
  });

  it("BOUNDARY `custom`: no rest returns it, so it files under Doesn't reset", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, groupingCtx());
    expect(groupOf(root, "Sanity")).toBe("Doesn't reset");
  });

  it("BOUNDARY the cadence triggers: `dawn` refills, but not on a REST, so it files under Doesn't reset", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, groupingCtx());
    expect(groupOf(root, "Sunlit Blade")).toBe("Doesn't reset");
    // and no cadence heading of its own survives the regroup
    expect(headings(root)).not.toContain("Dawn");
  });

  it("heads each group with its NAME and no row count (user ruling 2026-09-16)", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, groupingCtx());
    // The headings are still there, and still say what a rest gives back...
    expect(headings(root)).toEqual(["Short Rest", "Long Rest", "Doesn't reset"]);
    // ...and each carries its label and NOTHING else: no count badge, and no
    // stray text beside the name that a re-added count would show up as.
    for (const h of root.querySelectorAll(".pc-tab-heading")) {
      expect(h.querySelector(".pc-actions-section-count")).toBeNull();
      expect(h.childElementCount).toBe(1);
      expect(h.textContent).toBe(h.querySelector(".pc-resources-heading-label")?.textContent);
    }
    // The rows themselves are untouched — 2 / 1 / 2 as before, just uncounted in the head.
    expect([...root.querySelectorAll(".pc-feature-list")].map((l) => l.childElementCount)).toEqual([2, 1, 2]);
  });

  it("drops a group with no rows rather than printing a bare heading", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      features: [classFeat("Flash of Genius", res("flash", "long-rest"))],
      featureUses: { flash: { used: 0, max: 6 } },
    }));
    expect(headings(root)).toEqual(["Long Rest"]);
  });

  it("lists hit dice as a row under Short Rest, drawn by the die component", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({ hitDice: { d10: { used: 3, total: 5 } } }));
    expect(rowNames(root)).toContain("Hit Dice");
    expect(groupOf(root, "Hit Dice")).toBe("Short Rest");
    const row = rowByName(root, "Hit Dice");
    expect(row.querySelector(".pc-hd-nums-die .pc-die-icon")?.classList.contains("die-d10")).toBe(true);
    expect(row.querySelector(".pc-hd-rem")?.textContent).toBe("2");
    expect(row.querySelector(".pc-hd-tot")?.textContent).toBe("5");
    // the row's own name cell already says "Hit Dice", so the label is the face alone
    expect(row.querySelector(".pc-hd-label")?.textContent).toBe("d10");
  });

  it("lists item charges under Doesn't reset, with the item's own recovery as the caption", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      equipment: [{ item: "[[srd_item_wand-of-magic-missiles]]", equipped: true,
        state: { charges: { current: 4, max: 7 }, recovery: { amount: "1d6+1", reset: "dawn" } } }],
      entities: [{ slug: "srd_item_wand-of-magic-missiles", entityType: "item", data: { name: "Wand of Magic Missiles" } }],
    }));
    expect(groupOf(root, "Wand of Magic Missiles")).toBe("Doesn't reset");
    // 7 charges is under CHARGE_BOX_LIMIT, so the magnitude fallback keeps the pip track.
    const row = rowByName(root, "Wand of Magic Missiles");
    expect(row.querySelectorAll(".archivist-toggle-box").length).toBe(7);
    expect(row.querySelector(".pc-charge-recovery")?.textContent).toBe("/ Dawn 1d6+1");
  });

  it("lists EVERY resource, `surface: band` ones included — the tab is the complete inventory", () => {
    const ctx = renderCtx({
      features: [
        grant("Hero Points", res("hero-points", "custom", { surface: "band" })),
        classFeat("Flash of Genius", res("flash", "long-rest")),
      ],
      featureUses: { "hero-points": { used: 0, max: 3 }, flash: { used: 0, max: 6 } },
    });
    const root = mountContainer();
    new ResourcesTab().render(root, ctx);
    expect(rowNames(root)).toEqual(expect.arrayContaining(["Hero Points", "Flash of Genius"]));
    expect(collectResourceGroups(ctx).flatMap((g) => g.rows).map((r) => r.name))
      .toEqual(expect.arrayContaining(["Hero Points", "Flash of Genius"]));
  });

  it("renders the empty state when the character has nothing to spend", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx());
    expect(root.querySelector(".pc-empty-line")?.textContent).toBe("(Nothing to spend.)");
    expect(root.querySelectorAll(".pc-feature-row").length).toBe(0);
  });

  it("uses the Passive tab's three-column feature grid and renders no cost badge", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      features: [classFeat("Focus Shot", res("focus", "short-rest"))],
      featureUses: { focus: { used: 0, max: 2 } },
    }));
    expect(root.querySelector(".pc-resources-tab.pc-passive-features-tab")).not.toBeNull();
    expect(root.querySelector(".pc-cost-badge")).toBeNull();
    expect(root.querySelector(".pc-feature-badge")).toBeNull();
    expect(root.querySelector(".pc-action-caret")?.textContent).toBe("");
  });

  it("the heading says what a full reset returns, so a pip row adds no `/ reset` caption of its own", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      features: [classFeat("Focus Shot", res("focus", "long-rest"))],
      featureUses: { focus: { used: 0, max: 2 } },
    }));
    expect(root.querySelector(".pc-charge-recovery")).toBeNull();
  });

  it("a PARTIAL recovery is the one thing the heading cannot say, so it is captioned", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      features: [classFeat("Sanity", res("sanity", "custom", {
        recovery: [{ id: "sanity-trickle", name: "Regain", amount: 1, reset: "long-rest" }],
      }))],
      featureUses: { sanity: { used: 19, max: 65 } },
    }));
    expect(groupOf(root, "Sanity")).toBe("Doesn't reset");
    expect([...root.querySelectorAll(".pc-charge-recovery")].map((n) => n.textContent)).toEqual(["+1 / Long Rest"]);
  });
});

// ─────────────────────────────────────────────────────────────
// The component catalogue — hint → control
// ─────────────────────────────────────────────────────────────

describe("the component catalogue — `rendering_hint` selects the control", () => {
  const hinted = (hint: string | undefined, max: number, over: Partial<Resource> = {}) => renderCtx({
    features: [classFeat("Thing", res("r", "long-rest", { ...(hint ? { rendering_hint: hint } : {}), ...over }))],
    featureUses: { r: { used: 0, max } },
  });

  it("`counter` draws the stacked ± and a big current / total, whatever the magnitude says", () => {
    const root = mountContainer();
    // max 3 would fall to pips on magnitude alone; the hint overrules it.
    new ResourcesTab().render(root, hinted("counter", 3));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.querySelector(".pc-hd-widget .pc-hd-actions .pc-hd-plus")?.textContent).toBe("+");
    expect(root.querySelector(".pc-hd-widget .pc-hd-actions .pc-hd-minus")?.textContent).toBe("−");
    expect(root.querySelector(".pc-hd-rem")?.textContent).toBe("3");
    expect(root.querySelector(".pc-hd-sep")?.textContent).toBe(" / ");
    expect(root.querySelector(".pc-hd-tot")?.textContent).toBe("3");
  });

  it("`counter` with NO max renders a bare count — no separator, no total", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("counter", 0));
    expect(root.querySelector(".pc-hd-rem")?.textContent).toBe("0");
    expect(root.querySelector(".pc-hd-sep")).toBeNull();
    expect(root.querySelector(".pc-hd-tot")).toBeNull();
  });

  it("`die` is the counter with the face INLINE beside the number", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("die", 2, { die: { base: "d6", scaling: { "5": "d8" } } }));
    const nums = root.querySelector(".pc-hd-nums")!;
    expect(nums.classList.contains("pc-hd-nums-die")).toBe(true);
    // the icon precedes the number inside the same flex line
    expect(nums.children[0].classList.contains("pc-die-icon")).toBe(true);
    expect(nums.children[1].classList.contains("pc-hd-rem")).toBe(true);
    // level 5 resolves the scaling rung
    expect(nums.children[0].classList.contains("die-d8")).toBe(true);
  });

  it("`die` is a READOUT even on a multi-rung ladder: clicking it changes nothing", () => {
    // It used to step along the ladder. That was a false affordance — the face is
    // resolved from the owner's class level and the engine has no field for a
    // chosen rung, so a step was discarded by the next re-render. A control that
    // forgets is worse than a label.
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("die", 2, { die: { base: "d6", scaling: { "5": "d8", "11": "d10" } } }));
    const icon = root.querySelector<HTMLElement>(".pc-hd-nums-die .pc-die-icon")!;
    const face = () => [...icon.classList].find((c) => /^die-d\d+$/.test(c));
    expect(face()).toBe("die-d8");      // level 5 resolves the middle rung
    expect(icon.classList.contains("pc-die-steppable")).toBe(false);
    expect(icon.getAttribute("role")).toBeNull();
    expect(icon.getAttribute("tabindex")).toBeNull();
    icon.click();
    expect(face(), "a click must not move the face").toBe("die-d8");
  });

  it("a ONE-rung ladder is a fact, not a control: no affordance on the glyph", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("die", 2, { die: { base: "d8" } }));
    const icon = root.querySelector<HTMLElement>(".pc-die-icon")!;
    expect(icon.classList.contains("pc-die-steppable")).toBe(false);
    expect(icon.getAttribute("role")).toBeNull();
  });

  it("a pip track carries the die FACE beside it — a face is the first thing a die resource reads as", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("pips", 4, { die: { base: "d8" } }));
    const detail = root.querySelector(".pc-feature-detail")!;
    expect(detail.children[0].classList.contains("pc-die-icon")).toBe(true);
    expect(detail.children[0].classList.contains("die-d8")).toBe(true);
    expect(detail.children[1].classList.contains("pc-feature-track")).toBe(true);
    // and NOT the label: the row's own name cell already titles it
    expect(detail.querySelector(".pc-hd-label")).toBeNull();
  });

  it("`pips` draws the shipped toggle track, whatever the magnitude says", () => {
    const root = mountContainer();
    // max 40 would fall to the counter on magnitude alone; the hint overrules it.
    new ResourcesTab().render(root, hinted("pips", 40));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(40);
    expect(root.querySelector(".pc-hd-widget")).toBeNull();
  });

  it("`charge-bar` draws a track with its count beside it and NO burnt figure", () => {
    const root = mountContainer();
    const ctx = hinted("charge-bar", 100);
    ctx.resolved.state.feature_uses!.r = { used: 13, max: 100 };
    new ResourcesTab().render(root, ctx);
    const bar = root.querySelector<HTMLElement>(".pc-charge-bar")!;
    expect(bar.querySelector<HTMLElement>(".pc-charge-bar-fill")!.style.width).toBe("87%");
    expect(bar.querySelector<HTMLElement>(".pc-charge-bar-burnt")!.style.width).toBe("13%");
    expect(bar.querySelector(".pc-charge-bar-cap")?.textContent).toBe("87 of 100");
    // the hatching says how many are gone; no second figure repeats it
    expect(bar.textContent).not.toContain("13");
  });

  it("`point-pool` keeps the shipped numeric widget working", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted("point-pool", 20));
    expect(root.querySelector(".pc-point-pool-value")?.textContent).toBe("20 / 20");
  });

  it("FALLBACK: no hint, max <= 12 → pips", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted(undefined, 12));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(12);
    expect(root.querySelector(".pc-hd-widget")).toBeNull();
  });

  it("FALLBACK: no hint, max > 12 → counter", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted(undefined, 65));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.querySelector(".pc-hd-rem")?.textContent).toBe("65");
    expect(root.querySelector(".pc-hd-tot")?.textContent).toBe("65");
  });

  it("UNKNOWN HINT falls back to magnitude rather than drawing nothing", () => {
    const small = mountContainer();
    new ResourcesTab().render(small, hinted("sparkline", 4));
    expect(small.querySelectorAll(".archivist-toggle-box").length).toBe(4);

    const large = mountContainer();
    new ResourcesTab().render(large, hinted("sparkline", 40));
    expect(large.querySelector(".pc-hd-rem")?.textContent).toBe("40");
  });

  it("A PROTOTYPE KEY IS NOT A HINT: `constructor` falls back like any other unknown string", () => {
    // `rendering_hint` is a free string on converter data, so a plain index would
    // answer `constructor` with a function off Object.prototype and call it.
    const root = mountContainer();
    expect(() => new ResourcesTab().render(root, hinted("constructor", 4))).not.toThrow();
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(4);
  });

  it("the at-will sentinel is checked BEFORE the magnitude rule, so 999 never becomes `999 / 999`", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, hinted(undefined, 999));
    expect(root.querySelector(".pc-charge-at-will")?.textContent).toBe("at will");
    expect(root.querySelector(".pc-hd-widget")).toBeNull();
  });

  it("the ladder is the resource's OWN faces, ascending and de-duped", () => {
    expect(dieLadder({ base: "d6", scaling: { "5": "d8", "11": "d10", "17": "d12" } })).toEqual(["d6", "d8", "d10", "d12"]);
    expect(dieLadder({ base: "d8", scaling: { "5": "d8" } })).toEqual(["d8"]);
  });
});

// ─────────────────────────────────────────────────────────────
// Write-back: one axis, three primitives
// ─────────────────────────────────────────────────────────────

describe("counter wiring", () => {
  const sanityCtx = (editState: object | null, used = 19) => renderCtx({
    features: [classFeat("Sanity", res("sanity", "custom", { rendering_hint: "counter" }))],
    featureUses: { sanity: { used, max: 65 } },
    editState,
  });

  it("the minus button spends one use of a resource", () => {
    const setFeatureUse = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, sanityCtx({ setFeatureUse }));
    root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click();
    expect(setFeatureUse).toHaveBeenCalledWith("sanity", 20);
  });

  it("the plus button restores one use", () => {
    const setFeatureUse = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, sanityCtx({ setFeatureUse }));
    root.querySelector<HTMLButtonElement>(".pc-hd-plus")!.click();
    expect(setFeatureUse).toHaveBeenCalledWith("sanity", 18);
  });

  it("FLOOR AT 0: minus on a fully-spent resource never emits a used count above its max", () => {
    const setFeatureUse = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, sanityCtx({ setFeatureUse }, 65));
    expect(root.querySelector(".pc-hd-rem")?.textContent).toBe("0");
    root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click();
    expect(setFeatureUse).toHaveBeenCalledWith("sanity", 65);
  });

  it("hit dice spend and regain through the hit-dice writers, not feature_uses", () => {
    const spendHitDie = vi.fn();
    const restoreHitDie = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({ hitDice: { d10: { used: 1, total: 5 } }, editState: { spendHitDie, restoreHitDie } }));
    root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click();
    root.querySelector<HTMLButtonElement>(".pc-hd-plus")!.click();
    expect(spendHitDie).toHaveBeenCalledWith("d10");
    expect(restoreHitDie).toHaveBeenCalledWith("d10");
  });

  it("FLOOR AT 0: minus on the last hit die calls neither writer", () => {
    const spendHitDie = vi.fn();
    const restoreHitDie = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({ hitDice: { d10: { used: 5, total: 5 } }, editState: { spendHitDie, restoreHitDie } }));
    root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click();
    expect(spendHitDie).not.toHaveBeenCalled();
    expect(restoreHitDie).not.toHaveBeenCalled();
  });

  it("an item's pips write through setItemCharges on the ORIGINAL equipment index", () => {
    const setItemCharges = vi.fn();
    const root = mountContainer();
    new ResourcesTab().render(root, renderCtx({
      equipment: [{ item: "[[wand]]", state: { charges: { current: 7, max: 7 } } }],
      editState: { setItemCharges },
    }));
    root.querySelectorAll<HTMLElement>(".archivist-toggle-box")[1].click();
    expect(setItemCharges).toHaveBeenCalledWith(0, 2, 7);
  });

  it("renders read-only (no throw, no write) when editState is null", () => {
    const root = mountContainer();
    new ResourcesTab().render(root, sanityCtx(null, 19));
    expect(() => root.querySelector<HTMLButtonElement>(".pc-hd-minus")!.click()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// The header band
// ─────────────────────────────────────────────────────────────

describe("ResourceBand", () => {
  it("still draws the hit-dice cell for a character with NO hit dice, showing the widget's own empty state (rider N-3-18)", () => {
    // Hit dice are not optional — every class grants them — so a character with
    // none is one mid-creation, and "—" is the line that says so. Gating the cell
    // on `hasHitDice` silently removed the box from a class-less builder draft.
    const root = mountContainer();
    renderBand(root, renderCtx());
    const band = root.querySelector(".pc-rband")!;
    expect(band, "the band draws even with nothing but hit dice to say").not.toBeNull();
    expect(band.querySelectorAll(".pc-rband-cell").length).toBe(1);
    expect(band.querySelector(".pc-hd-empty")?.textContent).toBe("—");
  });

  it("a tab-only resource adds NO cell of its own — `surface` alone decides that", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [classFeat("Second Wind", res("second-wind", "short-rest"))],
      featureUses: { "second-wind": { used: 0, max: 1 } },
    }));
    // the hit-dice cell, and only it: Second Wind declares no `surface: band`
    expect(root.querySelectorAll(".pc-rband-cell").length).toBe(1);
    expect(root.textContent).not.toContain("Second Wind");
  });

  it("carries hit dice ALWAYS, as the shipped widget, in the first cell", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({ hitDice: { d8: { used: 1, total: 4 } } }));
    const band = root.querySelector(".pc-panel.pc-rband")!;
    expect(band.querySelectorAll(".pc-rband-cell").length).toBe(1);
    const hd = band.querySelector(".pc-rband-cell .pc-hd-widget")!;
    expect(hd.querySelector(".pc-hd-rem")?.textContent).toBe("3");
    expect(hd.querySelector(".pc-hd-label")?.textContent).toBe("HIT DICE · d8");
  });

  it("keeps the multiclass chip row the shipped widget draws", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({ hitDice: { d8: { used: 0, total: 3 }, d10: { used: 0, total: 2 } } }));
    expect([...root.querySelectorAll(".pc-hd-chip")].map((c) => c.textContent)).toEqual(["d8", "d10"]);
  });

  it("SURFACE:BAND — a resource whose note says `surface: band` gets a cell", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      hitDice: { d8: { used: 1, total: 4 } },
      features: [grant("Hero Points", res("hero-points", "custom", { surface: "band", rendering_hint: "counter" }))],
      featureUses: { "hero-points": { used: 1, max: 3 } },
    }));
    const cells = [...root.querySelectorAll(".pc-rband-cell")];
    expect(cells.length).toBe(2);
    expect(cells[1].querySelector(".pc-hd-label")?.textContent).toBe("Hero Points");
    expect(cells[1].querySelector(".pc-hd-rem")?.textContent).toBe("2");
    expect(cells[1].querySelector(".pc-hd-tot")?.textContent).toBe("3");
  });

  it("SURFACE:BAND — a resource with NO `surface` stays out of the band", () => {
    const ctx = renderCtx({
      features: [
        grant("Hero Points", res("hero-points", "custom", { surface: "band" })),
        grant("Greater Invisibility", res("gi", "long-rest")),
        classFeat("Second Wind", res("second-wind", "short-rest")),
      ],
      featureUses: { "hero-points": { used: 0, max: 3 }, gi: { used: 0, max: 1 }, "second-wind": { used: 0, max: 1 } },
    });
    expect(collectBandRows(ctx).map((r) => r.name)).toEqual(["Hero Points"]);
    // and `surface: "tab"` is explicit about the same thing
    const tabbed = renderCtx({
      features: [grant("Hero Points", res("hero-points", "custom", { surface: "tab" }))],
      featureUses: { "hero-points": { used: 0, max: 3 } },
    });
    expect(collectBandRows(tabbed)).toEqual([]);
  });

  it("puts a band resource in its own cell AFTER the unconditional hit-dice one", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [grant("Hero Points", res("hero-points", "custom", { surface: "band" }))],
      featureUses: { "hero-points": { used: 0, max: 3 } },
    }));
    expect(root.querySelector(".pc-rband")).not.toBeNull();
    // no multiclass chip row: this character has no hit dice at all
    expect(root.querySelector(".pc-hd-chips")).toBeNull();
    const cells = root.querySelectorAll(".pc-rband-cell");
    expect(cells.length).toBe(2);
    expect(cells[0].querySelector(".pc-hd-empty")?.textContent).toBe("—");
    expect(cells[1].querySelector(".pc-hd-label")?.textContent).toBe("Hero Points");
  });

  it("NO REST WORDING: a pips-hinted band resource prints no `/ <reset>` caption", () => {
    // The pip track's shipped tail always captions itself with the reset label,
    // which is exactly the wording the band must not carry.
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [grant("Bardic Inspiration", res("bardic", "long-rest", { surface: "band", rendering_hint: "pips" }))],
      featureUses: { bardic: { used: 1, max: 4 } },
    }));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(4);
    // the cell is NOT anonymous — four boxes in the header with no name would be
    expect(bandResourceCell(root).querySelector(".pc-hd-label")?.textContent).toBe("Bardic Inspiration");
    expect(root.querySelector(".pc-charge-recovery")).toBeNull();
    expect(root.textContent).not.toContain("Long Rest");
    expect(root.textContent).not.toContain("Rest");
  });

  it("names a bar cell too — every band cell carries its own title", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [grant("Aegis", res("aegis", "custom", { surface: "band", rendering_hint: "charge-bar" }))],
      featureUses: { aegis: { used: 13, max: 100 } },
    }));
    expect(bandResourceCell(root).querySelector(".pc-hd-label")?.textContent).toBe("Aegis");
    expect(root.querySelector(".pc-charge-bar-cap")?.textContent).toBe("87 of 100");
  });

  it("NO REST WORDING: a band resource with a partial recovery prints no recovery caption either", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [grant("Sanity", res("sanity", "custom", {
        surface: "band", rendering_hint: "counter",
        recovery: [{ id: "trickle", name: "Regain", amount: 1, reset: "long-rest" }],
      }))],
      featureUses: { sanity: { used: 19, max: 65 } },
    }));
    expect(root.querySelector(".pc-charge-recovery")).toBeNull();
    expect(root.textContent).not.toContain("Long Rest");
    // current and total, and nothing else
    expect(root.querySelector(".pc-hd-nums")?.textContent).toBe("46 / 65");
  });

  it("names the resource AND its face in a band cell's label — the cell has no other title", () => {
    const root = mountContainer();
    renderBand(root, renderCtx({
      features: [grant("Psychic Die", res("psychic", "custom", { surface: "band", rendering_hint: "die", die: { base: "d8" } }))],
      featureUses: { psychic: { used: 0, max: 2 } },
    }));
    expect(bandResourceCell(root).querySelector(".pc-hd-label")?.textContent).toBe("Psychic Die · d8");
  });

  it("degrades to the shared '(No renderer …)' line when hit-dice-widget is unregistered", () => {
    const root = mountContainer();
    new ResourceBand(new ComponentRegistry()).render(root, renderCtx({ hitDice: { d8: { used: 0, total: 3 } } }));
    expect(root.querySelector(".pc-empty-line")?.textContent).toBe("(No renderer for hit-dice-widget)");
  });
});

// ─────────────────────────────────────────────────────────────
// The one-line range spend
// ─────────────────────────────────────────────────────────────

describe("renderSpendControl — the range branch", () => {
  const aegis = {
    feature: { id: "aegis", name: "Aegis of the Hundred", resources: [{ id: "aegis:charges", name: "Charges", max_formula: "100", reset: "custom" }] },
    source: { kind: "class", slug: "fighter", level: 5 },
  } as unknown as ResolvedFeature;

  const spendCtx = (spendFeatureUse = vi.fn(), used = 13) => {
    const ctx = renderCtx({ features: [aegis], featureUses: { "aegis:charges": { used, max: 100 } }, editState: { spendFeatureUse } });
    (ctx.resolved as { resources?: unknown }).resources = new Map();
    return { ctx, spendFeatureUse };
  };

  it("does NOT fire when amount_max is absent — the shipped single-amount button is untouched", () => {
    const host = mountContainer();
    const { ctx } = spendCtx();
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 1 }, ctx });
    expect(host.querySelector(".pc-step")).toBeNull();
    expect(host.querySelector(".pc-charge-bar")).toBeNull();
    expect(host.querySelector(".pc-spend-control")?.textContent).toBe("Spend 1 aegis:charges");
  });

  it("does NOT fire when amount_max EQUALS amount — there is no range to pick from", () => {
    const host = mountContainer();
    const { ctx } = spendCtx();
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 3, amount_max: 3 }, ctx });
    expect(host.querySelector(".pc-step")).toBeNull();
    expect(host.querySelector(".pc-spend-control")?.textContent).toBe("Spend 3 aegis:charges");
  });

  it("FIRES when amount_max > amount: stepper, bare Spend pill, and an inline bar on ONE line", () => {
    const host = mountContainer();
    const { ctx } = spendCtx();
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 1, amount_max: 87 }, ctx });
    const wrap = host.querySelector(".pc-spend.pc-spend-range")!;
    expect([...wrap.children].map((c) => c.className.split(" ")[0]))
      .toEqual(["pc-step", "pc-spend-control", "pc-charge-bar"]);
    expect(wrap.querySelector(".pc-spend-control")?.textContent).toBe("Spend");
    expect(wrap.querySelector(".pc-step-minus")?.textContent).toBe("−");
    expect(wrap.querySelector(".pc-step-plus")?.textContent).toBe("+");
    expect(wrap.querySelector<HTMLInputElement>(".pc-step-input")!.value).toBe("1");
    // the bar carries the count beside it and no burnt figure
    expect(wrap.querySelector(".pc-charge-bar-cap")?.textContent).toBe("87 of 100");
    expect(wrap.querySelector(".pc-charge-bar")?.classList.contains("pc-charge-bar-inline")).toBe(true);
  });

  it("the stepper moves the quantity, previews it on the bar, and hands it to spendFeatureUse", () => {
    const host = mountContainer();
    const { ctx, spendFeatureUse } = spendCtx();
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 1, amount_max: 87 }, ctx });
    const inc = host.querySelector<HTMLButtonElement>(".pc-step-plus")!;
    inc.click(); inc.click(); inc.click(); inc.click();
    expect(host.querySelector<HTMLInputElement>(".pc-step-input")!.value).toBe("5");
    // 87 left, 5 pending → 82 committed + 5 pending + 13 spent
    expect(host.querySelector<HTMLElement>(".pc-charge-bar-fill")!.style.width).toBe("82%");
    expect(host.querySelector<HTMLElement>(".pc-charge-bar-pending")!.style.width).toBe("5%");
    expect(host.querySelector<HTMLElement>(".pc-charge-bar-burnt")!.style.width).toBe("13%");
    host.querySelector<HTMLButtonElement>(".pc-spend-control")!.click();
    expect(spendFeatureUse).toHaveBeenCalledWith("aegis:charges", 5);
  });

  it("the stepper cannot leave the declared range, nor offer more than is left", () => {
    const host = mountContainer();
    const { ctx } = spendCtx(vi.fn(), 96);   // 4 left
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 2, amount_max: 87 }, ctx });
    const field = host.querySelector<HTMLInputElement>(".pc-step-input")!;
    const dec = host.querySelector<HTMLButtonElement>(".pc-step-minus")!;
    const inc = host.querySelector<HTMLButtonElement>(".pc-step-plus")!;
    expect(field.value).toBe("2");
    expect(dec.disabled).toBe(true);           // already at the floor
    inc.click(); inc.click(); inc.click();
    expect(field.value).toBe("4");             // 4 remain, not 5, and never 87
    expect(inc.disabled).toBe(true);
  });

  it("typing a value out of range is clamped rather than spent", () => {
    const host = mountContainer();
    const { ctx, spendFeatureUse } = spendCtx();
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 1, amount_max: 10 }, ctx });
    const field = host.querySelector<HTMLInputElement>(".pc-step-input")!;
    field.value = "999";
    field.dispatchEvent(new Event("input"));
    expect(field.value).toBe("10");
    host.querySelector<HTMLButtonElement>(".pc-spend-control")!.click();
    expect(spendFeatureUse).toHaveBeenCalledWith("aegis:charges", 10);
  });

  it("an exhausted resource disables the whole control instead of offering a zero spend", () => {
    const host = mountContainer();
    const { ctx, spendFeatureUse } = spendCtx(vi.fn(), 100);
    renderSpendControl(host, { consumes: { resource: "aegis:charges", amount: 1, amount_max: 87 }, ctx });
    expect(host.querySelector<HTMLButtonElement>(".pc-spend-control")!.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>(".pc-step-input")!.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>(".pc-spend-control")!.click();
    expect(spendFeatureUse).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// CSS contract
//
// jsdom does no layout, so a reflowed row and a one-line row are
// indistinguishable to this suite, and a mask image paints nothing at all.
// The partials' own text is the contract — the shape
// `tests/pc-css-contracts-g7.test.ts` established.
// ─────────────────────────────────────────────────────────────

describe("CSS contracts", () => {
  const partial = (name: string): string =>
    readFileSync(join(__dirname, "..", "packages", "obsidian", "src", "modules", "pc", "styles", name), "utf8");
  const resources = partial("resources.css");
  const dice = partial("dice-icons.css");

  it("the band is ONE panel whose cells are divided by a hairline", () => {
    expect(resources).toMatch(/\.pc-rband-cell \+ \.pc-rband-cell \{\s*border-left: 1px solid var\(--pc-tan\);/);
  });

  it("a component dropped into the band sheds its own chrome — the band IS the panel", () => {
    expect(resources).toContain(".archivist-pc-sheet .pc-rband .pc-panel,\n.archivist-pc-sheet .pc-rband .pc-hd-widget {");
    for (const decl of ["border: none", "background: transparent", "box-shadow: none", "padding: 0", "min-width: 0"]) {
      expect(resources.slice(resources.indexOf(".pc-rband .pc-hd-widget {"))).toContain(decl);
    }
  });

  it("gives the whole row to a counter cluster and to a charge bar below 787px", () => {
    // actions.css's own 787px rule names only `.pc-spend`, `.pc-buff-group` and
    // `.pc-feature-track`. A counter and a bare bar match NONE of those, so
    // without these selectors half this tab's rows would reflow and half not.
    expect(resources).toMatch(/@container pc-content \(max-width: 787px\)/);
    for (const cluster of [".pc-hd-widget", ".pc-charge-bar"]) {
      expect(resources).toContain(
        `.archivist-pc-sheet .pc-resources-tab .pc-feature-list .pc-feature-row:has(> .pc-feature-detail > ${cluster})`,
      );
      expect(resources).toContain(
        `.archivist-pc-sheet .pc-resources-tab .pc-feature-list .pc-feature-row:has(> .pc-feature-detail > ${cluster}) > .pc-feature-detail`,
      );
    }
  });

  it("the rows are not clickable, because no expand card sits behind them", () => {
    expect(resources).toMatch(/\.pc-resources-tab \.pc-action-row \{\s*cursor: default;/);
  });

  it("the die faces are MASKS, so they take currentColor like every other glyph", () => {
    expect(dice).toMatch(/\.pc-die-icon \{[^}]*background-color: currentColor;/);
    expect(dice).toMatch(/\.pc-die-icon \{[^}]*mask-size: contain;/);
    expect(dice).toMatch(/\.pc-die-lg \{\s*width: 40px;\s*height: 40px;/);
  });

  it("ships one mask per face, d4 to d20, each data URI carried ONCE", () => {
    for (const face of ["d4", "d6", "d8", "d10", "d12", "d20"]) {
      // The artwork rides `--pc-die-mask`; `.pc-die-icon` spends it through both
      // the prefixed and the standard property. Writing it into each property
      // directly shipped every die twice — 107 KB of stylesheet for 40 KB of art.
      expect(dice).toMatch(new RegExp(`\\.die-${face}\\s*\\{--pc-die-mask:url\\('data:image/png;base64,`));
    }
    expect(dice.match(/data:image\/png;base64,/g)?.length,
      "six faces, one data URI each — a second copy per die is the bug this replaced").toBe(6);
    expect(dice).toMatch(/\.pc-die-icon \{[^}]*-webkit-mask-image: var\(--pc-die-mask\);/);
    expect(dice).toMatch(/\.pc-die-icon \{[^}]*[^-]mask-image: var\(--pc-die-mask\);/);
  });

  it("the die face sits BESIDE the number, centred against it", () => {
    expect(resources).toMatch(/\.pc-hd-nums-die \{\s*display: flex;\s*align-items: center;\s*justify-content: center;\s*gap: var\(--pc-space-2\);/);
  });

  it("the inline bar puts its count beside the track, not under it", () => {
    expect(resources).toMatch(/\.pc-charge-bar-inline \{\s*flex-direction: row;/);
  });
});
