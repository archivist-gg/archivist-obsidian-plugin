import type { ComponentRenderContext } from "../component.types";
import type { ResourceRow } from "./resource-model";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { RESET_LABELS } from "../actions/reset-labels";
import { formatChargeRecovery } from "../actions/charge-boxes";
import { renderSeparated } from "../separated-caption";
import { pickResourceComponent } from "./component-catalogue";

/**
 * The control for ONE {@link ResourceRow}, on ONE surface.
 *
 * All this does is choose the label the surface wants, ask the catalogue which
 * component draws the row, and — on the tab only — write the recovery caption
 * beside it. The catalogue owns every drawing decision; this owns the two ways
 * the surfaces differ:
 *
 *  - **The band shows no rest wording at all.** Current and total, nothing else.
 *    A player glancing at the header is asking "how many?", never "when does it
 *    come back?", and the answer to the second question is a tab away.
 *  - **The tab groups BY the rest**, so the heading already says what a full
 *    reset returns. Only a PARTIAL recovery, which no heading can express, earns
 *    a caption: Sanity files under "Doesn't reset" and reads "+1 / Long Rest".
 */

export type ResourceSurface = "band" | "tab";

/** The face a row shows, for the label: the hit die's own, or the resource's die
 *  resolved at its OWNER's class level (R4-G4 §6.2.4). */
function faceOf(row: ResourceRow, ctx: ComponentRenderContext): string | undefined {
  if (row.kind === "hit-dice") return row.face;
  if (row.kind !== "resource" || !row.res.die) return undefined;
  return resolveScalingDie(row.res.die, resourceLevelFor(row.res.owner.source, ctx.resolved));
}

/**
 * The `.pc-hd-label` under a counter.
 *
 * In the BAND a cell has no other title, so the label names the resource and
 * appends the face when it has one ("Psychic Die · d8"). In the TAB the row's
 * own `.pc-action-row-name` already names it, so the label is the face alone, or
 * nothing.
 */
function labelFor(row: ResourceRow, ctx: ComponentRenderContext, surface: ResourceSurface): string {
  const face = faceOf(row, ctx);
  if (surface === "tab") return face ?? "";
  return face ? `${row.name} · ${face}` : row.name;
}

/** The captions the tab writes beside a control. The band writes none. */
function renderTabCaptions(host: HTMLElement, row: ResourceRow): void {
  if (row.kind === "item") {
    // R4-G6b §10 (Q-8): the caption is a UNIT holding its `/ ` out of flow, so
    // the mark is clipped away when the caption wraps onto its own line and never
    // starts it — the same primitive `renderChargeBoxes` uses for this caption.
    if (row.recovery) renderSeparated(host, [formatChargeRecovery(row.recovery)], { sep: "/", leading: true, spaces: false, unitCls: "pc-charge-recovery" });
    return;
  }
  if (row.kind !== "resource") return;
  for (const rec of row.res.recovery ?? []) {
    // A `spell-slots` recovery restores slots, not this counter, so it says
    // nothing about the number on this row.
    if (rec.kind !== "uses") continue;
    host.createSpan({ cls: "pc-charge-recovery", text: `+${rec.entry.amount} / ${RESET_LABELS[rec.entry.reset]}` });
  }
}

export function renderResourceControl(
  host: HTMLElement,
  row: ResourceRow,
  ctx: ComponentRenderContext,
  surface: ResourceSurface,
): void {
  // A hit die is a FACE before it is a number, so a row that declares no hint of
  // its own asks for the die component. Any `rendering_hint` on the note wins.
  const component = pickResourceComponent(row, row.kind === "hit-dice" ? "die" : undefined);
  component(host, row, ctx, { label: labelFor(row, ctx, surface), surface });
  if (surface === "tab") renderTabCaptions(host, row);
}
