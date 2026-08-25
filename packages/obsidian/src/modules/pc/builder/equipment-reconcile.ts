import type { EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { GrantedEntry } from "./equipment-seed";
import { MAX_COIN } from "../pc.coin-math";

/** The builder's per-view-session claim on this wallet.
 *  `applied` — gold it has actually deposited this session, PLUS (after an adopt)
 *  the contribution its selections already justified when the session began.
 *  `lastG`   — the contribution its selections justified at the last reconcile.
 *  They diverge only when a clamp bites; that divergence is the whole point of
 *  the pair (a single scalar creates gold — see the spec's G18 sequence). */
export interface GoldBaseline { applied: number; lastG: number; }

export interface GoldStep { landed: number; applied: number; lastG: number; }

/**
 * The gold state machine. Returns the next baseline plus the amount to hand to
 * `adjustCurrency`, or `null` when there is nothing to do at all.
 *
 * `null` means RULE 2 ONLY (`G === lastG`). An adopt returns a step with
 * `landed: 0` so the caller still seeds the bag — conflating the two would leave
 * the bag unseeded forever and the builder would silently never grant anything.
 *
 * The caller MUST commit the returned `applied`/`lastG` to its store BEFORE
 * calling the mutator: the mutator re-renders synchronously and `G` does not
 * depend on the wallet, so a store write placed after the call re-derives the
 * same amount and re-applies it without bound.
 */
export function goldStep(input: {
  G: number;
  baseline: GoldBaseline | null;
  currentGp: number;
}): GoldStep | null {
  const { G, baseline, currentGp } = input;
  // Rule 1 — adopt. No claim yet, so make no claim on the wallet either.
  if (!baseline) return { landed: 0, applied: G, lastG: G };
  // Rule 2 — the justified contribution is unchanged; nothing is owed either way.
  if (G === baseline.lastG) return null;
  // Rule 3 — settle the difference against what was actually deposited, clamped
  // to the same window `adjustCurrency` would clamp to, so `landed` is exact.
  const intended = Math.trunc(G - baseline.applied);
  const landed = Math.max(-currentGp, Math.min(MAX_COIN - currentGp, intended));
  return { landed, applied: baseline.applied + landed, lastG: G };
}

/** Strip a `[[wikilink]]` to its reference. Free text (Volker's `Traveler pack`)
 *  returns null and can therefore never satisfy a resolved grant. */
function wikilinkRef(item: string): string | null {
  const m = /^\[\[(.+)\]\]$/.exec(item.trim());
  return m ? m[1] : null;
}

/**
 * The gear gate: true when the builder should NOT re-seed. Both conjuncts:
 *
 *  1. the builder owns no `builder:starting` entries to reconcile against, and
 *  2. every resolved entry is already present as an UNTAGGED entry.
 *
 * Together these are the state `finishBuild` creates — it strips every
 * `granted_by`, so the kit the builder seeded becomes indistinguishable from
 * hand-managed gear and the ordinary replace-in-place reconcile would push a
 * second copy on every visit. Matching is a MULTISET containment on the
 * `[[…]]`-stripped reference expanded by qty: both sides carry the FULL edition
 * slug (`resolveGrants` pushes `r.fullSlug`; `syncStartingEquipment` writes
 * `[[${slug}]]`), so no bare-izing is applied to either side.
 */
export function alreadySeeded(resolved: GrantedEntry[], equipment: EquipmentEntry[]): boolean {
  if (equipment.some((e) => e.granted_by === "builder:starting")) return false;

  const need = new Map<string, number>();
  for (const r of resolved) need.set(r.slug, (need.get(r.slug) ?? 0) + Math.max(1, r.qty));

  const have = new Map<string, number>();
  for (const e of equipment) {
    if (e.granted_by) continue;
    const ref = wikilinkRef(e.item);
    if (!ref) continue;
    have.set(ref, (have.get(ref) ?? 0) + Math.max(1, e.qty ?? 1));
  }

  for (const [ref, n] of need) if ((have.get(ref) ?? 0) < n) return false;
  return true;
}
