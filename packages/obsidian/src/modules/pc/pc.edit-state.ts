import type { Ability, SkillSlug } from "@archivist-gg/dnd5e";
import type { EntityRegistry } from "@archivist-gg/core";
import type { Character, DerivedStats, EquipmentEntry, EquipmentEntryOverrides, KnownSpellEntry, PassiveKind, ResolvedCharacter, SlotKey } from "@archivist-gg/dnd5e/pc/pc.types";
import type { GrantedEntry } from "./builder/equipment-seed";
import type { ConditionSlug } from "@archivist-gg/dnd5e/pc/conditions.constants";
import { characterToYaml } from "./pc.yaml-serializer";
import * as eq from "./pc.equipment-edit";
import { resolveEntityForEntry } from "@archivist-gg/dnd5e/pc/pc.slotting";
import { computeRestPlan, type RestCategoryId } from "@archivist-gg/dnd5e/pc/pc.rest";
import { applyRestResets } from "./pc.rest";

export interface EditStateContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
}

/** Wrap a bare compendium slug as a [[wikilink]]; pass through existing links;
 *  empty string returns empty. Mirrors the inline wrapping done elsewhere in
 *  this file for known-spell refs. */
function toRef(slug: string): string {
  const s = slug.trim();
  if (!s) return s;
  return /^\[\[.+\]\]$/.test(s) ? s : `[[${s}]]`;
}

/**
 * Centralized mutation surface for the PC sheet. Owned by `PCSheetView`;
 * re-built on every `setViewData`. Each mutation mutates `this.character`
 * in place, applies any cascading rule, and calls `onChange()` exactly
 * once at the end.
 *
 * Session state (activeHitDie) is NOT persisted. It survives re-renders
 * because the view holds this instance, but is reset each time a new
 * character is loaded.
 */
export class CharacterEditState {
  sessionState: {
    activeHitDie: string | null;
  } = { activeHitDie: null };

  constructor(
    private character: Character,
    private getContext: () => EditStateContext,
    private onChange: () => void,
    private registry: EntityRegistry | null = null,
  ) {}

  // ─── HP ────────────────────────────────────────────────────────────
  heal(amount: number): void {
    if (!Number.isFinite(amount)) return;
    const { derived } = this.getContext();
    const hp = this.character.state.hp;
    const wasZero = hp.current === 0;
    const next = Math.min(hp.current + Math.max(0, amount), derived.hp.max);
    hp.current = next;
    if (wasZero && next > 0) this.clearDeathSavesNoNotify();
    this.onChange();
  }

  damage(amount: number): void {
    if (!Number.isFinite(amount)) return;
    const hp = this.character.state.hp;
    const n = Math.max(0, amount);
    const fromTemp = Math.min(hp.temp, n);
    hp.temp -= fromTemp;
    hp.current = Math.max(0, hp.current - (n - fromTemp));
    this.onChange();
  }

  setTempHP(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.character.state.hp.temp = Math.max(0, amount);
    this.onChange();
  }

  setCurrentHp(value: number): void {
    if (!Number.isFinite(value)) return;
    const { derived } = this.getContext();
    const hp = this.character.state.hp;
    const wasZero = hp.current === 0;
    const next = Math.max(0, Math.min(derived.hp.max, Math.floor(value)));
    hp.current = next;
    if (wasZero && next > 0) this.clearDeathSavesNoNotify();
    this.onChange();
  }

  setMaxHpOverride(value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.max(1, Math.floor(value));
    if (!this.character.overrides.hp) this.character.overrides.hp = {};
    this.character.overrides.hp.max = next;
    if (this.character.state.hp.current > next) {
      this.character.state.hp.current = next;
    }
    this.onChange();
  }

  clearMaxHpOverride(): void {
    if (!this.character.overrides.hp) { this.onChange(); return; }
    delete this.character.overrides.hp.max;
    if (Object.keys(this.character.overrides.hp).length === 0) {
      delete this.character.overrides.hp;
    }
    this.onChange();
  }

  // ─── AC ────────────────────────────────────────────────────────────
  setAcOverride(value: number): void {
    if (!Number.isFinite(value)) return;
    this.character.overrides.ac = Math.max(0, Math.min(50, Math.floor(value)));
    this.onChange();
  }

  clearAcOverride(): void {
    delete this.character.overrides.ac;
    this.onChange();
  }

  // ─── Ability scores ────────────────────────────────────────────────
  setScoreOverride(ability: Ability, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.max(1, Math.min(30, Math.floor(value)));
    if (!this.character.overrides.scores) this.character.overrides.scores = {};
    this.character.overrides.scores[ability] = next;
    this.onChange();
  }

  clearScoreOverride(ability: Ability): void {
    if (!this.character.overrides.scores) { this.onChange(); return; }
    delete this.character.overrides.scores[ability];
    if (Object.keys(this.character.overrides.scores).length === 0) {
      delete this.character.overrides.scores;
    }
    this.onChange();
  }

  // ─── Speed (override) ──────────────────────────────────────────────
  setSpeedOverride(value: number): void {
    if (!Number.isFinite(value)) return;
    this.character.overrides.speed = Math.max(0, Math.min(240, Math.floor(value)));
    this.onChange();
  }

  clearSpeedOverride(): void {
    delete this.character.overrides.speed;
    this.onChange();
  }

  // ─── Initiative (override) ─────────────────────────────────────────
  setInitiativeOverride(value: number): void {
    if (!Number.isFinite(value)) return;
    this.character.overrides.initiative = Math.max(-20, Math.min(30, Math.floor(value)));
    this.onChange();
  }

  clearInitiativeOverride(): void {
    delete this.character.overrides.initiative;
    this.onChange();
  }

  // ─── Passive senses (override) ─────────────────────────────────────
  setPassiveOverride(kind: PassiveKind, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(40, Math.floor(value)));
    if (!this.character.overrides.passives) this.character.overrides.passives = {};
    this.character.overrides.passives[kind] = next;
    this.onChange();
  }

  clearPassiveOverride(kind: PassiveKind): void {
    const passives = this.character.overrides.passives;
    if (!passives) { this.onChange(); return; }
    delete passives[kind];
    if (Object.keys(passives).length === 0) {
      delete this.character.overrides.passives;
    }
    this.onChange();
  }

  // ─── Skill bonus (override) ────────────────────────────────────────
  setSkillBonusOverride(skill: SkillSlug, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.max(-20, Math.min(30, Math.floor(value)));
    if (!this.character.overrides.skills) this.character.overrides.skills = {};
    // The skill schema requires `bonus` when an entry exists. SP4c only sets
    // the bonus half — any future proficiency-override writer that wants to
    // preserve an existing bonus must spread the prior entry.
    this.character.overrides.skills[skill] = { bonus: next };
    this.onChange();
  }

  clearSkillBonusOverride(skill: SkillSlug): void {
    const skills = this.character.overrides.skills;
    if (!skills) { this.onChange(); return; }
    delete skills[skill];
    if (Object.keys(skills).length === 0) {
      delete this.character.overrides.skills;
    }
    this.onChange();
  }

  // ─── Defenses ──────────────────────────────────────────────────────
  private ensureDefenses(): NonNullable<Character["defenses"]> {
    if (!this.character.defenses) {
      this.character.defenses = {
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        condition_immunities: [],
      };
    }
    const d = this.character.defenses;
    d.resistances ??= [];
    d.immunities ??= [];
    d.vulnerabilities ??= [];
    d.condition_immunities ??= [];
    return d;
  }

  addDefense(kind: "resistances" | "immunities" | "vulnerabilities", type: string): void {
    const d = this.ensureDefenses();
    const list = d[kind]!;
    if (!list.includes(type)) list.push(type);
    this.onChange();
  }

  removeDefense(kind: "resistances" | "immunities" | "vulnerabilities", type: string): void {
    const d = this.ensureDefenses();
    const list = d[kind]!;
    const i = list.indexOf(type);
    if (i >= 0) list.splice(i, 1);
    this.onChange();
  }

  addConditionImmunity(slug: ConditionSlug): void {
    const d = this.ensureDefenses();
    const list = d.condition_immunities!;
    if (!list.includes(slug)) list.push(slug);
    this.onChange();
  }

  removeConditionImmunity(slug: ConditionSlug): void {
    const d = this.ensureDefenses();
    const list = d.condition_immunities!;
    const i = list.indexOf(slug);
    if (i >= 0) list.splice(i, 1);
    this.onChange();
  }

  // ─── Hit dice ──────────────────────────────────────────────────────
  spendHitDie(dieKey: string): void {
    const hd = this.character.state.hit_dice[dieKey];
    if (!hd) return;
    if (hd.used >= hd.total) return;
    hd.used += 1;
    this.onChange();
  }

  restoreHitDie(dieKey: string): void {
    const hd = this.character.state.hit_dice[dieKey];
    if (!hd) return;
    if (hd.used <= 0) return;
    hd.used -= 1;
    this.onChange();
  }

  setActiveHitDie(die: string | null): void {
    this.sessionState.activeHitDie = die;
    this.onChange();
  }

  // ─── Inspiration ───────────────────────────────────────────────────
  setInspiration(value: number): void {
    if (!Number.isFinite(value)) return;
    this.character.state.inspiration = Math.max(0, Math.floor(value));
    this.onChange();
  }

  // ─── Death saves (helper — full wiring in Task 5) ──────────────────
  private clearDeathSavesNoNotify(): void {
    if (this.character.state.death_saves) {
      this.character.state.death_saves = { successes: 0, failures: 0 };
    }
  }

  // ─── Skills (definition mutation) ──────────────────────────────────
  cycleSkill(skill: SkillSlug): void {
    const prof = this.character.skills.proficient;
    const exp = this.character.skills.expertise;
    const hasProf = prof.includes(skill);
    const hasExp = exp.includes(skill);

    if (hasProf && hasExp) {
      // normalize: remove from both
      this.character.skills.proficient = prof.filter((s) => s !== skill);
      this.character.skills.expertise = exp.filter((s) => s !== skill);
    } else if (!hasProf && !hasExp) {
      prof.push(skill);
    } else if (hasProf) {
      this.character.skills.proficient = prof.filter((s) => s !== skill);
      exp.push(skill);
    } else {
      this.character.skills.expertise = exp.filter((s) => s !== skill);
    }
    this.onChange();
  }

  // ─── Builder: identity ─────────────────────────────────────────────
  setName(name: string): void {
    const n = name.trim();
    if (!n) return;
    this.character.name = n;
    this.onChange();
  }

  setAlignment(alignment: string | null): void {
    if (alignment && alignment.trim()) this.character.alignment = alignment.trim();
    else delete this.character.alignment;
    this.onChange();
  }

  setAge(age: string | null): void {
    const v = age?.trim();
    if (v) this.character.age = v;
    else delete this.character.age;
    this.onChange();
  }

  /** Drops origin_choices keys in the given namespace ("race" | "background").
   *  Switching origin entities orphans their namespaced decisions (class-step
   *  decisions doc, Plan-4 note) — prune rather than carry stale answers. */
  private pruneOriginChoices(ns: "race" | "background"): void {
    const oc = this.character.origin_choices;
    if (!oc) return;
    for (const key of Object.keys(oc)) {
      if (key.startsWith(`${ns}:`)) delete oc[key];
    }
    if (Object.keys(oc).length === 0) delete this.character.origin_choices;
  }

  setRace(slug: string | null): void {
    this.character.race = slug ? toRef(slug) : null;
    this.character.subrace = null;
    this.pruneOriginChoices("race");
    this.onChange();
  }

  setSubrace(slug: string | null): void {
    this.character.subrace = slug ? toRef(slug) : null;
    this.onChange();
  }

  setBackground(slug: string | null): void {
    this.character.background = slug ? toRef(slug) : null;
    this.pruneOriginChoices("background");
    this.onChange();
  }

  // ─── Builder: abilities ────────────────────────────────────────────
  setAbilityMethod(method: Character["ability_method"]): void {
    this.character.ability_method = method;
    this.onChange();
  }

  /** Sets the BASE ability score in `abilities` (distinct from the final-score
   *  override written by `setScoreOverride`). Racial/ASI bonuses are added on top
   *  by recalc. */
  setAbilityBaseScore(ability: Ability, value: number): void {
    if (!Number.isFinite(value)) return;
    this.character.abilities[ability] = Math.round(value);
    this.onChange();
  }

  /** Clears a BASE ability score back to unassigned. `Character.abilities` is
   *  `Record<Ability, number>` (no null arm — see pc.schema), so "unassigned" is
   *  the neutral 10 a fresh draft seeds (buildDraftCharacter), the same sentinel
   *  the builder's draft-touch test keys on. Used by the Abilities step's pool
   *  modes to release a value back to the shared pool for other tiles. */
  clearAbilityBaseScore(ability: Ability): void {
    this.character.abilities[ability] = 10;
    this.onChange();
  }

  /** Persist the Roll-method ability pool (six 4d6-drop-lowest totals) on the
   *  draft, so it survives view close / Obsidian restart — UI state (the roll
   *  bar's `builderUiState` bag) cannot. The Abilities step writes this on every
   *  roll/re-roll (overwriting the prior pool); the Base popover reads its
   *  assignable pool from here. Removed by `finishBuild`. */
  setBuilderRolls(values: number[]): void {
    if (!Array.isArray(values) || !values.every((v) => Number.isFinite(v))) return;
    this.character.builder_rolls = values.map((v) => Math.round(v));
    this.onChange();
  }

  // ─── Builder: class entries ────────────────────────────────────────
  addClass(slug: string, level = 1, subclass: string | null = null): void {
    this.character.class.push({
      name: toRef(slug),
      level: Math.max(1, Math.min(20, Math.round(level))),
      subclass: subclass ? toRef(subclass) : null,
      choices: {},
    });
    this.onChange();
  }

  removeClass(index: number): void {
    if (index < 0 || index >= this.character.class.length) return;
    this.character.class.splice(index, 1);
    this.onChange();
  }

  setClassLevel(index: number, level: number): void {
    const entry = this.character.class[index];
    if (!entry || !Number.isFinite(level)) return;
    entry.level = Math.max(1, Math.min(20, Math.round(level)));
    this.onChange();
  }

  setSubclass(index: number, slug: string | null): void {
    const entry = this.character.class[index];
    if (!entry) return;
    entry.subclass = slug ? toRef(slug) : null;
    this.onChange();
  }

  // ─── Builder: state seeders ────────────────────────────────────────
  /** Normalize a class entity's hit_die ("d8" | "8" | 8) to a "dN" key. */
  private dieForClass(slug: string): string | null {
    const entity = this.registry?.getByTypeAndSlug("class", slug) as { data?: { hit_die?: unknown } } | undefined;
    const raw = entity?.data?.hit_die;
    if (raw == null) return null;
    const n =
      typeof raw === "number" ? raw
      : typeof raw === "string" ? parseInt(raw.replace(/^d/i, ""), 10)
      : NaN;
    return Number.isFinite(n) && n > 0 ? `d${n}` : null;
  }

  /** Seed a hand-typed max HP at Finish (D10 "Manual"). Unlike
   *  `setMaxHpOverride` — which only clamps current DOWN — this raises current
   *  to the new max too, so the finished sheet opens at the typed value rather
   *  than the draft's `current: 1`. Writes the override (so recalc honors it)
   *  and seeds `state.hp.current/max`, clearing temp. */
  setHpMax(value: number): void {
    if (!Number.isFinite(value)) return;
    const max = Math.max(1, Math.floor(value));
    if (!this.character.overrides.hp) this.character.overrides.hp = {};
    this.character.overrides.hp.max = max;
    this.character.state.hp = { current: max, max, temp: 0 };
    this.onChange();
  }

  /** Fill HP to the derived max, clearing temp HP. Called by the Builder's
   *  Finish action before opening the finished sheet. */
  seedHpToMax(): void {
    const { derived } = this.getContext();
    const max = derived.hp.max;
    this.character.state.hp = { current: max, max, temp: 0 };
    this.onChange();
  }

  /** Seed `state.hit_dice` from class levels × each class's hit die. Hit dice
   *  are not auto-derived elsewhere, so the Builder seeds them on Finish.
   *  Replaces the map wholesale (resets all `used` to 0); intended for a fresh
   *  draft at Finish, not for live characters. */
  seedHitDice(): void {
    const dice: Record<string, { used: number; total: number }> = {};
    for (const entry of this.character.class) {
      const die = this.dieForClass(CharacterEditState.bare(entry.name));
      if (!die) continue;
      const cur = dice[die] ?? { used: 0, total: 0 };
      cur.total += entry.level;
      dice[die] = cur;
    }
    this.character.state.hit_dice = dice;
    this.onChange();
  }

  /** Populate `class[classIndex].choices[level][key]`. Pass null/undefined to
   *  clear a key. The Builder uses this for skills/asi/feat/subclass/expertise/
   *  fighting-style decisions (recalc reads asi from choices[lvl].asi and the
   *  resolver reads feat from choices[*].feat today; the rest are recorded for
   *  the ledger + future use). */
  setChoice(classIndex: number, level: number, key: string, value: unknown): void {
    const entry = this.character.class[classIndex];
    if (!entry || !Number.isFinite(level)) return;
    const lvl = Math.round(level);
    const choices = entry.choices as Record<number, Record<string, unknown>>;
    const atLevel = (choices[lvl] ??= {});
    if (value === undefined || value === null) {
      delete atLevel[key];
      if (Object.keys(atLevel).length === 0) delete choices[lvl];
    } else atLevel[key] = value;
    this.onChange();
  }

  /** Populate `origin_choices[key]` (keys are namespaced `race:<id>` /
   *  `background:<id>`). Pass null/undefined to clear. */
  setOriginChoice(key: string, value: unknown): void {
    const oc = (this.character.origin_choices ??= {});
    if (value === undefined || value === null) delete oc[key];
    else oc[key] = value;
    this.onChange();
  }

  /** Finish the build: drop the `builder` draft flag so the next render shows
   *  the full character sheet instead of the Builder shell (see isBuilder in
   *  pc.sheet). Deleting the key (vs setting `false`) keeps it absent from the
   *  serialized file — a finished character carries no `builder:` line. */
  finishBuild(): void {
    delete this.character.builder;
    // The persisted Roll pool is a build-only scratch field — drop it too, so a
    // finished file carries no `builder_rolls:` line (delete, not set-undefined,
    // so yaml.dump omits it). Mirrors the `builder` flag.
    delete this.character.builder_rolls;
    // Strip Equipment-step build-only provenance: each entry's `granted_by` tag
    // and the persisted mode. A finished file carries no build scaffolding (the
    // gear itself stays; only the build-time bookkeeping is removed).
    for (const e of this.character.equipment) {
      delete (e as { granted_by?: string }).granted_by;
    }
    delete this.character.builder_equipment_mode;
    this.onChange();
  }

  /** Reopen the builder over a finished character: re-set the `builder` draft
   *  flag so the next render shows the Builder shell again. The inverse of
   *  finishBuild — invoked by the sheet's "Manage & Level Up" gear. */
  openBuilder(): void {
    this.character.builder = true;
    this.onChange();
  }

  // ─── Saves (override mutation) ─────────────────────────────────────
  /**
   * Flip the saving-throw proficient bit against the class-derived baseline.
   *
   * Writes `{ bonus: <preserved>, proficient: !effective }` into
   * `overrides.saves[ability]`, creating the entry if absent. The override is
   * NEVER cleared here even when the new proficient matches the class baseline;
   * callers who want "no override" must use `clearSaveProficientOverride(ability)`
   * explicitly. This keeps override semantics unambiguous: presence means the
   * user asserted something, absence means baseline applies.
   */
  toggleSaveProficient(ability: Ability): void {
    const { resolved } = this.getContext();
    const classSaves = resolved.classes[0]?.entity?.saving_throws ?? [];
    const override = this.character.overrides.saves?.[ability];
    const effective = override?.proficient ?? classSaves.includes(ability);

    if (!this.character.overrides.saves) this.character.overrides.saves = {};
    // Don't synthesize `bonus: 0` when no prior override exists. recalc reads
    // `override?.bonus ?? savingThrow(...)` and `0 ?? x` evaluates to `0`,
    // which would zero the displayed save bonus. Spread an empty object so
    // fresh overrides carry only the toggled `proficient` field; existing
    // overrides preserve their bonus via the spread.
    this.character.overrides.saves[ability] = {
      ...(this.character.overrides.saves[ability] ?? {}),
      proficient: !effective,
    };
    this.onChange();
  }

  clearSaveProficientOverride(ability: Ability): void {
    const saves = this.character.overrides.saves;
    if (!saves || !saves[ability]) { this.onChange(); return; }
    const rest = { ...saves[ability] };
    delete rest.proficient;
    if (Object.keys(rest).length === 0) {
      delete saves[ability];
    } else {
      saves[ability] = rest;
    }
    if (Object.keys(saves).length === 0) {
      delete this.character.overrides.saves;
    }
    this.onChange();
  }

  // ─── Save bonus (override) ─────────────────────────────────────────
  setSaveBonusOverride(ability: Ability, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.max(-20, Math.min(30, Math.floor(value)));
    if (!this.character.overrides.saves) this.character.overrides.saves = {};
    this.character.overrides.saves[ability] = {
      ...(this.character.overrides.saves[ability] ?? {}),
      bonus: next,
    };
    this.onChange();
  }

  clearSaveBonusOverride(ability: Ability): void {
    const saves = this.character.overrides.saves;
    if (!saves || !saves[ability]) { this.onChange(); return; }
    const rest = { ...saves[ability] };
    delete rest.bonus;
    if (Object.keys(rest).length === 0) {
      delete saves[ability];
    } else {
      saves[ability] = rest;
    }
    if (Object.keys(saves).length === 0) {
      delete this.character.overrides.saves;
    }
    this.onChange();
  }

  // ─── Conditions ────────────────────────────────────────────────────
  toggleCondition(slug: ConditionSlug): void {
    const list = this.character.state.conditions;
    const i = list.indexOf(slug);
    if (i >= 0) list.splice(i, 1);
    else list.push(slug);
    this.onChange();
  }

  /** Toggle an activatable buff's id/slug in state.active_buffs. While present,
   *  the matching activatable feature/boon's effects fold in recalc; removing it
   *  drops the buff. Empties the array back to undefined so a no-buff file carries
   *  no `active_buffs:` line (delete, not set-[]). Mirrors toggleCondition. */
  toggleActiveBuff(slug: string): void {
    const list = (this.character.state.active_buffs ??= []);
    const i = list.indexOf(slug);
    if (i >= 0) list.splice(i, 1);
    else list.push(slug);
    if (list.length === 0) delete this.character.state.active_buffs;
    this.onChange();
  }

  setExhaustion(level: number): void {
    if (!Number.isFinite(level)) return;
    this.character.state.exhaustion = Math.max(0, Math.min(6, Math.floor(level)));
    this.onChange();
  }

  // ─── Death saves ───────────────────────────────────────────────────
  toggleDeathSaveSuccess(index: 0 | 1 | 2): void {
    this.ensureDeathSaves();
    const ds = this.character.state.death_saves!;
    // "on" = filled index, dots fill left-to-right → on iff successes > index
    if (ds.successes > index) ds.successes -= 1;
    else ds.successes += 1;
    this.onChange();
  }

  toggleDeathSaveFailure(index: 0 | 1 | 2): void {
    this.ensureDeathSaves();
    const ds = this.character.state.death_saves!;
    if (ds.failures > index) ds.failures -= 1;
    else ds.failures += 1;
    this.onChange();
  }

  clearDeathSaves(): void {
    this.character.state.death_saves = { successes: 0, failures: 0 };
    this.onChange();
  }

  private ensureDeathSaves(): void {
    if (!this.character.state.death_saves) {
      this.character.state.death_saves = { successes: 0, failures: 0 };
    }
  }

  // ─── Read-out / serialize ──────────────────────────────────────────
  getCharacter(): Character {
    return this.character;
  }

  /**
   * Expose the registry handle for components (e.g. RestModal) that need
   * to resolve item slugs to display names. Returns `null` when the host
   * didn't pass a registry (test fixtures and early-init paths).
   */
  getRegistry(): EntityRegistry | null {
    return this.registry;
  }

  toYaml(): string {
    return characterToYaml(this.character);
  }

  // ─── Equipment ─────────────────────────────────────────────────
  addItem(slug: string, opts: { equipped?: boolean; slot?: SlotKey | null; granted_by?: string } = {}): void {
    eq.addItem(this.character, slug, opts, this.registry ?? undefined);
    this.onChange();
  }

  // ─── Builder: Equipment step ───────────────────────────────────
  /** Replace all `builder:starting` provenance entries with `entries` (each
   *  tagged `builder:starting`) and set `currency.gp` from the summed starting
   *  gold. Leaves hand-managed (untagged) + `builder:gold-buy` entries untouched.
   *  Idempotent + resume-safe: NO-OP (skips onChange, returns early) when the
   *  resulting `builder:starting` set + gp are unchanged, so the Equipment step
   *  may call it on every render without triggering a re-render loop. */
  syncStartingEquipment(entries: GrantedEntry[], gold: number): void {
    const STARTING = "builder:starting";
    const prevStarting = this.character.equipment.filter((e) => e.granted_by === STARTING);
    const nextGp = Math.max(0, Math.floor(Number.isFinite(gold) ? gold : 0));
    // Build the next builder:starting entries from the resolved grants.
    const nextStarting: EquipmentEntry[] = entries.map((g) => {
      const entry: EquipmentEntry = { item: `[[${g.slug}]]`, equipped: g.equipped, granted_by: STARTING };
      if (g.slot) entry.slot = g.slot;
      if (g.qty > 1) entry.qty = g.qty;
      return entry;
    });
    // No-op guard: compare the serialized prev vs next starting set + gp. The
    // identity-bearing fields (item/equipped/slot/qty) are normalized into a
    // stable shape so key order cannot produce a false diff.
    const serialize = (arr: EquipmentEntry[]): string =>
      JSON.stringify(arr.map((e) => ({ item: e.item, equipped: e.equipped, slot: e.slot ?? null, qty: e.qty ?? null })));
    const curGp = this.character.currency?.gp ?? 0;
    if (serialize(prevStarting) === serialize(nextStarting) && curGp === nextGp) return;
    this.character.equipment = this.character.equipment.filter((e) => e.granted_by !== STARTING);
    this.character.equipment.push(...nextStarting);
    if (!this.character.currency) this.character.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    this.character.currency.gp = nextGp;
    this.onChange();
  }

  /** Persist the Equipment-step mode and enforce exclusivity: switching modes
   *  drops ALL `builder:*` seeded gear (starting + gold-buy) so the new mode
   *  starts clean. Untagged (hand-managed) entries survive. */
  setBuilderEquipmentMode(mode: "starting" | "gold" | "empty"): void {
    this.character.builder_equipment_mode = mode;
    this.character.equipment = this.character.equipment.filter((e) => !e.granted_by?.startsWith("builder:"));
    this.onChange();
  }

  removeItem(index: number): void {
    eq.removeItem(this.character, index);
    this.onChange();
  }

  /** Identify an unidentified item: normalizing-replace the entry at `entryIndex`
   *  with `newSlug` (resets all per-instance state, see eq.identifyItem). */
  identifyItem(entryIndex: number, newSlug: string): void {
    eq.identifyItem(this.character, entryIndex, newSlug);
    this.onChange();
  }

  /** Consume one use of a scroll/consumable at `entryIndex` (decrement qty, or
   *  remove the entry when the last one is spent). Casting a scroll spends the
   *  item rather than a spell slot (see eq.consumeScroll). */
  consumeScroll(entryIndex: number): void {
    eq.consumeScroll(this.character, entryIndex);
    this.onChange();
  }

  equipItem(index: number): eq.EquipResult {
    if (!this.registry) return { kind: "ok" };
    const r = eq.equipItem(this.character, index, this.registry);
    if (r.kind === "ok") this.onChange();
    return r;
  }

  /** Equip with swap: if the target single-occupancy slot(s) are taken, unequip
   *  each conflicting occupant in turn, then equip. A single equip can produce a
   *  CHAIN of conflicts (e.g. a two-handed weapon conflicts with both a held
   *  mainhand weapon AND a shield), so this loops — unequip → re-equip — until
   *  the incoming item is placed or a small iteration cap trips (infinite-loop
   *  guard). Returns the display names of ALL unequipped occupants (for the UI
   *  to surface in a Notice), or {} when nothing was swapped.
   *
   *  Honesty contract: names are only returned when the incoming item actually
   *  ends up equipped. If the chain can't resolve (cap hit / unresolvable), the
   *  partial unequips are rolled back to a true no-op and {} is returned, so the
   *  Notice can never claim a swap that didn't happen. The Notice itself is fired
   *  by the UI call sites — edit-state stays runtime-free so node tests can
   *  exercise it without importing obsidian. */
  equipItemWithSwap(index: number): { unequipped?: string[] } {
    if (!this.registry) return {};
    // Snapshot equipped/slot so the chain can be rolled back to a true no-op if
    // it fails to resolve.
    const snapshot = this.character.equipment.map((e) => ({ equipped: e.equipped, slot: e.slot }));
    const names: string[] = [];
    let r = eq.equipItem(this.character, index, this.registry);
    let guard = 0;
    while (r.kind === "conflict" && guard < 3) {
      guard++;
      const occ = this.character.equipment[r.withIndex];
      const name = occ.overrides?.name
        ?? resolveEntityForEntry(occ.item, this.registry).entity?.name
        ?? occ.item;
      eq.unequipItem(this.character, r.withIndex);
      names.push(name);
      r = eq.equipItem(this.character, index, this.registry);
    }
    if (r.kind !== "ok") {
      // Unresolvable — restore the snapshot so we don't leave occupants stranded
      // and report nothing so the Notice never lies.
      this.character.equipment.forEach((e, i) => {
        e.equipped = snapshot[i].equipped;
        if (snapshot[i].slot === undefined) delete e.slot;
        else e.slot = snapshot[i].slot;
      });
      return {};
    }
    this.onChange();
    return names.length > 0 ? { unequipped: names } : {};
  }

  unequipItem(index: number): void {
    eq.unequipItem(this.character, index);
    this.onChange();
  }

  /** Attune an item and, when it lands attuned-but-unequipped, auto-equip it via
   *  the swap path so attunement implies "in use" (#10). The pure `eq.attuneItem`
   *  stays node-testable; the swap/rollback semantics come from `equipItemWithSwap`.
   *
   *  onChange-exactly-once: `equipItemWithSwap` fires onChange on the success path
   *  and mutates the entry in place, so after a resolved equip `entry.equipped`
   *  is true and we must NOT persist again. If the equip could not resolve it
   *  rolls back WITHOUT firing onChange (entry.equipped stays false), so we
   *  persist the attune ourselves. The captured `entry` reference is safe: every
   *  equipment mutation is in place — nothing replaces the array element. */
  attuneItem(index: number): eq.AttuneResult & { unequipped?: string[] } {
    if (!this.registry) return { kind: "ok" };
    const r = eq.attuneItem(this.character, index, this.registry);
    if (r.kind !== "ok") return r; // rejected/limit — attune unchanged, no persist
    const entry = this.character.equipment[index];
    if (entry?.attuned && !entry.equipped) {
      const swap = this.equipItemWithSwap(index);
      // equipItemWithSwap fired onChange iff the equip resolved. If it couldn't
      // (entry still not equipped after the rolled-back chain), persist the
      // attune ourselves so it isn't lost.
      if (!entry.equipped) this.onChange();
      return { ...r, ...swap };
    }
    this.onChange();
    return r;
  }

  unattuneItem(index: number): void {
    eq.unattuneItem(this.character, index);
    this.onChange();
  }

  setCharges(index: number, current: number, max?: number): void {
    eq.setCharges(this.character, index, current, max);
    this.onChange();
  }

  clearCharges(index: number): void {
    eq.clearCharges(this.character, index);
    this.onChange();
  }

  setCurrency(coin: "pp" | "gp" | "ep" | "sp" | "cp", value: number): void {
    eq.setCurrency(this.character, coin, value);
    this.onChange();
  }

  expendCharge(entryIdx: number, defaultMax?: number): void {
    eq.expendCharge(this.character, entryIdx, defaultMax);
    this.onChange();
  }

  restoreCharge(entryIdx: number, defaultMax?: number): void {
    eq.restoreCharge(this.character, entryIdx, defaultMax);
    this.onChange();
  }

  setItemCharges(entryIdx: number, newUsed: number, defaultMax?: number): void {
    eq.setItemCharges(this.character, entryIdx, newUsed, defaultMax);
    this.onChange();
  }

  setEquipmentOverride(idx: number, patch: Partial<EquipmentEntryOverrides>): void {
    eq.setEquipmentOverride(this.character, idx, patch);
    this.onChange();
  }

  setEquipmentState(idx: number, patch: Parameters<typeof eq.setEquipmentState>[2]): void {
    eq.setEquipmentState(this.character, idx, patch);
    this.onChange();
  }

  expendFeatureUse(featureKey: string): void {
    eq.expendFeatureUse(this.character, featureKey);
    this.onChange();
  }

  restoreFeatureUse(featureKey: string): void {
    eq.restoreFeatureUse(this.character, featureKey);
    this.onChange();
  }

  setFeatureUse(featureKey: string, n: number): void {
    eq.setFeatureUse(this.character, featureKey, n);
    this.onChange();
  }

  setAttunementLimitOverride(n: number): void {
    if (!Number.isFinite(n)) return;
    this.character.overrides.attunement_limit = Math.max(0, Math.floor(n));
    this.onChange();
  }

  clearAttunementLimitOverride(): void {
    delete this.character.overrides.attunement_limit;
    this.onChange();
  }

  // ─── Rest ──────────────────────────────────────────────────────────
  shortRest(optouts: Set<RestCategoryId>): void {
    const { resolved, derived } = this.getContext();
    const plan = computeRestPlan(this.character, resolved, derived, this.registry, "short");
    applyRestResets(this.character, resolved, derived, plan, optouts);
    this.onChange();
  }

  longRest(optouts: Set<RestCategoryId>): void {
    const { resolved, derived } = this.getContext();
    const plan = computeRestPlan(this.character, resolved, derived, this.registry, "long");
    applyRestResets(this.character, resolved, derived, plan, optouts);
    this.onChange();
  }

  // ─── Spell slots ───────────────────────────────────────────────────
  private slotTotal(level: number): number {
    const override = this.character.overrides.spell_slots?.[level];
    if (override !== undefined) return override;
    return this.getContext().derived.derivedSpellSlots?.[level] ?? 0;
  }

  expendSlot(level: number): void {
    const total = this.slotTotal(level);
    const slots = this.character.state.spell_slots ?? (this.character.state.spell_slots = {});
    const slot = slots[level] ?? (slots[level] = { used: 0, total });
    // `total` is a derived cache; resync it but do NOT fire onChange for that alone
    // (the cap path below returns without notifying — a pure cache touch must not dirty the file).
    slot.total = total;
    if (slot.used >= total) return;
    slot.used += 1;
    this.onChange();
  }

  restoreSlot(level: number): void {
    const slot = this.character.state.spell_slots?.[level];
    if (!slot || slot.used <= 0) return;
    slot.used -= 1;
    this.onChange();
  }

  /**
   * Spend one use of a recovery-bearing resource (e.g. Wizard Arcane Recovery)
   * to restore spell slots. `picks` maps spell level → count to restore. The
   * UI enforces the level-total budget; this clamps per-slot (never below 0)
   * and ignores levels above 5 (RAW cap).
   */
  useRecovery(resourceId: string, picks: Record<number, number>): void {
    const fu = this.character.state.feature_uses?.[resourceId];
    if (!fu || fu.used >= fu.max) return;
    const slots = this.character.state.spell_slots ?? (this.character.state.spell_slots = {});
    for (const [lvlStr, count] of Object.entries(picks)) {
      const lvl = Number(lvlStr);
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 5) continue;
      const slot = slots[lvl];
      if (!slot) continue;
      slot.used = Math.max(0, slot.used - Math.max(0, Math.floor(count)));
    }
    fu.used += 1;
    this.onChange();
  }

  expendPactSlot(): void {
    const pact = this.getContext().derived.pactMagic;
    if (!pact) return;
    const p = this.character.state.spell_slots_pact ?? (this.character.state.spell_slots_pact = { level: pact.level, used: 0, total: pact.total });
    p.level = pact.level;
    p.total = pact.total;
    if (p.used >= pact.total) return;
    p.used += 1;
    this.onChange();
  }

  restorePactSlot(): void {
    const p = this.character.state.spell_slots_pact;
    if (!p || p.used <= 0) return;
    p.used -= 1;
    this.onChange();
  }

  setSlotOverride(level: number, total: number): void {
    const o = this.character.overrides.spell_slots ?? (this.character.overrides.spell_slots = {});
    o[level] = total;
    this.onChange();
  }

  clearSlotOverride(level: number): void {
    const o = this.character.overrides.spell_slots;
    if (!o || o[level] === undefined) return;
    delete o[level];
    this.onChange();
  }

  breakConcentration(): void {
    if (this.character.state.concentration === null) return;
    this.character.state.concentration = null;
    this.onChange();
  }

  setSpellsView(mode: "by-level" | "table"): void {
    if (this.character.spells.view === mode) return;
    this.character.spells.view = mode;
    this.onChange();
  }

  // ─── Known spell list ──────────────────────────────────────────────
  private static bare(ref: string): string {
    const m = ref.match(/^\[\[(.+?)\]\]$/);
    return m ? m[1] : ref;
  }

  private static slugOf(entry: KnownSpellEntry): string {
    return CharacterEditState.bare(typeof entry === "string" ? entry : entry.spell);
  }

  togglePrepared(slug: string): void {
    const known = this.character.spells.known;
    const idx = known.findIndex((e) => CharacterEditState.slugOf(e) === slug);
    if (idx === -1) return;
    const entry = known[idx];
    if (typeof entry === "string") {
      known[idx] = { spell: entry, prepared: true };
    } else {
      entry.prepared = !entry.prepared;
    }
    this.onChange();
  }

  addKnownSpell(slug: string, opts?: { class?: string; source?: "class" | "feat" | "item" | "race" | "domain"; alwaysPrepared?: boolean }): void {
    const bare = CharacterEditState.bare(slug);
    if (this.character.spells.known.some((e) => CharacterEditState.slugOf(e) === bare)) return;
    const ref = `[[${bare}]]`;
    if (!opts || (!opts.class && !opts.source && !opts.alwaysPrepared)) {
      this.character.spells.known.push(ref);
    } else {
      this.character.spells.known.push({
        spell: ref,
        ...(opts.class ? { class: `[[${CharacterEditState.bare(opts.class)}]]` } : {}),
        ...(opts.source ? { source: opts.source } : {}),
        ...(opts.alwaysPrepared ? { always_prepared: true } : {}),
      });
    }
    this.onChange();
  }

  removeKnownSpell(slug: string): void {
    const before = this.character.spells.known.length;
    this.character.spells.known = this.character.spells.known.filter((e) => CharacterEditState.slugOf(e) !== slug);
    if (this.character.spells.known.length !== before) this.onChange();
  }

  // ─── Casting ───────────────────────────────────────────────────────
  private resolvedSpell(slug: string) {
    return this.getContext().resolved.spells?.find((s) => s.slug === slug) ?? null;
  }

  private setConcentrationIfNeeded(slug: string): void {
    const sp = this.resolvedSpell(slug);
    if (sp?.entity.concentration) this.character.state.concentration = slug;
  }

  castSpell(slug: string, atLevel: number): void {
    // Bail if no slot is available — a failed cast must set nothing (no slot,
    // no concentration), so it can't leave stale concentration to be persisted
    // by a later unrelated edit.
    const total = this.slotTotal(atLevel);
    const used = this.character.state.spell_slots?.[atLevel]?.used ?? 0;
    if (used >= total) return;
    // Set concentration BEFORE expending: expendSlot fires the single onChange,
    // and the render it triggers must see concentration already applied
    // (otherwise the banner lags one frame behind the slot pip).
    this.setConcentrationIfNeeded(slug);
    this.expendSlot(atLevel);
  }

  castPactSpell(slug: string): void {
    // Mirror castSpell for Pact Magic: bail if there's no pact progression or no
    // remaining pact slot — a failed cast must set nothing (no slot, no
    // concentration). Set concentration BEFORE expendPactSlot fires onChange so
    // the render it triggers already reflects the concentration banner.
    const pact = this.getContext().derived.pactMagic;
    if (!pact) return;
    const used = this.character.state.spell_slots_pact?.used ?? 0;
    if (used >= pact.total) return;
    this.setConcentrationIfNeeded(slug);
    this.expendPactSlot();
  }

  castAsRitual(slug: string): void {
    this.setConcentrationIfNeeded(slug);
    this.onChange();
  }

  castCantrip(_slug: string): void {
    // Cantrips spend no slot and (per SP4c) set no concentration, so a cast
    // changes no persistent state — intentionally a true no-op. We do NOT fire
    // onChange, to avoid dirtying/re-writing the file for an action with no
    // state delta. A future cast-log that actually persists can re-add a notify.
  }
}
