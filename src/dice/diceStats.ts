// src/dice/diceStats.ts

export interface DiceStats {
  average: number;
  min: number;
  max: number;
}

/**
 * Calculate average, min, max for a dice notation like "2d6+3"
 */
export function calculateDiceStats(notation: string): DiceStats | null {
  const clean = notation.trim().toLowerCase();
  const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;

  const numDice = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  return {
    average: numDice * (sides + 1) / 2 + modifier,
    min: numDice + modifier,
    max: numDice * sides + modifier,
  };
}

/**
 * Format dice stats for tooltip display
 */
export function formatDiceTooltip(notation: string): string {
  const stats = calculateDiceStats(notation);
  if (!stats) return `${notation} -- Click to roll`;
  return `${notation} (avg ${stats.average}, range ${stats.min}-${stats.max}) -- Click to roll`;
}
