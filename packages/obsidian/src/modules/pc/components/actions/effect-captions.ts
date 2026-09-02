import type { ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { FeatureEffect } from "@archivist-gg/dnd5e/types/feature-effect";
import { ROLL_MODE_WORD, ROLL_NOUN } from "@archivist-gg/dnd5e/pc/roll-tag-labels";
import { costLabel } from "../../../../shared/rendering/action-cost-label";
import { plainText } from "../../../../shared/rendering/plain-text";
import { setTooltip } from "obsidian";
import type { ComponentRenderContext } from "../component.types";

/**
 * R4-G3a §4 · the row-local caption line.
 *
 * Four effect shapes carry information the sheet had nowhere to put: `heal` and `temp-hp` (their
 * amounts), `extra-action` (what extra action, and how many), and EVERY effect written on someone
 * other than the character. The first three fold nothing by design (invariant 5: a heal is a
 * caption, never an auto-write of `state.hp.*`); the fourth is refused by the engine's `subject`
 * guard (invariant 1) and so has no derived surface at all. Both were previously invisible.
 *
 * This reads `rf.feature.effects` RAW, not `selfEffectsOf`: the non-self effects are precisely the
 * ones the fold drops, so filtering by the guard here would erase the case this exists for.
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
  return undefined;
}

/**
 * Append the caption line to `host` (the feature row's NAME cell), one span per captioned effect.
 * The line is created lazily, so a feature with no captioned effect adds no empty div. A `condition`
 * QUALIFIER becomes the span's tooltip, plain-texted · the roll-modifier idiom. On the two kinds
 * where `condition` is the condition NAME it stays in the caption body and no tooltip is set:
 * hiding a name behind a hover is not a qualifier, it is a lost caption.
 */
export function renderEffectCaptions(host: HTMLElement, rf: ResolvedFeature, _ctx: ComponentRenderContext): void {
  let line: HTMLElement | null = null;
  for (const e of rf.feature.effects ?? []) {
    const text = captionFor(e);
    if (!text) continue;
    line ??= host.createDiv({ cls: "pc-feature-effect-line" });
    const span = line.createSpan({ cls: "pc-feature-effect", text });
    if (e.condition && !CONDITION_IS_NAME.has(e.kind)) setTooltip(span, plainText(e.condition));
  }
}
