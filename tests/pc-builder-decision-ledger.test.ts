/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderDecisionLedger } from "../src/modules/pc/components/builder/decision-ledger";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import type { DecisionItem, DecisionLedger } from "../src/modules/pc/pc.decision-engine";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";
import type { Choice } from "../src/shared/types/choice";

beforeAll(() => installObsidianDomHelpers());

interface FakeEditState {
  setChoice: ReturnType<typeof vi.fn>;
  setSubclass: ReturnType<typeof vi.fn>;
  setOriginChoice: ReturnType<typeof vi.fn>;
}

function fakeEditState(): FakeEditState {
  return { setChoice: vi.fn(), setSubclass: vi.fn(), setOriginChoice: vi.fn() };
}

function fakeCtx(bag: Map<string, unknown>, es: FakeEditState): ComponentRenderContext {
  return {
    core: {
      plugin: {},
      entities: { search: () => [] },
      compendiums: { getAll: () => [] },
      modules: { getByEntityType: () => undefined },
    },
    editState: es as unknown as CharacterEditState,
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

const entity = (slug: string, name: string): RegisteredEntity => ({
  slug, name, entityType: "subclass", filePath: `${slug}.md`,
  data: { name, edition: "2024" }, compendium: "SRD 2024", readonly: true, homebrew: false,
});

/** Build a single-class ledger from a flat list of items grouped by their level. */
function ledgerOf(items: DecisionItem[], classIndex = 0): DecisionLedger {
  const byLevel = new Map<number, DecisionItem[]>();
  for (const it of items) {
    const arr = byLevel.get(it.level) ?? [];
    arr.push(it);
    byLevel.set(it.level, arr);
  }
  const levels = [...byLevel.entries()].sort(([a], [b]) => a - b).map(([level, its]) => ({ level, items: its }));
  return { classes: [{ classIndex, levels }], origin: [] };
}

// ── item factories ──────────────────────────────────────────────────────────

function inlineItem(over: Partial<DecisionItem> = {}): DecisionItem {
  const choice: Choice = {
    kind: "select-inline", id: "fstyle", label: "Fighting Style", count: 1,
    options: [{ value: "archery", label: "Archery" }, { value: "defense", label: "Defense" }],
  };
  return {
    key: "fstyle", source: { kind: "class", slug: "srd-2024_fighter", level: 1 }, level: 1,
    featureName: "Fighting Style", choice,
    options: [{ value: "archery", label: "Archery" }, { value: "defense", label: "Defense" }],
    selected: undefined, status: "unresolved", ...over,
  };
}

function subclassItem(selected?: string): DecisionItem {
  const choice: Choice = { kind: "select-entity", id: "subclass", entity_type: "subclass" };
  return {
    key: "subclass", source: { kind: "class", slug: "srd-2024_fighter", level: 3 }, level: 3,
    featureName: "Martial Archetype", choice,
    options: [
      { value: "srd-2024_champion", label: "Champion", entity: entity("srd-2024_champion", "Champion") },
      { value: "srd-2024_battle-master", label: "Battle Master", entity: entity("srd-2024_battle-master", "Battle Master") },
    ],
    selected, status: selected ? "resolved" : "unresolved",
  };
}

function abilityItem(selected?: Record<string, number>): DecisionItem {
  const choice: Choice = { kind: "ability-points", id: "asi", label: "Ability Score Improvement", points: 2, max_per: 1 };
  return {
    key: "asi", source: { kind: "class", slug: "srd-2024_fighter", level: 4 }, level: 4,
    featureName: "Ability Score Improvement", choice,
    options: [
      { value: "str", label: "STR" }, { value: "dex", label: "DEX" }, { value: "con", label: "CON" },
      { value: "int", label: "INT" }, { value: "wis", label: "WIS" }, { value: "cha", label: "CHA" },
    ],
    selected, status: selected ? "resolved" : "unresolved",
  };
}

const opts = { classIndex: 0, stateKey: "ledger" };

describe("renderDecisionLedger", () => {
  it("groups items by level with a 'Level N' header per level", () => {
    const root = mountContainer();
    const ledger = ledgerOf([
      inlineItem(),
      subclassItem(),
    ]);
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger, ...opts });
    const levels = [...root.querySelectorAll(".pc-bledger-level")];
    expect(levels.length).toBe(2);
    const headers = levels.map((l) => l.querySelector(".pc-bledger-level-h")?.textContent);
    expect(headers).toEqual(["Level 1", "Level 3"]);
  });

  it("renders the empty state when the class has no levels", () => {
    const root = mountContainer();
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: { classes: [], origin: [] }, ...opts });
    expect(root.querySelector(".pc-bledger-empty")).not.toBeNull();
  });

  it("renders an unresolved item as an open .req item with the N1 callout inside", () => {
    const root = mountContainer();
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([inlineItem()]), ...opts });
    const item = root.querySelector(".pc-bledger-item");
    expect(item).not.toBeNull();
    expect(item!.classList.contains("open")).toBe(true);
    expect(item!.classList.contains("req")).toBe(true);
    expect(item!.querySelector(".pc-bchoice")).not.toBeNull();
    expect(item!.querySelector(".pc-bchoice-flag")?.textContent).toBe("!");
  });

  it("collapses a resolved item to a .pc-bledger-done row with check + label + summary", () => {
    const root = mountContainer();
    const item = inlineItem({ selected: "archery", status: "resolved" });
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([item]), ...opts });
    const done = root.querySelector(".pc-bledger-done");
    expect(done).not.toBeNull();
    expect(done!.querySelector(".pc-bledger-done-check")?.textContent).toBe("✓");
    expect(done!.querySelector(".pc-bledger-done-label")?.textContent).toBe("Fighting Style");
    expect(done!.querySelector(".pc-bledger-done-value")?.textContent).toBe("Archery");
    expect(root.querySelector(".pc-bledger-item.open")).toBeNull();
  });

  it("reopens a resolved item on click, storing the open flag in builderUiState", () => {
    const root = mountContainer();
    const bag = new Map<string, unknown>();
    const item = inlineItem({ selected: "archery", status: "resolved" });
    renderDecisionLedger(root, fakeCtx(bag, fakeEditState()), { ledger: ledgerOf([item]), ...opts });
    root.querySelector<HTMLElement>(".pc-bledger-done")!.click();
    expect((bag.get("ledger.open") as Set<string>).has("1:fstyle")).toBe(true);
    // After reopen the callout is visible and the done row is gone.
    expect(root.querySelector(".pc-bledger-item.open")).not.toBeNull();
    expect(root.querySelector(".pc-bledger-done")).toBeNull();
  });

  it("dispatches a no-`from` select-entity to the selection table", () => {
    const root = mountContainer();
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([subclassItem()]), ...opts });
    expect(root.querySelector(".pc-btable")).not.toBeNull();
    // one row per resolved candidate entity
    expect(root.querySelectorAll(".pc-btable-row").length).toBe(2);
  });

  it("subclass select-entity writes via setSubclass with the picked slug", () => {
    const root = mountContainer();
    const es = fakeEditState();
    renderDecisionLedger(root, fakeCtx(new Map(), es), { ledger: ledgerOf([subclassItem()]), ...opts });
    const row = [...root.querySelectorAll<HTMLElement>(".pc-btable-row")]
      .find((r) => r.querySelector(".pc-btable-name")?.textContent === "Champion")!;
    row.querySelector<HTMLElement>(".pc-btoggle")!.click();
    expect(es.setSubclass).toHaveBeenCalledWith(0, "srd-2024_champion");
    expect(es.setChoice).not.toHaveBeenCalled();
  });

  it("renders nested children under a resolved select-inline parent", () => {
    const root = mountContainer();
    const child = inlineItem({
      key: "subchoice", featureName: "Maneuvers",
      choice: { kind: "select-inline", id: "subchoice", label: "Maneuver", count: 1, options: [{ value: "trip", label: "Trip" }] },
      options: [{ value: "trip", label: "Trip" }], selected: undefined, status: "unresolved",
    });
    const parent = inlineItem({ selected: "defense", status: "partial", children: [child] });
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([parent]), ...opts });
    // partial parent stays open; the child callout is nested inside
    const callouts = root.querySelectorAll(".pc-bchoice-label");
    const labels = [...callouts].map((c) => c.textContent);
    expect(labels).toContain("Maneuver");
  });

  it("renders missing options inert and fires no write when clicked", () => {
    const root = mountContainer();
    const es = fakeEditState();
    const choice: Choice = {
      kind: "select-entity", id: "invocation", label: "Eldritch Invocation", count: 1,
      entity_type: "feature", from: ["agonizing-blast", "ghost-walk"],
    };
    const item: DecisionItem = {
      key: "invocation", source: { kind: "class", slug: "srd-2024_warlock", level: 2 }, level: 2,
      featureName: "Eldritch Invocations", choice,
      options: [
        { value: "agonizing-blast", label: "Agonizing Blast", entity: entity("agonizing-blast", "Agonizing Blast") },
        { value: "ghost-walk", label: "Ghost Walk", missing: true },
      ],
      selected: undefined, status: "unresolved",
    };
    renderDecisionLedger(root, fakeCtx(new Map(), es), { ledger: ledgerOf([item]), ...opts });
    const inert = [...root.querySelectorAll<HTMLElement>(".pc-bchoice-chip.inert")];
    expect(inert.length).toBe(1);
    expect(inert[0].textContent).toContain("Ghost Walk");
    inert[0].click();
    expect(es.setChoice).not.toHaveBeenCalled();
  });

  it("renders an informational item from featureName and never reads its choice", () => {
    const root = mountContainer();
    const item: DecisionItem = {
      key: "second-wind", source: { kind: "class", slug: "srd-2024_fighter", level: 1 }, level: 1,
      featureName: "Second Wind",
      // sentinel choice — the renderer must never read this:
      choice: { kind: "select-inline", id: "second-wind", options: [{ value: "_", label: "_" }] },
      options: [], selected: undefined, status: "informational",
    };
    renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([item]), ...opts });
    const info = root.querySelector(".pc-bledger-info");
    expect(info).not.toBeNull();
    expect(info!.querySelector(".pc-bledger-info-name")?.textContent).toBe("Second Wind");
    // The sentinel option "_" must not surface anywhere.
    expect(root.querySelector(".pc-bchoice")).toBeNull();
    expect(root.textContent).not.toContain("_");
  });

  describe("ability-points pool", () => {
    it("renders a −/+ row per pool ability with the running points-left count", () => {
      const root = mountContainer();
      renderDecisionLedger(root, fakeCtx(new Map(), fakeEditState()), { ledger: ledgerOf([abilityItem()]), ...opts });
      expect(root.querySelectorAll(".pc-bpoints-cell").length).toBe(6);
      expect(root.querySelector(".pc-bpoints-left")?.textContent).toContain("2");
    });

    it("clicking + writes the updated allocation via setChoice", () => {
      const root = mountContainer();
      const es = fakeEditState();
      renderDecisionLedger(root, fakeCtx(new Map(), es), { ledger: ledgerOf([abilityItem()]), ...opts });
      const strCell = [...root.querySelectorAll<HTMLElement>(".pc-bpoints-cell")]
        .find((c) => c.querySelector(".pc-bpoints-ab")?.textContent === "STR")!;
      strCell.querySelectorAll<HTMLButtonElement>(".pc-bpoints-btn")[1].click(); // the "+" button
      expect(es.setChoice).toHaveBeenCalledWith(0, 4, "asi", { str: 1 });
    });

    it("disables + at the points-spent cap", () => {
      const root = mountContainer();
      // points: 2, max_per: 2 so the cap that bites is total points (str already 2)
      const choice: Choice = { kind: "ability-points", id: "asi", label: "ASI", points: 2, max_per: 2 };
      const item: DecisionItem = {
        ...abilityItem({ str: 2 }), choice, status: "resolved",
      };
      // keep it open so the control (not the done row) renders
      const bag = new Map<string, unknown>();
      bag.set("ledger.open", new Set(["4:asi"]));
      renderDecisionLedger(root, fakeCtx(bag, fakeEditState()), { ledger: ledgerOf([item]), ...opts });
      const dexCell = [...root.querySelectorAll<HTMLElement>(".pc-bpoints-cell")]
        .find((c) => c.querySelector(".pc-bpoints-ab")?.textContent === "DEX")!;
      const plus = dexCell.querySelectorAll<HTMLButtonElement>(".pc-bpoints-btn")[1];
      expect(plus.disabled).toBe(true); // no points left
    });

    it("disables + at the per-ability max_per cap even with points left", () => {
      const root = mountContainer();
      // points: 3, max_per: 1, str already at 1 → str's + disabled but others enabled
      const choice: Choice = { kind: "ability-points", id: "asi", label: "ASI", points: 3, max_per: 1 };
      const item: DecisionItem = { ...abilityItem({ str: 1 }), choice, status: "partial" };
      const bag = new Map<string, unknown>();
      bag.set("ledger.open", new Set(["4:asi"]));
      renderDecisionLedger(root, fakeCtx(bag, fakeEditState()), { ledger: ledgerOf([item]), ...opts });
      const cellFor = (ab: string) => [...root.querySelectorAll<HTMLElement>(".pc-bpoints-cell")]
        .find((c) => c.querySelector(".pc-bpoints-ab")?.textContent === ab)!;
      const strPlus = cellFor("STR").querySelectorAll<HTMLButtonElement>(".pc-bpoints-btn")[1];
      const dexPlus = cellFor("DEX").querySelectorAll<HTMLButtonElement>(".pc-bpoints-btn")[1];
      expect(strPlus.disabled).toBe(true);  // max_per reached for str
      expect(dexPlus.disabled).toBe(false); // points remain and dex below max_per
    });
  });

  it("writes origin-sourced (race/background) items via setOriginChoice", () => {
    const root = mountContainer();
    const es = fakeEditState();
    const choice: Choice = {
      kind: "select-proficiency", id: "lang", label: "Languages", count: 1, domain: "language",
      from: ["elvish", "dwarvish"],
    };
    const item: DecisionItem = {
      key: "lang", source: { kind: "race", slug: "srd-2024_high-elf" }, level: 0,
      featureName: "High Elf", choice,
      options: [{ value: "elvish", label: "Elvish" }, { value: "dwarvish", label: "Dwarvish" }],
      selected: undefined, status: "unresolved",
    };
    renderDecisionLedger(root, fakeCtx(new Map(), es), { ledger: ledgerOf([item]), ...opts });
    const chip = [...root.querySelectorAll<HTMLElement>(".pc-bchoice-chip")]
      .find((c) => c.textContent === "Elvish")!;
    chip.click();
    expect(es.setOriginChoice).toHaveBeenCalledWith("race:lang", "elvish");
    expect(es.setChoice).not.toHaveBeenCalled();
  });

  it("writes class proficiency picks via setChoice with the selected slug", () => {
    const root = mountContainer();
    const es = fakeEditState();
    const choice: Choice = {
      kind: "select-proficiency", id: "skills", label: "Skill Proficiencies", count: 2, domain: "skill",
      from: ["acrobatics", "athletics", "stealth"],
    };
    const item: DecisionItem = {
      key: "skills", source: { kind: "class", slug: "srd-2024_rogue", level: 1 }, level: 1,
      featureName: "Proficiencies", choice,
      options: [
        { value: "acrobatics", label: "Acrobatics" }, { value: "athletics", label: "Athletics" },
        { value: "stealth", label: "Stealth" },
      ],
      selected: undefined, status: "unresolved",
    };
    renderDecisionLedger(root, fakeCtx(new Map(), es), { ledger: ledgerOf([item]), ...opts });
    const chip = [...root.querySelectorAll<HTMLElement>(".pc-bchoice-chip")]
      .find((c) => c.textContent === "Stealth")!;
    chip.click();
    // count > 1 → array write
    expect(es.setChoice).toHaveBeenCalledWith(0, 1, "skills", ["stealth"]);
  });
});
