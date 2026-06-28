export interface EncounterMonster {
  name: string;
  cr: string;
  count: number;
  role: string;
}

export interface EncounterXPBudget {
  target: number;
  actual: number;
  difficulty_rating: string;
}

export interface Encounter {
  monsters: EncounterMonster[];
  tactics: string;
  terrain: string;
  notes: string;
  xp_budget: EncounterXPBudget;
}
