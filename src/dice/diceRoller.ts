/**
 * Dice roller utility for D&D dice notation
 */

export interface DiceRoll {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  details: string;
}

export interface DiceRollResult {
  success: boolean;
  roll?: DiceRoll;
  error?: string;
}

/**
 * Roll dice based on standard notation (e.g., "2d6+3", "1d20-2")
 */
export function rollDice(notation: string): DiceRollResult {
  try {
    // Clean up the notation
    const cleanNotation = notation.trim().toLowerCase();

    // Special handling for d100/percentile dice
    if (cleanNotation === 'd100' || cleanNotation === '1d100') {
      return rollD100();
    }

    // Match standard dice notation: XdY[+/-Z]
    const match = cleanNotation.match(/^(\d+)d(\d+)([+-]\d+)?$/);

    if (!match) {
      // Try to match simple dY notation like "d20+5" or just "d20"
      const simpleMatch = cleanNotation.match(/^d(\d+)([+-]\d+)?$/);
      if (simpleMatch) {
        const [, sides, modifierStr] = simpleMatch;
        // Recursively call rollDice with expanded notation but preserve original
        const expandedResult = rollDice(`1d${sides}${modifierStr || ''}`);
        if (expandedResult.success && expandedResult.roll) {
          expandedResult.roll.notation = notation; // Preserve original notation
        }
        return expandedResult;
      }

      return {
        success: false,
        error: `Invalid dice notation: ${notation}`,
      };
    }

    const [, numDiceStr, sidesStr, modifierStr] = match;
    const numDice = parseInt(numDiceStr);
    const sides = parseInt(sidesStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    // Validate dice parameters
    if (numDice < 1 || numDice > 100) {
      return {
        success: false,
        error: 'Number of dice must be between 1 and 100',
      };
    }

    if (sides < 2 || sides > 1000) {
      return {
        success: false,
        error: 'Number of sides must be between 2 and 1000',
      };
    }

    // Special handling for d100 when using standard notation
    if (sides === 100 && numDice === 1) {
      const d100Result = rollD100();
      if (d100Result.success && d100Result.roll && modifier !== 0) {
        // Apply modifier to d100 result
        d100Result.roll.modifier = modifier;
        d100Result.roll.total = Math.max(0, d100Result.roll.total + modifier);
        d100Result.roll.notation = notation;
        d100Result.roll.details =
          d100Result.roll.details.replace(/ = \d+$/, '') +
          ` ${modifier >= 0 ? '+' : ''}${modifier} = ${d100Result.roll.total}`;
      }
      return d100Result;
    }

    // Roll the dice
    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const subtotal = rolls.reduce((sum, roll) => sum + roll, 0);
    const total = subtotal + modifier;

    // Build details string
    let details = rolls.join(' + ');
    if (modifier !== 0) {
      details += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
    }
    details += ` = ${total}`;

    return {
      success: true,
      roll: {
        notation,
        rolls,
        modifier,
        total: Math.max(0, total), // Ensure non-negative
        details,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to roll dice: ${error}`,
    };
  }
}

/**
 * Roll a d20 with advantage or disadvantage
 */
export function rollD20(modifier = 0, type: 'normal' | 'advantage' | 'disadvantage' = 'normal'): DiceRoll {
  const rolls: number[] = [];

  if (type === 'normal') {
    rolls.push(Math.floor(Math.random() * 20) + 1);
  } else {
    // Roll twice for advantage/disadvantage
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    rolls.push(roll1, roll2);
  }

  let total: number;
  let details: string;

  if (type === 'advantage') {
    const higher = Math.max(...rolls);
    total = higher + modifier;
    details = `${rolls[0]}, ${rolls[1]} (took ${higher})`;
    if (modifier !== 0) {
      details += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
    }
    details += ` = ${total}`;
  } else if (type === 'disadvantage') {
    const lower = Math.min(...rolls);
    total = lower + modifier;
    details = `${rolls[0]}, ${rolls[1]} (took ${lower})`;
    if (modifier !== 0) {
      details += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
    }
    details += ` = ${total}`;
  } else {
    total = rolls[0] + modifier;
    details = `${rolls[0]}`;
    if (modifier !== 0) {
      details += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
    }
    details += ` = ${total}`;
  }

  const notation = modifier === 0 ? 'd20' : `d20${modifier >= 0 ? '+' : ''}${modifier}`;

  return {
    notation,
    rolls,
    modifier,
    total: Math.max(0, total),
    details,
  };
}

/**
 * Roll for recharge (typically d6)
 */
export function rollRecharge(targetValue: number): { success: boolean; roll: number; details: string } {
  const roll = Math.floor(Math.random() * 6) + 1;
  const success = roll >= targetValue;
  const details = `Rolled ${roll} (needed ${targetValue}+) - ${success ? 'Recharged!' : 'Not recharged'}`;

  return { success, roll, details };
}

/**
 * Roll percentile (d100)
 */
export function rollPercentile(targetChance?: number): { roll: number; success?: boolean; details: string } {
  const roll = Math.floor(Math.random() * 100) + 1;

  if (targetChance !== undefined) {
    const success = roll <= targetChance;
    const details = `Rolled ${roll} (needed \u2264${targetChance}) - ${success ? 'Success!' : 'Failed'}`;
    return { roll, success, details };
  }

  return { roll, details: `Rolled ${roll}` };
}

/**
 * Roll d100 using percentile dice (tens die + ones die)
 */
export function rollD100(): DiceRollResult {
  // Roll tens die (0-9, representing 00-90)
  const tens = Math.floor(Math.random() * 10) * 10;
  // Roll ones die (1-10, where 10 represents 0)
  const onesRaw = Math.floor(Math.random() * 10) + 1;
  const ones = onesRaw === 10 ? 0 : onesRaw;

  // Calculate result (00 + 0 = 100, otherwise tens + ones)
  const result = tens === 0 && ones === 0 ? 100 : tens + ones;

  // Format the display
  const tensDisplay = tens === 0 ? '00' : tens.toString();
  const onesDisplay = ones.toString();

  return {
    success: true,
    roll: {
      notation: 'd100',
      rolls: [result], // Store the actual result
      modifier: 0,
      total: result,
      details: `${tensDisplay} + ${onesDisplay} = ${result}`,
    },
  };
}

/**
 * Check if a d20 roll is a critical hit or critical miss
 */
export function checkCritical(roll: number): 'crit' | 'critFail' | null {
  if (roll === 20) return 'crit';
  if (roll === 1) return 'critFail';
  return null;
}

/**
 * Format a dice roll result for display
 */
export function formatDiceRoll(roll: DiceRoll, includeNotation = true): string {
  let result = '';

  if (includeNotation) {
    result += `${roll.notation}: `;
  }

  result += roll.details;

  // Check for nat 20 or nat 1 on d20 rolls
  if (roll.notation.match(/^d20/i) && roll.rolls.length === 1) {
    const crit = checkCritical(roll.rolls[0]);
    if (crit === 'crit') {
      result += ' (NAT 20)';
    } else if (crit === 'critFail') {
      result += ' (NAT 1)';
    }
  }

  return result;
}
