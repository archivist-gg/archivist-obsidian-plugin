/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

// Same fixture style as pc-actions-grouping.test.ts: a resolved feature carries a
// raw `feature` object plus a `source`; the economy bucket is derived from
// `feature.action` (absent → passive, "free" → passive, "action" → actions).
const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

interface RenderOpts {
  actionsDisabled?: boolean;
}

function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      race: null, classes: [], background: null, feats: [],
      totalLevel: 5, features,
      state: { feature_uses: {} },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: [],
      attacksPerAction: 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

// A passive feature (no action cost), a free-cost feature, and an action feature.
const passiveFeat = rf({ name: "Darkvision" });                 // no action → passive
const freeFeat = rf({ name: "Free Thing", action: "free" });    // free → passive section
const actionFeat = rf({ name: "Smite", action: "action" });     // action → Actions tab

describe("PassiveFeaturesTab", () => {
  it("renders the Passive & Free Actions heading and passive/free rows, not the Actions heading", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([passiveFeat, freeFeat, actionFeat]));
    const headings = [...el.querySelectorAll(".pc-tab-heading")].map((h) => h.textContent);
    expect(headings).toContain("Passive & Free Actions");
    expect(headings).not.toContain("Actions");
    const names = [...el.querySelectorAll(".pc-action-row-name")].map((n) => n.textContent);
    expect(names).toContain("Darkvision"); // passive
    expect(names).toContain("Free Thing"); // free
    expect(names).not.toContain("Smite"); // action → stays on Actions tab
  });

  it("does not dim passive rows even when actions are disabled", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([passiveFeat, freeFeat, actionFeat], { actionsDisabled: true }));
    const row = [...el.querySelectorAll(".pc-action-row")].find(
      (r) => r.querySelector(".pc-action-row-name")?.textContent === "Darkvision",
    )!;
    expect(row.classList.contains("pc-row-disabled")).toBe(false);
  });

  it("shows the empty-state line when there are no passive or free entries", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([actionFeat])); // only an action feature
    expect(el.querySelector(".pc-empty-line")?.textContent).toBe("(No passive or free actions.)");
    expect(el.querySelectorAll(".pc-tab-heading").length).toBe(0);
  });
});
