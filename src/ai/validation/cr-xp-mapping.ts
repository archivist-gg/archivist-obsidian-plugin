export const CR_TO_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

export function parseCR(cr: string): number {
  if (!cr) return 0;
  if (cr.includes("/")) {
    const [num, denom] = cr.split("/").map(Number);
    return num / denom;
  }
  return Number(cr) || 0;
}

export function getChallengeRatingXP(cr: string): number {
  return CR_TO_XP[cr] ?? 0;
}

export function getProficiencyBonus(cr: string): number {
  const v = parseCR(cr);
  if (v < 5) return 2;
  if (v < 9) return 3;
  if (v < 13) return 4;
  if (v < 17) return 5;
  if (v < 21) return 6;
  if (v < 25) return 7;
  if (v < 29) return 8;
  return 9;
}
