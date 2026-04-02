import type { EditableMonster } from "../dnd/editable-monster";
import { monsterToEditable, editableToMonster } from "../dnd/editable-monster";
import { recalculate } from "../dnd/recalculate";
import { editableToYaml } from "../dnd/yaml-serializer";
import type { Monster } from "../types/monster";

export class MonsterEditState {
  private original: Monster;
  private _current: EditableMonster;
  private _hasPendingChanges = false;
  private onChange: (state: MonsterEditState) => void;

  constructor(monster: Monster, onChange: (state: MonsterEditState) => void) {
    this.original = monster;
    this._current = monsterToEditable(monster);
    this.onChange = onChange;
  }

  get current(): EditableMonster { return this._current; }
  get hasPendingChanges(): boolean { return this._hasPendingChanges; }

  updateField(field: string, value: unknown): void {
    setNestedField(this._current, field, value);
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  toggleSaveProficiency(ability: string): void {
    this._current.saveProficiencies[ability] = !this._current.saveProficiencies[ability];
    this._current = recalculate(this._current, `saves.${ability}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  cycleSkillProficiency(skill: string): void {
    const current = this._current.skillProficiencies[skill] ?? "none";
    const next = current === "none" ? "proficient" : current === "proficient" ? "expertise" : "none";
    this._current.skillProficiencies[skill] = next;
    this._current = recalculate(this._current, `skills.${skill}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  setOverride(field: string, value: number): void {
    this._current.overrides.add(field);
    setNestedField(this._current, field, value);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  clearOverride(field: string): void {
    this._current.overrides.delete(field);
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addSection(section: string): void {
    if (!this._current.activeSections.includes(section)) {
      this._current.activeSections.push(section);
      const key = sectionToMonsterKey(section);
      if (key && !(this._current as Record<string, unknown>)[key]) {
        (this._current as Record<string, unknown>)[key] = [];
      }
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  removeSection(section: string): void {
    this._current.activeSections = this._current.activeSections.filter(s => s !== section);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addFeature(sectionKey: string): void {
    const features = (this._current as Record<string, unknown>)[sectionKey] as Array<{name: string; entries: string[]}> | undefined;
    if (features) {
      features.push({ name: "New Feature", entries: [""] });
    } else {
      (this._current as Record<string, unknown>)[sectionKey] = [{ name: "New Feature", entries: [""] }];
    }
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  removeFeature(sectionKey: string, index: number): void {
    const features = (this._current as Record<string, unknown>)[sectionKey] as Array<unknown> | undefined;
    if (features && index >= 0 && index < features.length) {
      features.splice(index, 1);
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  toYaml(): string {
    return editableToYaml(this._current);
  }

  toMonster(): Monster {
    return editableToMonster(this._current);
  }

  cancel(): void {
    this._current = monsterToEditable(this.original);
    this._hasPendingChanges = false;
    this.onChange(this);
  }
}

function sectionToMonsterKey(section: string): string | null {
  const map: Record<string, string> = {
    traits: "traits", actions: "actions", reactions: "reactions",
    legendary: "legendary", "bonus actions": "bonus_actions",
    "legendary actions": "legendary", "lair actions": "lair_actions",
    "mythic actions": "mythic_actions",
  };
  return map[section.toLowerCase()] ?? null;
}

function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
