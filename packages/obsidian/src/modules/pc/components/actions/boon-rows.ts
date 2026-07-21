import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderFeatureCard, sourceBadgeText } from "../../blocks/feature-card";
import { renderCostBadge } from "./cost-badge";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";

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
 *   - Detail = the provenance/state marker: an **Active** toggle (activatable
 *     selected — `pc-pool-active`, wired to `editState.toggleActiveBuff(slug)`,
 *     the same control the pool tab uses) / a quiet `pc-boon-status` "granted"
 *     marker (granted) / nothing (plain selected).
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

  // D3: mirror feature rows — Actions tab keeps the badge column; Passive drops it
  // and renders a FREE boon's pill inline in the name cell. Read the pill from the
  // boon's OWN action_cost (NOT the section: boonEconomy maps free→passive, so the
  // section can't tell Free from a truly-passive boon).
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

  // Name cell — name + the pool label as the source/type sub-label. On the
  // Passive tab (no badge column) a FREE boon renders its pill inline here.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  if (passive && cost === "free") {
    renderCostBadge(nameCell, "free").classList.add("pc-cost-badge-inline");
  }
  nameCell.createDiv({ cls: "pc-action-row-name", text: e.name });
  nameCell.createDiv({ cls: "pc-action-row-sub", text: poolLabel });

  // Right detail — Active toggle for an activatable selected boon (the pool
  // tab's `pc-pool-active` button, wired to the same `toggleActiveBuff` action);
  // a quiet "granted" provenance marker for a granted boon; nothing for a plain
  // selected boon.
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

  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // Sibling expand card (hidden until the row is clicked) — the shared block
  // card with the boon description. Resource-less: no Recharge/Die line.
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
