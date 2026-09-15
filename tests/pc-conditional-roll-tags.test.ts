/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-20 (F-ADV, inv-3 §2 (a) and (b)) · the three roll-tag carriers mark a CONDITIONAL tag and merge same-text tags.
 *
 * (a) A `roll-modifier` entry that carries a `condition`, or a `scope` that dnd5e's `normalizeRollScope` does not map (the
 *     qualifier the converter left in `scope`), and a `save-outcome` entry that carries a `condition`, print the tag word
 *     followed by dnd5e's `CONDITIONAL_TAG_MARK`, with a class to style it; the tooltip keeps the label and the qualifier.
 *     Before this rider the Warforged's Construct Resilience painted a bare `ADV` under all six saves.
 * (b) Tags with the SAME rendered text on ONE save chip, skill row or HIT cell merge into one tag whose tooltip lists every
 *     source, one per line: the Yuan-ti's Magic Resistance and Poison Resilience were two indistinguishable `ADV` chips,
 *     and the 2024 Fighter's folded Indomitable painted `RR RR RR` on every save.
 *
 * The obsidian mock's `setTooltip` writes `aria-label`, so the tooltip is read there.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SaveChip } from "../packages/obsidian/src/modules/pc/components/save-chip";
import { SkillsPanel } from "../packages/obsidian/src/modules/pc/components/skills-panel";
import { renderWeaponRow } from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";
import { ROLL_MODE_TAG, CONDITIONAL_TAG_MARK, saveOutcomeTag } from "@archivist-gg/dnd5e/pc/roll-tag-labels";

beforeAll(() => installObsidianDomHelpers());

const ADV_MARKED = ROLL_MODE_TAG.advantage + CONDITIONAL_TAG_MARK;

function saveCtx(rollModifiers: unknown[], saveOutcomes: unknown[] = []): ComponentRenderContext {
  return {
    derived: { saves: { con: { bonus: 2, proficient: false }, dex: { bonus: 3, proficient: true } }, rollModifiers, saveOutcomes },
    resolved: { classes: [], definition: { overrides: {} } },
    editState: null,
  } as unknown as ComponentRenderContext;
}

function skillsCtx(rollModifiers: unknown[]): ComponentRenderContext {
  const skills: Record<string, unknown> = {};
  for (const s of ["athletics", "intimidation", "persuasion", "stealth"]) skills[s] = { bonus: 1, proficiency: "none", ability: "cha" };
  return { resolved: {}, derived: { skills, rollModifiers }, services: {}, editState: null } as unknown as ComponentRenderContext;
}

const dagger = (): AttackRow => ({
  id: "0:standard", name: "Dagger", range: "melee 5 ft.", toHit: 7,
  damageDice: "1d4 + 4", damageType: "piercing", properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] }, informational: [], slotKey: "mainhand",
} as unknown as AttackRow);

function hitCellFor(rollModifiers: unknown[]): HTMLElement {
  const root = mountContainer();
  const list = root.createDiv({ cls: "pc-actions-table pc-weapons-table" });
  renderWeaponRow(list, dagger(), {
    resolved: { definition: { equipment: [] } }, derived: { attacks: [dagger()], rollModifiers },
    services: { entities: { getBySlug: () => null } }, app: {}, editState: null,
  } as unknown as ComponentRenderContext);
  return root.querySelector(".pc-weapon-hit") as HTMLElement;
}

describe("RIDER-20 (a) · a conditional tag is marked on the tag itself", () => {
  it("the save chip marks a condition-bearing unscoped advantage (Construct Resilience)", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, saveCtx([
      { mode: "advantage", roll: "saving-throw", condition: "poisoned", label: "Construct Resilience" },
    ]));
    const tag = root.querySelector(".pc-save-tags .pc-cond-tag");
    expect(tag?.textContent).toBe(ADV_MARKED);
    expect(tag?.textContent).not.toBe(ROLL_MODE_TAG.advantage);
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(true);
    expect(tag?.classList.contains("pc-cond-tag-adv")).toBe(true);
    expect(tag?.getAttribute("aria-label")).toBe("Construct Resilience: poisoned");
  });

  it("control: the same entry with no condition renders the plain tag exactly as before", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, saveCtx([{ mode: "advantage", roll: "saving-throw", label: "Construct Resilience" }]));
    const tag = root.querySelector(".pc-save-tags .pc-cond-tag");
    expect(tag?.textContent).toBe("ADV");
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(false);
    expect(tag?.getAttribute("aria-label")).toBe("Construct Resilience");
  });

  it("control: a MAPPED scope (the ability key the fold normalised to) is not a qualifier, so the tag stays plain", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, saveCtx([{ mode: "advantage", roll: "saving-throw", scope: "con", label: "Stout Heart" }]));
    const tag = root.querySelector(".pc-save-tags .pc-cond-tag");
    expect(tag?.textContent).toBe("ADV");
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(false);
  });

  it("the skill row marks a condition-bearing unscoped check modifier (Powerful Build)", () => {
    const root = mountContainer();
    new SkillsPanel().render(root, skillsCtx([
      { mode: "advantage", roll: "ability-check", condition: "to end the Grappled condition", label: "Powerful Build" },
    ]));
    const tag = root.querySelector('[data-skill="athletics"] .pc-cond-tag');
    expect(tag?.textContent).toBe(ADV_MARKED);
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(true);
    expect(tag?.getAttribute("aria-label")).toBe("Powerful Build: to end the Grappled condition");
  });

  it("the HIT cell marks an attack modifier whose scope the normaliser does not map (Steady Aim)", () => {
    const hit = hitCellFor([{ mode: "advantage", roll: "attack", scope: "your next attack roll on the current turn", label: "Steady Aim" }]);
    const tag = hit.querySelector(".pc-cond-tag");
    expect(tag?.textContent).toBe(ADV_MARKED);
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(true);
    expect(tag?.getAttribute("aria-label")).toBe("Steady Aim: your next attack roll on the current turn");
  });

  it("control: an attack modifier with no condition and no scope stays plain in the HIT cell", () => {
    const hit = hitCellFor([{ mode: "reroll", roll: "attack", label: "Way of the Kensei" }]);
    const tag = hit.querySelector(".pc-cond-tag");
    expect(tag?.textContent).toBe("RR");
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(false);
  });

  it("a save-outcome that carries a condition is marked and names the condition (Spellfire Ward shape)", () => {
    const root = mountContainer();
    new SaveChip("dex").render(root, saveCtx([], [
      { on_success: "none", on_failure: "half", condition: "while Innate Sorcery is active", label: "Spellfire Ward" },
    ]));
    const tag = root.querySelector(".pc-cond-tag-outcome");
    expect(tag?.textContent).toBe(saveOutcomeTag("none", "half") + CONDITIONAL_TAG_MARK);
    expect(tag?.classList.contains("pc-cond-tag-conditional")).toBe(true);
    expect(tag?.getAttribute("aria-label")).toBe("Spellfire Ward: on a success 0, on a failure ½ · while Innate Sorcery is active");
  });
});

describe("RIDER-20 (b) · same-text tags on one carrier merge, every source kept in the tooltip", () => {
  it("two different conditional sources on one save chip are ONE tag listing both (Yuan-ti)", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, saveCtx([
      { mode: "advantage", roll: "saving-throw", condition: "spells", label: "Magic Resistance" },
      { mode: "advantage", roll: "saving-throw", condition: "poisoned", label: "Poison Resilience" },
    ]));
    const tags = root.querySelectorAll(".pc-save-tags .pc-cond-tag");
    expect(tags.length).toBe(1);
    expect(tags[0].textContent).toBe(ADV_MARKED);
    expect(tags[0].getAttribute("aria-label")).toBe("Magic Resistance: spells\nPoison Resilience: poisoned");
  });

  it("the folded Indomitable's three identical entries are ONE RR tag on each save", () => {
    const root = mountContainer();
    const indomitable = { mode: "reroll", roll: "saving-throw", label: "Indomitable" };
    new SaveChip("con").render(root, saveCtx([indomitable, indomitable, indomitable]));
    const tags = root.querySelectorAll(".pc-save-tags .pc-cond-tag");
    expect(tags.length).toBe(1);
    expect(tags[0].textContent).toBe("RR");
    expect(tags[0].getAttribute("aria-label")).toBe("Indomitable");
  });

  it("a plain and a conditional advantage print different text, so they stay two tags", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, saveCtx([
      { mode: "advantage", roll: "saving-throw", label: "Aura" },
      { mode: "advantage", roll: "saving-throw", condition: "poisoned", label: "Poison Resilience" },
    ]));
    expect(Array.from(root.querySelectorAll(".pc-save-tags .pc-cond-tag")).map((t) => t.textContent)).toEqual(["ADV", ADV_MARKED]);
  });

  it("two conditional check modifiers on one skill row merge", () => {
    const root = mountContainer();
    new SkillsPanel().render(root, skillsCtx([
      { mode: "advantage", roll: "ability-check", condition: "to end the Grappled condition", label: "Powerful Build" },
      { mode: "advantage", roll: "ability-check", scope: "persuasion", condition: "with dragons", label: "Draconic Envoy" },
    ]));
    const tags = root.querySelectorAll('[data-skill="persuasion"] .pc-cond-tag');
    expect(tags.length).toBe(1);
    expect(tags[0].getAttribute("aria-label")).toBe("Powerful Build: to end the Grappled condition\nDraconic Envoy: with dragons");
  });

  it("two unmapped-scope attack modifiers in one HIT cell merge (Steady Aim + Assassinate)", () => {
    const hit = hitCellFor([
      { mode: "advantage", roll: "attack", scope: "your next attack roll on the current turn", label: "Steady Aim" },
      { mode: "advantage", roll: "attack", scope: "attack rolls against any creature that has not yet taken a turn in the combat", label: "Assassinate" },
    ]);
    const tags = hit.querySelectorAll(".pc-cond-tag");
    expect(tags.length).toBe(1);
    expect(tags[0].getAttribute("aria-label")).toBe(
      "Steady Aim: your next attack roll on the current turn\nAssassinate: attack rolls against any creature that has not yet taken a turn in the combat");
  });
});
