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
    const { derived } = this.getContext();
    const hp = this.character.state.hp;
    const wasZero = hp.current === 0;
    const next = Math.min(hp.current + Math.max(0, amount), derived.hp.max);
    hp.current = next;
    if (wasZero && next > 0) this.clearDeathSavesNoNotify();
    this.onChange();
  }

  damage(amount: number): void {
    const hp = this.character.state.hp;
    const n = Math.max(0, amount);
    const fromTemp = Math.min(hp.temp, n);
    hp.temp -= fromTemp;
    hp.current = Math.max(0, hp.current - (n - fromTemp));
    this.onChange();
  }

  setTempHP(amount: number): void {
    this.character.state.hp.temp = Math.max(0, amount);
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
    this.character.state.inspiration = Math.max(0, Math.floor(value));
    this.onChange();
  }

  // ─── Death saves (helper — full wiring in Task 5) ──────────────────
  private clearDeathSavesNoNotify(): void {
    if (this.character.state.death_saves) {
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

// Keep unused imports referenced for future tasks (Ability, SkillSlug, ConditionSlug).
export type _unused = [Ability, SkillSlug, ConditionSlug];
