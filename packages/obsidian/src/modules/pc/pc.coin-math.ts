/**
 * Pure coin math for the PC currency system (R3-P5 coin modal).
 *
 * Lives at the pc module ROOT (not components/) so the model layer
 * (pc.equipment-edit.ts) imports it sideways without a model→components
 * arrow violation; components import it downward. This module imports
 * nothing and touches no DOM. All math is integer copper — no floats.
 */

export type Coin = "pp" | "gp" | "ep" | "sp" | "cp";

/** Render/storage order: highest denomination first (user-locked PP→CP). */
export const COIN_KEYS: readonly Coin[] = ["pp", "gp", "ep", "sp", "cp"];

/** Ledger display metadata. `hint` is the conversion line under the name;
 *  gold is the base unit and has none. */
export const COIN_META: Record<Coin, { name: string; hint: string | null }> = {
  pp: { name: "Platinum", hint: "1 pp = 10 gp" },
  gp: { name: "Gold", hint: null },
  ep: { name: "Electrum", hint: "1 gp = 2 ep" },
  sp: { name: "Silver", hint: "1 gp = 10 sp" },
  cp: { name: "Copper", hint: "1 gp = 100 cp" },
};

/** Per-denomination ceiling — the cap the inline strip's numberField already
 *  enforced (currency-strip). */
export const MAX_COIN = 999_999;

const CP_VALUE: Record<Coin, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };

export type CurrencyLike = Partial<Record<Coin, number>> | undefined | null;

/** Total wealth in integer copper; missing keys / absent object count as 0. */
export function totalCp(currency: CurrencyLike): number {
  let total = 0;
  for (const coin of COIN_KEYS) total += (currency?.[coin] ?? 0) * CP_VALUE[coin];
  return total;
}

/** Integer-copper total → gp string with up to 2 decimals, trailing zeros
 *  trimmed: 17287→"172.87", 17050→"170.5", 17000→"170", 0→"0". */
export function formatGpTotal(cpTotal: number): string {
  const whole = Math.floor(cpTotal / 100);
  const frac = cpTotal % 100;
  if (frac === 0) return String(whole);
  if (frac % 10 === 0) return `${whole}.${frac / 10}`;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

/** Atomic-adjust validation: a coin is offending exactly when its resulting
 *  value would leave [0, MAX_COIN]. Pure check; mutates nothing. */
export function validateAdjust(
  currency: CurrencyLike,
  deltas: Partial<Record<Coin, number>>,
): { ok: boolean; offending: Coin[] } {
  const offending: Coin[] = [];
  for (const coin of COIN_KEYS) {
    const delta = deltas[coin];
    if (delta === undefined) continue;
    const next = (currency?.[coin] ?? 0) + delta;
    if (next < 0 || next > MAX_COIN) offending.push(coin);
  }
  return { ok: offending.length === 0, offending };
}

/** Adjust-box contents → deltas. Boxes are digit-only strings (the modal
 *  strips non-digits on input). parseInt base 10; leading zeros permitted
 *  ("007"→7). Empty boxes and boxes parsing to 0 (or NaN) contribute NO
 *  delta — ignored, never offending. `sign`: +1 Add, -1 Subtract. Returns
 *  {} when nothing yields a non-zero delta (callers treat as complete no-op). */
export function assembleDeltas(
  raw: Partial<Record<Coin, string>>,
  sign: 1 | -1,
): Partial<Record<Coin, number>> {
  const deltas: Partial<Record<Coin, number>> = {};
  for (const coin of COIN_KEYS) {
    const text = (raw[coin] ?? "").trim();
    if (text === "") continue;
    const parsed = parseInt(text, 10);
    if (!Number.isFinite(parsed) || parsed === 0) continue;
    deltas[coin] = sign * parsed;
  }
  return deltas;
}
