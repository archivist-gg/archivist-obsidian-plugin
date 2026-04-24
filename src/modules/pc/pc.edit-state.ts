import type { Ability, SkillSlug } from "../../shared/types";
import type { Character, DerivedStats, ResolvedCharacter } from "./pc.types";
import type { ConditionSlug } from "./constants/conditions";
import { characterToYaml } from "./pc.yaml-serializer";

export interface EditStateContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
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

  // ─── Saves (override mutation) ─────────────────────────────────────
  /**
   * Flip the saving-throw proficient bit against the class-derived baseline.
   *
   * Writes `{ bonus: <preserved>, proficient: !effective }` into
   * `overrides.saves[ability]`, creating the entry if absent. The override is
   * NEVER cleared here even when the new proficient matches the class baseline;
   * callers who want "no override" must use `clearSaveOverride(ability)`
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

  clearSaveOverride(ability: Ability): void {
    if (!this.character.overrides.saves) return;
    delete this.character.overrides.saves[ability];
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

  toYaml(): string {
    return characterToYaml(this.character);
  }
}
