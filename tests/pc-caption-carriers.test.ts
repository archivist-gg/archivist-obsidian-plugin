/** @vitest-environment jsdom */
/**
 * Fix round 1 (F-5) · the CARRIER SEAMS of the separated caption (spec §10.3, Q-8).
 *
 * `tests/separated-caption.test.ts` pins the primitive in isolation and `tests/pc-css-contracts-g6b.test.ts` pins the
 * CSS, but until this file NO test asserted that any carrier actually CALLS `renderSeparated`. The §14 row 26 control
 * files pin `textContent` and `title`, and the composed text is byte-identical to the pre-image BY DESIGN (invariant
 * 9), so those pins are blind by construction: reverting `charge-boxes.ts` to
 * `wrap.createDiv({ cls: "pc-charge-recovery", text: "/ " + label })` leaves the whole suite green while Q-8 silently
 * stops working on that carrier. The witness that is NOT blind is structural: the host clips (`pc-cap-host`) and the
 * separator is an out-of-flow child of a nowrap UNIT (`.pc-cap-unit > .pc-cap-sep`), which is exactly what the old
 * text-node form cannot produce.
 *
 * One leg per §10.3 carrier, each rendered through its OWN entry point with the minimal fixture that makes it emit a
 * caption. No §14 row 26 control file is touched: the ctx / fixture idioms below are COPIED from
 * `tests/pc-feature-rows-recovery.test.ts` (the feature ctx) and `tests/pc-actions-items-table.test.ts` (the
 * `ItemEntry` builder), so this file stands alone.
 *
 * DOM queries use `Array.from` rather than spread: the repo's `lib` has no `DOM.Iterable`, so
 * `[...querySelectorAll(…)]` is a tsc error.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { renderChargeBoxes } from "../packages/obsidian/src/modules/pc/components/actions/charge-boxes";
import { renderPointPool } from "../packages/obsidian/src/modules/pc/components/actions/point-pool";
import { renderMetaSub } from "../packages/obsidian/src/modules/pc/components/actions/entry-meta";
import { renderFeatureRow } from "../packages/obsidian/src/modules/pc/components/actions/feature-rows";
import { renderItemRow } from "../packages/obsidian/src/modules/pc/components/actions/items-table";
import type { ItemEntry } from "../packages/obsidian/src/modules/pc/components/actions/action-model";
import type { ItemAction } from "@archivist-gg/dnd5e/item/item.actions-map";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

/**
 * The seam assertion, identical for every carrier: the host CLIPS (`pc-cap-host`, which is what makes a separator at
 * a line start invisible) and holds at least one UNIT carrying its separator as a CHILD. A carrier that composes the
 * caption as text passes neither.
 */
function expectCarriesCaption(host: Element | null, unitSel = ".pc-cap-unit"): void {
  expect(host).not.toBeNull();
  expect(host!.classList.contains("pc-cap-host")).toBe(true);
  // The separator belongs to the unit it PRECEDES, so on a multi-part line the FIRST unit carries none (a caption
  // never opens with a mark unless the carrier asked for `leading`). The seam is the existence of a unit that owns
  // one as a child, not the first unit's shape.
  const sep = host!.querySelector(`${unitSel} > .pc-cap-sep`);
  expect(sep).not.toBeNull();
  expect(sep!.parentElement!.classList.contains("pc-cap-unit")).toBe(true);
}

/** The feature ctx of `tests/pc-feature-rows-recovery.test.ts`, minus the options no leg here uses. */
function featureCtx(features: ResolvedFeature[]): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: null, classes: [], background: null, feats: [],
      totalLevel: 5, features, pools: [],
      state: { feature_uses: {}, active_buffs: [] },
    } as unknown as ResolvedCharacter,
    derived: { attacks: [], attacksPerAction: 1, conditionEffects: undefined } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: null as never,
  };
}

const rf = (feature: object): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 } }) as unknown as ResolvedFeature;

/** The `ItemEntry` builder of `tests/pc-actions-items-table.test.ts`; `rarity` + `attuned` are the two sub parts. */
const WAND_ACTION: ItemAction = { cost: "action", range: "150 ft.", max_charges: 7 };
function itemEntry(): ItemEntry {
  return {
    index: 0,
    entry: { item: "[[wand-of-fireballs]]", equipped: true, attuned: true } as ItemEntry["entry"],
    entity: { name: "Wand of Fireballs", rarity: "very rare", actions: {} },
    entityType: "item",
    action: WAND_ACTION,
  } as ItemEntry;
}
function itemCtx(): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks: [], conditionEffects: undefined } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("every §10.3 caption carrier calls the separated-caption primitive (R4-G6b §10.3, Q-8)", () => {
  it("renderChargeBoxes' recovery caption is a unit on a clipping host", () => {
    const root = mountContainer();
    const wrap = renderChargeBoxes(root, { used: 0, max: 3, recovery: { amount: "1", label: "Long Rest" } });
    expect(wrap.classList.contains("pc-charge-boxes")).toBe(true);
    expectCarriesCaption(wrap, ".pc-charge-recovery");
    // The composed text is unchanged by the unit form, which is why the row-26 pins cannot see this seam.
    expect(wrap.querySelector(".pc-charge-recovery")?.textContent).toBe("/ Long Rest");
  });

  it("renderPointPool's reset caption is a unit on a clipping host", () => {
    const root = mountContainer();
    const wrap = renderPointPool(root, {
      id: "sorcery", name: "Sorcery Point", used: 0, max: 2, resetLabel: "Long Rest", onSet: () => {},
    });
    expect(wrap.classList.contains("pc-point-pool")).toBe(true);
    expectCarriesCaption(wrap, ".pc-point-pool-reset");
    expect(wrap.querySelector(".pc-point-pool-reset")?.textContent).toBe("· Long Rest");
  });

  it("renderMetaSub's line is a clipping host of one unit per part", () => {
    const root = mountContainer();
    renderMetaSub(root, ["Passive", "1 Sorcery Point"]);
    const sub = root.querySelector(".pc-spell-sub");
    expectCarriesCaption(sub);
    // Part one takes no separator, part two does: the mark divides the parts and never leads the line.
    expect(Array.from(sub!.querySelectorAll(".pc-cap-unit")).length).toBe(2);
    expect(sub!.querySelectorAll(".pc-cap-sep").length).toBe(1);
    expect(sub!.textContent).toBe("Passive · 1 Sorcery Point");
  });

  it("renderFeatureRow's source sub-line is a clipping host of one unit per source", () => {
    const root = mountContainer();
    const list = root.createDiv({ cls: "pc-actions-table" });
    const feature = { id: "second-wind", name: "Second Wind", description: "x" };
    // TWO sources: the row prints one label per source and the ` · ` divides them, which is the shape §10.3 is about
    // (a lone source is one unit and takes no mark at all).
    const secondary = { feature, source: { kind: "subclass", slug: "champion", level: 3 } } as unknown as ResolvedFeature;
    renderFeatureRow(list, rf(feature), featureCtx([rf(feature)]), { passive: true, merged: [secondary] });
    const sub = list.querySelector(".pc-feature-row .pc-action-row-sub");
    expectCarriesCaption(sub);
    expect(Array.from(sub!.querySelectorAll(".pc-cap-unit")).length).toBe(2);
    expect(sub!.textContent).toBe("Fighter 1 · Champion 3");
  });

  it("renderFeatureRow's buff duration caption is a unit on a clipping host", () => {
    const root = mountContainer();
    const list = root.createDiv({ cls: "pc-actions-table" });
    const feature = { id: "rage", name: "Rage", description: "x", activatable: true, duration: { amount: 1, unit: "minute" } };
    renderFeatureRow(list, rf(feature), featureCtx([rf(feature)]), { passive: true });
    expectCarriesCaption(list.querySelector(".pc-feature-row .pc-action-buff"));
    expect(list.querySelector(".pc-feature-row .pc-action-buff")?.textContent).toBe("Activate · 1 minute");
  });

  it("renderItemRow's sub-line is a clipping host of one unit per part", () => {
    const root = mountContainer();
    const list = root.createDiv({ cls: "pc-actions-table pc-items-table" });
    renderItemRow(list, itemEntry(), itemCtx());
    const sub = list.querySelector(".pc-action-row .pc-action-row-sub");
    expectCarriesCaption(sub);
    expect(Array.from(sub!.querySelectorAll(".pc-cap-unit")).length).toBe(2);
    expect(sub!.textContent).toBe("very rare · attuned");
  });
});
