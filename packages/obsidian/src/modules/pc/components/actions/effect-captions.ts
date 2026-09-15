import type { FeatureEffect } from "@archivist-gg/dnd5e/types/feature-effect";
import { ROLL_MODE_WORD, ROLL_NOUN } from "@archivist-gg/dnd5e/pc/roll-tag-labels";
import { costLabel } from "../../../../shared/rendering/action-cost-label";
import { plainText } from "../../../../shared/rendering/plain-text";
import { setTooltip } from "obsidian";
import type { ComponentRenderContext } from "../component.types";

/**
 * R4-G3a §4 · the row-local caption line.
 *
 * Six effect shapes carry information the sheet had nowhere to put: `heal` and `temp-hp` (their
 * amounts), `extra-action` (what extra action, and how many), a CONDITIONAL `sense` or
 * `proficiency` (R4-G4 §9.4), and EVERY effect written on someone other than the character. The
 * first three fold nothing by design (invariant 5: a heal is a caption, never an auto-write of
 * `state.hp.*`); the last is refused by the engine's `subject` guard (invariant 1) and so has no
 * derived surface at all. The `sense` / `proficiency` pair is the one group that DOES fold: what is
 * dropped there is only the QUALIFIER, so those two caption on `condition` and on nothing else.
 *
 * Every caller hands over its own RAW `effects` array, never `selfEffectsOf`: the non-self effects
 * are precisely the ones the fold drops, so filtering by the guard here would erase the case this
 * exists for.
 *
 * `amount` is ECHOED VERBATIM, never evaluated (§4.2.2). The measured amounts are English prose
 * ("1d10 + your fighter level"), and `evaluateMaxFormula` has no dice production and rejects
 * unknown identifiers: it THROWS on 64 of the 67 sites. Echoing is what a reader wants anyway.
 *
 * Invariant 3 (rendering policy from data): every user-visible word comes from a table or from the
 * effect's own fields. The two tables are `NOUN` below and the shared action-cost label table;
 * `ROLL_MODE_WORD` / `ROLL_NOUN` are the dnd5e-side vocabulary, declared beside the chip tags.
 * `restate` is not a vocabulary switch: each arm is a mechanical restatement of that arm's OWN
 * declared fields, which is exactly what a caption for an unmodelled imposition can say.
 *
 * One field is read differently per arm, and it has to be: `condition` is a QUALIFIER on the arms
 * built from `& Qualified` and the condition NAME on `apply-condition` / `immune-condition`
 * (`& Subject`). `CONDITION_IS_NAME` below is that split, so the name stays in the caption body and
 * only a real qualifier becomes a tooltip.
 */

/** The two healing-shaped kinds, as a reader names them. */
const NOUN: Record<"heal" | "temp-hp", string> = { heal: "Heals", "temp-hp": "Temp HP" };

/** Present and not "self" · the engine refuses to fold it, so the row is the only place it shows. */
const isNonSelf = (e: { subject?: string }) => e.subject !== undefined && e.subject !== "self";

/**
 * The kinds whose `condition` key is the condition NAME rather than a prose qualifier.
 * dnd5e `types/feature-effect.ts` builds these two arms from `& Subject`, not `& Qualified`, and
 * spells the reason in the `Qualified` docblock. Treating their name as a qualifier inverts the
 * output: the name would move to a hover and the caption body would be left with the leftover
 * fields. A set rather than an inline `kind === … || kind === …` so the rule is data, readable at a
 * glance, and extends where the type does (invariant 3).
 */
const CONDITION_IS_NAME: ReadonlySet<FeatureEffect["kind"]> = new Set(["apply-condition", "immune-condition"]);

/**
 * One arm's own fields, restated. The `subject` string is echoed verbatim rather than narrated:
 * its vocabulary is the converter's, open and unmapped, so "the Hound imposes ..." would be
 * invention. The final arm keeps this exhaustive over kinds nobody has authored a caption for yet.
 */
function restate(e: FeatureEffect): string {
  switch (e.kind) {
    case "roll-modifier": return `${ROLL_MODE_WORD[e.mode]} on ${ROLL_NOUN[e.roll]}`;
    case "apply-condition": return e.condition;
    // `condition` is the NAME here too; `while` is the (optional) situational scope it holds under.
    case "immune-condition": return `${e.condition}${e.while ? ` while ${e.while}` : ""}`;
    case "damage-bonus": return `${e.amount}${e.damage_type ? ` ${e.damage_type}` : ""}`;
    case "heal": case "temp-hp": return `${NOUN[e.kind]} ${e.amount}`;
    // `type` + `range`, never `value`: that is the arm's own shape in dnd5e
    // `types/feature-effect.ts`. `range` is REQUIRED by featureEffectSchema, so
    // a shipped carrier always has a number here (measured: 100 of 100 in the
    // converter corpus), and the default arm's "sense type=… range=…" field dump
    // was the only thing a non-self sense could read as before.
    case "sense": return `${e.type} ${e.range} ft.`;
    default: return `${e.kind} ${Object.entries(e).filter(([k]) => !["kind", "subject", "condition"].includes(k)).map(([k, v]) => `${k}=${String(v)}`).join(" ")}`;
  }
}

/** The caption for one effect, or `undefined` when this effect has no row-local caption. */
function captionFor(e: FeatureEffect): string | undefined {
  if (isNonSelf(e)) return `${e.subject}: ${restate(e)}`;
  // Delegated, not duplicated: `restate`'s heal/temp-hp arm IS the self-subject caption, so the
  // self and non-self paths cannot drift into two spellings of the same line.
  if (e.kind === "heal" || e.kind === "temp-hp") return restate(e);
  if (e.kind === "extra-action") return `+${e.count} ${costLabel(e.action_type)}`;
  // R4-G4 §9.4: the two SELF-subject kinds that carried a condition and no
  // caption. Both DO fold (a sense reaches the senses panel, a proficiency the
  // proficiencies panel), but the qualifier is dropped there, so the row is the
  // only place it can be read · which is why the `condition` is the gate: an
  // unqualified one would be a duplicate of a panel row, not a rescued fact.
  // `sense` delegates to `restate`, like the heal arm, so the self and non-self
  // paths cannot drift into two spellings of the same line.
  if (e.kind === "proficiency" && e.condition) return `${e.value} proficiency, ${plainText(e.condition)}`;
  if (e.kind === "sense" && e.condition) return `${restate(e)}, ${plainText(e.condition)}`;
  return undefined;
}

/**
 * Append the caption line to `host` (a row's NAME cell), one span per distinct caption TEXT (R4-G7 T8 RIDER-21: a
 * repeated text, the folded copies' identical effects, prints once; a repeat's different qualifier becomes a tooltip line only
 * on a span whose own copy is qualified).
 * TWO callers, each passing its own raw array (R4-G4 §10): `renderFeatureRow` (`feature-rows.ts`)
 * passes `rf.feature.effects`, `renderBoonRow` (`boon-rows.ts`) passes `entry.entity.effects`. The
 * parameter is the ARRAY rather than the carrier because those two carriers share no supertype.
 * The line is created lazily, so a feature with no captioned effect adds no empty div. A `condition`
 * QUALIFIER becomes the span's tooltip, plain-texted · the roll-modifier idiom. On the two kinds
 * where `condition` is the condition NAME it stays in the caption body and no tooltip is set:
 * hiding a name behind a hover is not a qualifier, it is a lost caption.
 *
 * The tooltip is also skipped when the caption BODY already prints the plain-texted condition,
 * which is the R4-G4 §9.4 pair (`sense` / `proficiency`, whose captions read "…, <condition>"). Same
 * rule, stated once instead of as a second kind list: a hover that repeats a visible line is noise.
 * That skip is a SUBSTRING test standing in for the exact predicate, which is "a self-subject `sense`
 * or `proficiency` caption" · the two conditions `captionFor` itself gates those arms on. The two
 * agree on everything shipped: simulated over the whole converter corpus, the old rule sets 111
 * tooltips and this one sets 70, the 41 suppressed are exactly the §9.4 pair (29 sense + 12
 * proficiency) and NO pre-existing caption loses a hover. They can diverge in principle · a short
 * qualifier that is also a substring of its own body would drop silently · so if a future arm prints
 * a field that can equal its `condition`, swap the substring for the predicate.
 */
export function renderEffectCaptions(
  host: HTMLElement,
  effects: ReadonlyArray<FeatureEffect>,
  _ctx: ComponentRenderContext,
): void {
  let line: HTMLElement | null = null;
  // R4-G7 T8 RIDER-21 (F-FOLDCAP): the caption TEXTS already emitted on this line, each with its span and its tooltip lines.
  // A folded feature carries every copy's effects (PHB 2024 Action Surge authors `extra-action {count: 1}` at 2 and at 17),
  // so the same caption arrived twice and read "+1 Action +1 Action". A repeat prints nothing; a qualifier it carries that the
  // kept span does not yet show joins that span's tooltip on its own line. Fix round 1 (review Minor 2, ruled): only on a span whose
  // OWN copy set a tooltip. The tooltip is the caption's conditional look, so on an unqualified span a repeat's qualifier would be its
  // only tooltip and the caption would read as conditional though one copy is not; the text already prints true without it.
  const emitted = new Map<string, { span: HTMLElement; tips: string[] }>();
  for (const e of effects) {
    const text = captionFor(e);
    if (!text) continue;
    const qualifier = e.condition && !CONDITION_IS_NAME.has(e.kind) ? plainText(e.condition) : "";
    const tip = qualifier && !text.includes(qualifier) ? qualifier : "";
    const seen = emitted.get(text);
    if (seen) {
      if (tip && seen.tips.length > 0 && !seen.tips.includes(tip)) { seen.tips.push(tip); setTooltip(seen.span, seen.tips.join("\n")); }
      continue;
    }
    line ??= host.createDiv({ cls: "pc-feature-effect-line" });
    const span = line.createSpan({ cls: "pc-feature-effect", text });
    emitted.set(text, { span, tips: tip ? [tip] : [] });
    if (tip) setTooltip(span, tip);
  }
}
