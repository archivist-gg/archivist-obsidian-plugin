import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderFeatureCard, sourceBadgeText } from "../../blocks/feature-card";
import { renderCostBadge } from "./cost-badge";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";
import { renderSpendControl } from "./spend-control";
import { renderEffectCaptions } from "./effect-captions";

/**
 * A single Interdict Boon row on the consolidated Actions tab (spec §3.6 / #1b).
 *
 * The tab (`actions-tab.ts`) files boons into the economy×source grid model via
 * `buildActionModel` and dispatches each `boon` entry here — this renderer owns
 * ONE read-only row (+ its hidden expand card); it emits no head, no count.
 * Picking stays exclusively on the Interdict Boons pool tab, so these rows never
 * carry the pool tab's select/deselect toggle-box.
 *
 * Rows reuse the unified feature-row grid ([badge][name][detail][caret]), so
 * boon rows visually match the feature rows beside them.
 *   - Badge = the boon's ECONOMY pill, read from its OWN `action_cost` (a real
 *     cost → filled `renderCostBadge` pill; special/no-cost → outline "Passive"
 *     tag), mirroring the feature-row badge rule. The section can't supply this:
 *     `boonEconomy` collapses free→passive, so a granted Free boon must key its
 *     FREE pill (and its non-dimming) off the raw `action_cost`, not the bucket.
 *   - Name = the boon's name, followed by the R4-G3a caption line for its own
 *     `effects` (heal / temp-hp / extra-action / every effect imposed on someone
 *     else), the same `renderEffectCaptions` line the feature rows carry.
 *   - Detail = the provenance/state marker: an **Active** toggle (activatable
 *     selected · `pc-pool-active`, wired to `editState.toggleActiveBuff(slug)`,
 *     the same control the pool tab uses) / a quiet `pc-boon-status` "granted"
 *     marker (granted) / nothing (plain selected), followed by the shared spend
 *     control (R4-G4 §3.2.4) when the boon consumes a resource the character
 *     owns. Both can share the slot: a boon has no tracker of its own.
 * Clicking a row (outside the Active toggle) expands the shared
 * `.archivist-item-block` card with the boon's description.
 */
export function renderBoonRow(
  list: HTMLElement,
  entry: ResolvedPoolEntry,
  kind: "selected" | "granted",
  poolLabel: string,
  ctx: ComponentRenderContext,
  passive = false,
): void {
  const e = entry.entity;
  const activatable = kind === "selected" && !!e.activatable;

  const row = list.createDiv({ cls: "pc-action-row pc-feature-row pc-boon-row" });

  // Mirror feature rows: Actions tab keeps the badge column; the Passive tab
  // drops it and renders no cost mark (all passive costs are unmarked). The
  // boon's OWN action_cost still drives incapacitated dimming below.
  const cost = e.action_cost;
  if (!passive) {
    const badge = row.createDiv({ cls: "pc-feature-badge" });
    if (cost && cost !== "special") renderCostBadge(badge, cost);
  }

  // Incapacitated dimming — keyed off the EXACT cost (action/bonus/reaction dim;
  // free/special/passive never), matching weapons-table.ts / items-table.ts.
  const ce = ctx.derived.conditionEffects;
  const isAction = cost === "action" || cost === "bonus-action" || cost === "reaction";
  if (ce && isAction && ce.actions_disabled) row.addClass("pc-row-disabled");

  // Name cell: the name, then the R4-G3a caption line (R4-G4 §10 made `renderBoonRow`
  // the second caller of `renderEffectCaptions`, reading the boon's OWN `effects`). The
  // pool label is no longer repeated here as a sub-line: `buildActionModel` now labels
  // the sub-group HEAD from it (UR3), and the expand card below still carries it through
  // the `poolLabel` parameter this function keeps.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: e.name });
  renderEffectCaptions(nameCell, e.effects ?? [], ctx);

  // Right detail: an Active toggle for an activatable selected boon (the pool
  // tab's `pc-pool-active` button, wired to the same `toggleActiveBuff` action);
  // a quiet "granted" provenance marker for a granted boon; nothing for a plain
  // selected boon. The spend control follows whichever of those rendered.
  const detail = row.createDiv({ cls: "pc-feature-detail" });
  if (activatable) {
    const active = (ctx.resolved.state.active_buffs ?? []).includes(entry.slug);
    const btn = detail.createEl("button", {
      cls: `pc-pool-active${active ? " on" : ""}`,
      text: active ? "Active" : "Activate",
    });
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ctx.editState?.toggleActiveBuff(entry.slug);
    });
  } else if (kind === "granted") {
    // Quiet provenance marker (distinct from the economy-pill and meta-chip
    // families) — a granted boon is auto-on; a plain selected boon shows none.
    detail.createDiv({ cls: "pc-boon-status", text: "granted" });
  }
  // The shared spend control (R4-G4 §3.2.4). An unowned id renders nothing and warns
  // once (§13), so a cross-book boon row is byte-identical to today's.
  if (e.consumes?.resource) renderSpendControl(detail, { consumes: e.consumes, ctx });

  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // Sibling expand card (hidden until the row is clicked): the shared block card
  // with the boon description. This site passes neither a `die` nor a `feature`, so
  // the card renders NO properties block at all: not a die line, and not the Save/DC
  // line a feature-backed card can now carry (R4-G3a §10.2.2). The `recharge` option
  // this comment used to name was retired in Task 5 (§8.2 (3)).
  const expandKey = rowExpandKey("boon", poolLabel, kind, entry.slug);
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  const expanded = isRowExpanded(ctx, expandKey);
  expand.hidden = !expanded;
  if (expanded) row.classList.add("open", "pc-row-open");
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  renderFeatureCard(inner, {
    title: e.name,
    app: ctx.app,
    sourceLabel: poolLabel,
    sourceBadge: sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition),
    description: e.description,
  });

  row.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    // The Active toggle has its own handler; never expand on its click.
    if (t?.closest(".pc-pool-active")) return;
    expand.hidden = !expand.hidden;
    const nowOpen = !expand.hidden;
    row.classList.toggle("open", nowOpen);
    row.classList.toggle("pc-row-open", nowOpen);
    setRowExpanded(ctx, expandKey, nowOpen);
  });
}
