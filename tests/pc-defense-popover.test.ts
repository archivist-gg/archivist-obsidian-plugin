/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import {
  openDefenseTypePopover,
  closeDefenseTypePopover,
} from "../packages/obsidian/src/modules/pc/components/defense-type-popover";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { DAMAGE_TYPES, CONDITIONS } from "@archivist-gg/dnd5e/dnd/constants";
import {
  CONDITION_SLUGS,
  CONDITION_DISPLAY_NAMES,
} from "@archivist-gg/dnd5e/pc/conditions.constants";
import { toDefenseSlug } from "@archivist-gg/dnd5e/pc/pc.defense-normalize";
import { FIGHTER_5_CLERIC_3, clone, fakeResolved, fakeDerived } from "./fixtures/pc/rest-fixtures";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { App } from "obsidian";

beforeAll(() => installObsidianDomHelpers());
afterEach(() => closeDefenseTypePopover());

type Derived = ComponentRenderContext["derived"];
type DefenseEntry = Derived["defenses"]["resistances"][number];

type DefenseSeed = string | DefenseEntry;

/**
 * Seed a bucket with `DefenseEntry` objects. `value` is the canonical slug;
 * `label` is the first-spelling-wins display string.
 *
 * A BARE STRING seeds `label === value`. Under that seed a canonical `value`
 * compare and a `label` compare are indistinguishable, which is exactly why
 * bug D-1 shipped green: every fixture in the file spelled both fields the
 * same way. Pass a full entry whenever the test needs to tell them apart ·
 * `{ value: "psychic", label: "Psychic", origin: "grant" }`.
 */
function ents(vals: DefenseSeed[]): DefenseEntry[] {
  return vals.map((v) =>
    typeof v === "string" ? { value: v, label: v, origin: "manual" as const } : v,
  );
}

function withDefenses(over: Partial<{
  resistances: DefenseSeed[];
  immunities: DefenseSeed[];
  vulnerabilities: DefenseSeed[];
  condition_immunities: DefenseSeed[];
}> = {}) {
  const character = clone(FIGHTER_5_CLERIC_3);
  const resolved = fakeResolved(character);
  // Typed against the REAL `DerivedStats` (via ComponentRenderContext) so the
  // `defenses` seeding below is checked against the engine shape rather than a
  // hand-written local one that can silently drift out of date.
  const derived = fakeDerived(character) as Derived;
  derived.defenses = {
    resistances: ents(over.resistances ?? []),
    immunities: ents(over.immunities ?? []),
    vulnerabilities: ents(over.vulnerabilities ?? []),
    condition_immunities: ents(over.condition_immunities ?? []),
  };
  const onChange = vi.fn();
  const editState = new CharacterEditState(character, () => ({ resolved, derived }), onChange);
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  const ctx: ComponentRenderContext = {
    resolved,
    derived,
    services: {} as never,
    app: {} as App,
    editState,
  };
  return { ctx, editState, anchor, character, onChange };
}

function getPopover(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>(".pc-def-popover");
  if (!el) throw new Error("popover not rendered");
  return el;
}

function tab(name: "damages" | "conditions"): HTMLButtonElement {
  const el = getPopover().querySelector<HTMLButtonElement>(`.pc-def-popover-tab[data-tab="${name}"]`);
  if (!el) throw new Error(`tab "${name}" not found`);
  return el;
}

function panel(name: "damages" | "conditions"): HTMLElement {
  const el = getPopover().querySelector<HTMLElement>(`.pc-def-popover-panel[data-tab="${name}"]`);
  if (!el) throw new Error(`panel "${name}" not found`);
  return el;
}

function damageRow(name: string): HTMLElement {
  for (const row of panel("damages").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
    if (row.querySelector(".pc-def-popover-name")?.textContent === name) return row;
  }
  throw new Error(`damage row "${name}" not found`);
}

function pip(row: HTMLElement, kind: "resistance" | "immunity" | "vulnerability"): HTMLButtonElement {
  const el = row.querySelector<HTMLButtonElement>(`.pc-def-popover-pip[data-kind="${kind}"]`);
  if (!el) throw new Error(`pip "${kind}" not found`);
  return el;
}

function conditionRow(slug: string): HTMLElement {
  for (const row of panel("conditions").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
    if (row.dataset.slug === slug) return row;
  }
  throw new Error(`condition row "${slug}" not found`);
}

function conditionPip(slug: string): HTMLButtonElement {
  return pip(conditionRow(slug), "immunity");
}

describe("defense popover — structure", () => {
  it("renders two tabs labeled Damages and Conditions, Damages active by default", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(tab("damages").textContent).toBe("Damages");
    expect(tab("conditions").textContent).toBe("Conditions");
    expect(tab("damages").classList.contains("active")).toBe(true);
    expect(tab("conditions").classList.contains("active")).toBe(false);
  });

  it("damages panel is active by default; conditions panel is not", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(panel("damages").classList.contains("active")).toBe(true);
    expect(panel("conditions").classList.contains("active")).toBe(false);
  });

  it("renders one damage-type row per DAMAGE_TYPES entry, each with three pips", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const damageRows = panel("damages").querySelectorAll(".pc-def-popover-row");
    expect(damageRows.length).toBe(DAMAGE_TYPES.length);
    for (const row of damageRows) {
      expect(row.querySelectorAll(".pc-def-popover-pip").length).toBe(3);
    }
  });

  it("renders one condition row per CONDITION_SLUGS entry, each with a single immunity pip", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const condRows = panel("conditions").querySelectorAll(".pc-def-popover-row");
    expect(condRows.length).toBe(CONDITION_SLUGS.length);
    for (const row of condRows) {
      const pips = row.querySelectorAll<HTMLButtonElement>(".pc-def-popover-pip");
      expect(pips.length).toBe(1);
      expect(pips[0].dataset.kind).toBe("immunity");
      expect(pips[0].textContent).toBe("I");
    }
  });

  it("displays condition rows by their CONDITION_DISPLAY_NAMES label", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(conditionRow("charmed").querySelector(".pc-def-popover-name")?.textContent).toBe(
      CONDITION_DISPLAY_NAMES.charmed,
    );
  });
});

describe("defense popover — tab switching", () => {
  it("clicking the Conditions tab swaps the active tab + panel", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    tab("conditions").click();
    expect(tab("conditions").classList.contains("active")).toBe(true);
    expect(tab("damages").classList.contains("active")).toBe(false);
    expect(panel("conditions").classList.contains("active")).toBe(true);
    expect(panel("damages").classList.contains("active")).toBe(false);
  });

  it("clicking back to Damages restores the default", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    tab("conditions").click();
    tab("damages").click();
    expect(tab("damages").classList.contains("active")).toBe(true);
    expect(panel("damages").classList.contains("active")).toBe(true);
    expect(panel("conditions").classList.contains("active")).toBe(false);
  });
});

describe("defense popover — initial state mirrors derived.defenses", () => {
  it("an `.on` pip appears for each existing damage entry", () => {
    const { ctx, anchor } = withDefenses({
      resistances: ["acid"],
      immunities: ["cold"],
      vulnerabilities: ["fire"],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Acid"), "resistance").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Acid"), "immunity").classList.contains("on")).toBe(false);
    expect(pip(damageRow("Cold"), "immunity").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Fire"), "vulnerability").classList.contains("on")).toBe(true);
  });

  it("an `.on` immunity pip appears for each existing condition immunity", () => {
    const { ctx, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    openDefenseTypePopover(anchor, ctx);
    expect(conditionPip("charmed").classList.contains("on")).toBe(true);
  });
});

describe("defense popover · seeding keys on the canonical value (bug D-1)", () => {
  it("checks the R pip for a Title-Case granted resistance", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "psychic", label: "Psychic", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Psychic"), "resistance").classList.contains("on")).toBe(true);
  });

  it("checks the I and V pips for Title-Case granted damage entries", () => {
    const { ctx, anchor } = withDefenses({
      immunities: [{ value: "cold", label: "Cold", origin: "grant" }],
      vulnerabilities: [{ value: "fire", label: "Fire", origin: "equipment" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Cold"), "immunity").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Fire"), "vulnerability").classList.contains("on")).toBe(true);
  });

  it("checks the immunity pip for a Title-Case granted condition immunity", () => {
    const { ctx, anchor } = withDefenses({
      condition_immunities: [{ value: "charmed", label: "Charmed", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(conditionPip("charmed").classList.contains("on")).toBe(true);
  });

  // A pip that mis-seeds OFF turns one tap into `addDefense` on a value the
  // character already has, writing a manual duplicate of a grant into the note.
  // Seeding ON makes the same tap the intended `removeDefense`.
  it("tapping a Title-Case granted resistance removes it instead of adding a duplicate", () => {
    const { ctx, editState, anchor } = withDefenses({
      resistances: [{ value: "psychic", label: "Psychic", origin: "grant" }],
    });
    const addSpy = vi.spyOn(editState, "addDefense");
    const removeSpy = vi.spyOn(editState, "removeDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Psychic"), "resistance").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "psychic");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("addresses every damage row by its canonical value in data-type", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(damageRow("Psychic").dataset.type).toBe("psychic");
    for (const row of panel("damages").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
      const shown = row.querySelector(".pc-def-popover-name")?.textContent ?? "";
      // Oracle is `toDefenseSlug`, not `shown.toLowerCase()`. The two agree on every value
      // in today's vocabulary, but `toLowerCase` is the exact expression the row key would
      // be WRONG to use, so encoding it here would make this assertion fail against correct
      // code the moment a whitespace-irregular display value entered the list.
      expect(row.dataset.type).toBe(toDefenseSlug(shown));
    }
  });
});

describe("defense popover — damage pip clicks", () => {
  it("tap R on a neutral row calls addDefense(resistances, slug)", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("resistances", "acid");
  });

  it("tap I on a resistance row removes then adds", () => {
    const { ctx, editState, anchor } = withDefenses({ resistances: ["acid"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "acid");
    expect(addSpy).toHaveBeenCalledWith("immunities", "acid");
    const removeOrder = removeSpy.mock.invocationCallOrder[0];
    const addOrder = addSpy.mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(addOrder);
  });

  it("tap the active pip clears the row", () => {
    const { ctx, editState, anchor } = withDefenses({ immunities: ["cold"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Cold"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("immunities", "cold");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("re-render after click reflects the new state", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    expect(pip(damageRow("Acid"), "resistance").classList.contains("on")).toBe(true);
  });
});

describe("defense popover — condition pip clicks", () => {
  it("tap on a neutral condition row calls addConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    conditionPip("charmed").click();
    expect(spy).toHaveBeenCalledWith("charmed");
  });

  it("tap on an active condition row calls removeConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    const spy = vi.spyOn(editState, "removeConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    conditionPip("charmed").click();
    expect(spy).toHaveBeenCalledWith("charmed");
  });

  it("re-render after click toggles `.on` in place", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const p = conditionPip("charmed");
    expect(p.classList.contains("on")).toBe(false);
    p.click();
    expect(p.classList.contains("on")).toBe(true);
    p.click();
    expect(p.classList.contains("on")).toBe(false);
  });
});

/**
 * The option list each tab renders is `union(shipped vocabulary, everything in
 * `derived.defenses`)` KEYED BY `toDefenseSlug`. PROTECTIVE, not corrective: zero
 * off-vocabulary values exist in the product today, so none of these assertions
 * describes anything a user can currently see. What they pin is the behaviour when
 * one appears · the picker surfaces it rather than silently hiding it, and it does
 * so WITHOUT the keyless union's duplicate row.
 *
 * Every fixture below deliberately spells `label` differently from `value`, because
 * a `label === value` seed cannot tell which field a row read.
 */
describe("defense popover · the option list is a KEYED union (Task 8)", () => {
  function damageRows(): HTMLElement[] {
    return [...panel("damages").querySelectorAll<HTMLElement>(".pc-def-popover-row")];
  }
  function condRows(): HTMLElement[] {
    return [...panel("conditions").querySelectorAll<HTMLElement>(".pc-def-popover-row")];
  }

  // The real vault case the keying exists for: a hand-typed lowercase `fire` sitting
  // beside `DAMAGE_TYPES`' Title-Case "Fire". Keyless, this is a 14th row.
  it("renders ONE row when derived and DAMAGE_TYPES disagree only on case", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "fire", label: "fire", origin: "manual" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(panel("damages").querySelectorAll('.pc-def-popover-row[data-type="fire"]')).toHaveLength(1);
    expect(damageRows()).toHaveLength(DAMAGE_TYPES.length);
  });

  it("shows the DAMAGE_TYPES spelling, not the derived label, for a slug the vocabulary knows", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "fire", label: "fire", origin: "manual" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const row = panel("damages").querySelector<HTMLElement>('.pc-def-popover-row[data-type="fire"]');
    expect(row?.querySelector(".pc-def-popover-name")?.textContent).toBe("Fire");
  });

  it("renders a row for an off-vocabulary damage value present in derived", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "void", label: "Void", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const row = panel("damages").querySelector<HTMLElement>('.pc-def-popover-row[data-type="void"]');
    expect(row).not.toBeNull();
    // Display falls back to the entry's authored label · "Void" appears nowhere in DAMAGE_TYPES.
    expect(row?.querySelector(".pc-def-popover-name")?.textContent).toBe("Void");
    expect(damageRows()).toHaveLength(DAMAGE_TYPES.length + 1);
  });

  // A realistically SHAPED off-vocabulary value · multi-word, punctuated, and absent from
  // the picker's vocabulary, which carries only DAMAGE_TYPES. It is NOT a value any PC path
  // emits: DAMAGE_NONMAGICAL_VARIANTS' only consumer anywhere is the monster editor's damage
  // presets (modules/monster/edit/info-editor.ts). The fixture is chosen for its shape.
  it("renders an off-vocabulary NONMAGICAL variant with its full authored label", () => {
    const label = "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks";
    const { ctx, anchor } = withDefenses({
      immunities: [{ value: toDefenseSlug(label), label, origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const row = panel("damages").querySelector<HTMLElement>(
      `.pc-def-popover-row[data-type="${toDefenseSlug(label)}"]`,
    );
    expect(row?.querySelector(".pc-def-popover-name")?.textContent).toBe(label);
    expect(pip(row as HTMLElement, "immunity").classList.contains("on")).toBe(true);
  });

  // What this fixture separates is `toDefenseSlug` from a BARE `toLowerCase`: the label's
  // double space survives `.trim().toLowerCase()` ("ionized  plasma") and is collapsed by
  // `toDefenseSlug` ("ionized plasma"), so a key that skips the whitespace step misses the
  // row this test asks for.
  //
  // ⚠️ It does NOT separate keying on `value` from keying on `label` · `toDefenseSlug`
  // maps both spellings to the same string, and a probe keying on `toDefenseSlug(label)`
  // survives the whole 14089-test suite. Nor does it constrain the SHIPPED call site's
  // normalizer: that keys off `value`, which is already canonical, so a bare lowercase
  // THERE survives too. The name says "of the label" because that is the only expression
  // this fixture can speak about. Measured, not assumed · read no more into it than that.
  it("keys on a whitespace-collapsed string, not a bare lowercase of the label", () => {
    const { ctx, anchor } = withDefenses({
      vulnerabilities: [{ value: "ionized plasma", label: "Ionized  Plasma", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const row = panel("damages").querySelector<HTMLElement>(
      '.pc-def-popover-row[data-type="ionized plasma"]',
    );
    expect(row).not.toBeNull();
    expect(row?.querySelector(".pc-def-popover-name")?.textContent).toBe("Ionized  Plasma");
  });

  // Row COUNT alone does not pin the tie-break: last-derived-wins collapses to one row too.
  // The label assertion is what fixes FIRST-derived-wins, which is what seeding order gives
  // and what a literal per-entry `??` fallback would have inverted. Buckets are visited
  // resistances, immunities, vulnerabilities, so "Void" must beat the later "VOID".
  it("collapses an off-vocabulary value repeated across two buckets, first label winning", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "void", label: "Void", origin: "grant" }],
      vulnerabilities: [{ value: "void", label: "VOID", origin: "manual" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const rows = panel("damages").querySelectorAll<HTMLElement>('.pc-def-popover-row[data-type="void"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector(".pc-def-popover-name")?.textContent).toBe("Void");
    expect(damageRows()).toHaveLength(DAMAGE_TYPES.length + 1);
  });

  it("writes the off-vocabulary damage row through its canonical slug", () => {
    const { ctx, editState, anchor } = withDefenses({
      resistances: [{ value: "void", label: "Void", origin: "grant" }],
    });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    const row = panel("damages").querySelector<HTMLElement>('.pc-def-popover-row[data-type="void"]');
    // Seeded ON from derived, so the first tap is the REMOVE half, not a duplicate add.
    expect(pip(row as HTMLElement, "resistance").classList.contains("on")).toBe(true);
    pip(row as HTMLElement, "resistance").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "void");
    expect(addSpy).not.toHaveBeenCalled();
  });

  // ─── Conditions half · ruling C-1 ────────────────────────────────────────
  it("renders a row for an off-vocabulary condition immunity present in derived", () => {
    const { ctx, anchor } = withDefenses({
      condition_immunities: [{ value: "bewildered", label: "Bewildered", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    const row = conditionRow("bewildered");
    expect(row.querySelector(".pc-def-popover-name")?.textContent).toBe("Bewildered");
    expect(conditionPip("bewildered").classList.contains("on")).toBe(true);
    expect(condRows()).toHaveLength(CONDITION_SLUGS.length + 1);
  });

  it("writes the off-vocabulary condition row through its canonical slug", () => {
    const { ctx, editState, anchor } = withDefenses({
      condition_immunities: [{ value: "bewildered", label: "Bewildered", origin: "grant" }],
    });
    const spy = vi.spyOn(editState, "removeConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    conditionPip("bewildered").click();
    expect(spy).toHaveBeenCalledWith("bewildered");
  });

  it("collapses a lowercase derived condition onto its CONDITION_SLUGS row", () => {
    const { ctx, anchor } = withDefenses({
      condition_immunities: [{ value: "charmed", label: "charmed", origin: "manual" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(condRows()).toHaveLength(CONDITION_SLUGS.length);
    // Display stays CONDITION_DISPLAY_NAMES' spelling, not the derived label.
    expect(conditionRow("charmed").querySelector(".pc-def-popover-name")?.textContent).toBe("Charmed");
  });

  // Ruling C-1, first half. `CONDITIONS` carries a 15th member `CONDITION_SLUGS` omits.
  // The union is PROTECTIVE, so it may not inject that member: adding an "Exhaustion" row
  // to a shipped picker is a corrective product change, and it would misrepresent a
  // level-based condition as a boolean immunity.
  it("never injects Exhaustion, the CONDITIONS-only member CONDITION_SLUGS omits", () => {
    expect(CONDITIONS).toContain("Exhaustion");
    expect(CONDITION_SLUGS as readonly string[]).not.toContain("exhaustion");
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(condRows()).toHaveLength(CONDITION_SLUGS.length);
    expect(condRows().map((r) => r.dataset.slug)).not.toContain("exhaustion");
    expect(condRows().map((r) => r.querySelector(".pc-def-popover-name")?.textContent))
      .not.toContain("Exhaustion");
  });

  it("leaves both option lists equal to the shipped vocabulary when derived is empty", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(damageRows().map((r) => r.querySelector(".pc-def-popover-name")?.textContent))
      .toEqual([...DAMAGE_TYPES]);
    expect(condRows().map((r) => r.dataset.slug)).toEqual([...CONDITION_SLUGS]);
  });
});

describe("defense popover — viewport clamp", () => {
  it("invokes the clamp after rendering both panels (right-edge anchor stays inside)", () => {
    const { ctx, anchor } = withDefenses();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    anchor.getBoundingClientRect = () => ({
      bottom: 100, top: 80, left: 990, right: 1020,
      width: 30, height: 20, x: 990, y: 80, toJSON() { return this; },
    } as DOMRect);
    openDefenseTypePopover(anchor, ctx);
    const popover = getPopover();
    const rect = popover.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(1016);
  });
});
