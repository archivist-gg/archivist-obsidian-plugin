import type { EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { GrantedEntry } from "./equipment-seed";
import { MAX_COIN } from "../pc.coin-math";

/** The builder's per-view-session claim on this wallet.
 *  `applied` · gold it has actually deposited this session, PLUS (after an adopt)
 *  the contribution its selections already justified when the session began.
 *  `lastG`   · the contribution its selections justified at the last reconcile.
 *  They diverge only when a clamp bites; that divergence is the whole point of
 *  the pair (a single scalar creates gold · see the spec's G18 sequence). */
export interface GoldBaseline { applied: number; lastG: number; }

export interface GoldStep { landed: number; applied: number; lastG: number; }

/**
 * The gold state machine. Returns the next baseline plus the amount to hand to
 * `adjustCurrency`, or `null` when there is nothing to do at all.
 *
 * `null` means NOTHING TO DO: rule 2 (`G === lastG`), or a non-finite `G`
 * (guarded first, below). It never means adopt: an adopt returns a step with
 * `landed: 0` so the caller still seeds the bag · conflating the two would leave
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
  // A non-finite contribution owes nothing either way and must never reach the
  // pair: once `lastG` is NaN, rule 2 can never fire again and the poison is
  // permanent. Unreachable with schema-validated data (`fixed`, `multiplier` and
  // `gold` are finite ints; `itemCost` already maps non-numbers to 0); kept as
  // the defence `syncStartingEquipment` used to carry for its `gold` argument.
  if (!Number.isFinite(G)) return null;
  // Rule 1 · adopt. No claim yet, so make no claim on the wallet either.
  if (!baseline) return { landed: 0, applied: G, lastG: G };
  // Rule 2 · the justified contribution is unchanged; nothing is owed either way.
  if (G === baseline.lastG) return null;
  // Rule 3 · settle the difference against what was actually deposited, clamped
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

/** The UNTAGGED multiset both gear reads share: the `[[…]]`-stripped reference of
 *  every entry the file holds with NO `granted_by`, counted by qty (a missing or
 *  sub-1 qty counts as one). Factored out so the gate and the subtraction below
 *  can never key or count differently: a divergence would let the gate suppress a
 *  seed the subtraction still emits, or the reverse. Free text (Volker's
 *  `Traveler pack`) has no reference and is therefore never in the map. */
function untaggedHave(equipment: EquipmentEntry[]): Map<string, number> {
  const have = new Map<string, number>();
  for (const e of equipment) {
    if (e.granted_by) continue;
    const ref = wikilinkRef(e.item);
    if (!ref) continue;
    have.set(ref, (have.get(ref) ?? 0) + Math.max(1, e.qty ?? 1));
  }
  return have;
}

/**
 * The gear gate: true when the builder should NOT re-seed. Both conjuncts:
 *
 *  1. the builder owns no `builder:starting` entries to reconcile against, and
 *  2. every resolved entry is already present as an UNTAGGED entry.
 *
 * Together these are the state `finishBuild` creates · it strips every
 * `granted_by`, so the kit the builder seeded becomes indistinguishable from
 * hand-managed gear and the ordinary replace-in-place reconcile would push a
 * second copy on every visit. Matching is a MULTISET containment on the
 * `[[…]]`-stripped reference expanded by qty: both sides carry the FULL edition
 * slug (`resolveGrants` pushes `r.fullSlug`; `syncStartingEquipment` writes
 * `[[${slug}]]`), so no bare-izing is applied to either side.
 *
 * It is the CHEAP COMMON CASE of the reconcile, not the whole rule: when it is
 * false the step still subtracts what the file already holds, with
 * `uncoveredByUntagged` below.
 */
export function alreadySeeded(resolved: GrantedEntry[], equipment: EquipmentEntry[]): boolean {
  if (equipment.some((e) => e.granted_by === "builder:starting")) return false;

  const need = new Map<string, number>();
  for (const r of resolved) need.set(r.slug, (need.get(r.slug) ?? 0) + Math.max(1, r.qty));

  const have = untaggedHave(equipment);
  for (const [ref, n] of need) if ((have.get(ref) ?? 0) < n) return false;
  return true;
}

/**
 * The qty-aware multiset SUBTRACTION the step actually seeds: the resolved kit
 * minus the copies the file already holds untagged, in resolved order. Each
 * entry consumes `max(1, qty)` from its slug's remaining untagged count; a fully
 * covered entry is dropped, a partly covered one is emitted with the REMAINING
 * qty, an uncovered one is emitted UNCHANGED (the same object, so a fresh draft
 * is seeded exactly what `resolveGrants` produced). Nothing is mutated: the
 * running count lives in a local map.
 *
 * Four consequences, all intended:
 *  1. a FRESH draft (no untagged gear) is seeded the full kit · unchanged;
 *  2. a TAGGED draft with no untagged copies is replaced in place · unchanged
 *     (nothing covers anything, so the subtraction is the identity);
 *  3. a FINISHED character re-entering the step (`finishBuild` stripped every
 *     `granted_by`) is seeded only what it does not already hold · in practice
 *     the background `fixed` grant it never held, e.g. the Acolyte's pouch ·
 *     and the next render is a no-op, because the tagged block it then holds
 *     serializes equal to the same single entry (`syncStartingEquipment`);
 *  4. a draft that hand-added a kit item untagged BEFORE the first seed receives
 *     no second copy of it. That is a NAMED, benign semantic change to R4-P5b's
 *     replacement contract (which re-seeded the whole list whenever containment
 *     failed) and it is what discharges that phase's E5 duplication residual.
 *
 * A "finished-character signature" test instead of this subtraction would not
 * hold: the second render sees the builder's own new tag, fails conjunct 1 of
 * `alreadySeeded`, replaces with the full list, and the duplicate comes back.
 */
export function uncoveredByUntagged(resolved: GrantedEntry[], equipment: EquipmentEntry[]): GrantedEntry[] {
  const have = untaggedHave(equipment);
  const out: GrantedEntry[] = [];
  for (const r of resolved) {
    const want = Math.max(1, r.qty);
    const covered = Math.min(want, have.get(r.slug) ?? 0);
    if (covered > 0) have.set(r.slug, (have.get(r.slug) ?? 0) - covered);
    if (covered === 0) out.push(r);
    else if (covered < want) out.push({ ...r, qty: want - covered });
  }
  return out;
}
