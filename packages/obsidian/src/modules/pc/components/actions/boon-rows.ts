import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderFeatureCard, sourceBadgeText } from "../../blocks/feature-card";

/**
 * Interdict Boons section on the consolidated Actions tab (spec §3.6 / #1b).
 *
 * For each resolved selection pool with **members** (`selected ∪ grants` — a
 * grants-only pool with no selections STILL renders; a pool with neither is
 * OMITTED), emit a `pc-tab-heading` (pool label) and READ-ONLY rows. Picking
 * stays exclusively on the Interdict Boons pool tab; these rows never carry the
 * pool tab's select/deselect toggle-box.
 *
 * Rows reuse the Task-3 unified feature-row grid ([badge][name][detail][caret]),
 * so boon rows visually match the feature rows above them. Right-detail is:
 *   - selected + activatable → an **Active** toggle (`pc-pool-active`, wired to
 *     `editState.toggleActiveBuff(slug)` — the same control the pool tab uses);
 *   - selected, non-activatable → a `pc-passive-tag` "Boon" label;
 *   - granted → a read-only `pc-passive-tag pc-spell-always` "granted" label.
 * Clicking a row (outside the Active toggle) expands the shared
 * `.archivist-item-block` card with the boon's description.
 */
export function renderBoonSections(root: HTMLElement, ctx: ComponentRenderContext): void {
  for (const pool of ctx.resolved.pools ?? []) {
    const members = [...pool.selected, ...pool.grants];
    if (members.length === 0) continue;

    root.createEl("h4", { cls: "pc-tab-heading", text: pool.label });
    const list = root.createDiv({ cls: "pc-actions-table pc-feature-list pc-boons-list" });
    for (const e of pool.selected) renderBoonRow(list, e, "selected", pool.label, ctx);
    for (const e of pool.grants) renderBoonRow(list, e, "granted", pool.label, ctx);
  }
}

export function renderBoonRow(
  list: HTMLElement,
  entry: ResolvedPoolEntry,
  kind: "selected" | "granted",
  poolLabel: string,
  ctx: ComponentRenderContext,
): void {
  const e = entry.entity;
  const activatable = kind === "selected" && !!e.activatable;

  const row = list.createDiv({ cls: "pc-action-row pc-feature-row pc-boon-row" });

  // Badge column — a read-only status chip. Granted boons read "granted"
  // (mirroring the pool tab's `pc-spell-always` marker); a non-activatable
  // selected boon reads "Boon". An activatable selected boon shows no chip here
  // (the Active toggle in the detail column is its indicator).
  const badge = row.createDiv({ cls: "pc-feature-badge" });
  if (kind === "granted") {
    badge.createDiv({ cls: "pc-passive-tag pc-spell-always", text: "granted" });
  } else if (!activatable) {
    badge.createDiv({ cls: "pc-passive-tag", text: "Boon" });
  }

  // Name cell — name + the pool label as the source/type sub-label.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: e.name });
  nameCell.createDiv({ cls: "pc-action-row-sub", text: poolLabel });

  // Right detail — Active toggle for an activatable selected boon (the pool
  // tab's `pc-pool-active` button, wired to the same `toggleActiveBuff` action).
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
  }

  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // Sibling expand card (hidden until the row is clicked) — the shared block
  // card with the boon description. Resource-less: no Recharge/Die line.
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  renderFeatureCard(inner, {
    title: e.name,
    sourceLabel: poolLabel,
    sourceBadge: sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition),
    description: e.description,
  });

  row.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    // The Active toggle has its own handler; never expand on its click.
    if (t?.closest(".pc-pool-active")) return;
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
}
