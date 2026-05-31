import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { toggleSpellBlock } from "./spell-block-expand";
import { renderAddDrawer } from "./add-drawer";

// Matches the checked modifier rendered by renderChargeBoxes (actions/charge-boxes.ts)
// so prepared boxes look identical to the cast-view slot boxes.
const CHECKED = "archivist-toggle-box-checked";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function renderPrepareView(root: HTMLElement, ctx: ComponentRenderContext): void {
  const hasPrepared = ctx.derived.spellcastingClasses.some((c) => c.preparation === "prepared");

  // Header: counters + add toggle
  const head = root.createDiv({ cls: "pc-spell-prep-head" });
  const counts = head.createDiv({ cls: "pc-spell-counts" });
  for (const lim of ctx.derived.spellLimits) {
    const prepared = ctx.resolved.spells.filter(
      (s) =>
        s.classSlug === lim.classSlug &&
        s.prepared &&
        !s.alwaysPrepared &&
        (s.entity.level ?? 0) > 0,
    ).length;
    const cantrips = ctx.resolved.spells.filter(
      (s) => s.classSlug === lim.classSlug && (s.entity.level ?? 0) === 0,
    ).length;
    const seg = counts.createSpan({ cls: "pc-spell-count-seg" });
    if (lim.preparedOrKnown != null) {
      seg.appendText(`${lim.kind === "known" ? "Known" : "Prepared"} `);
      const b = seg.createEl("b", { text: `${prepared} / ${lim.preparedOrKnown}` });
      if (prepared > lim.preparedOrKnown) b.classList.add("over");
    }
    if (lim.cantripsKnown != null) {
      seg.appendText("  ·  Cantrips ");
      seg.createEl("b", { text: `${cantrips} / ${lim.cantripsKnown}` });
    }
  }

  const addBtn = head.createEl("button", { cls: "pc-spell-addbtn" });
  addBtn.appendText("+ Add Spells");
  const drawerHost = root.createDiv();
  addBtn.addEventListener("click", () => {
    if (drawerHost.firstChild) {
      drawerHost.empty();
      return;
    }
    renderAddDrawer(drawerHost, ctx);
  });

  // Spells by level
  const byLevel = new Map<number, ResolvedSpell[]>();
  for (const s of ctx.resolved.spells) {
    const l = s.entity.level ?? 0;
    (byLevel.get(l) ?? byLevel.set(l, []).get(l)!).push(s);
  }
  for (const lvl of [...byLevel.keys()].sort((a, b) => a - b)) {
    const sec = root.createDiv({ cls: "pc-actions-section-head" });
    sec.createSpan({ text: lvl === 0 ? "Cantrips" : `${ordinal(lvl)} Level` });
    const list = root.createDiv({ cls: "pc-spell-list" });
    for (const s of byLevel.get(lvl)!) renderPrepareRow(list, s, ctx, hasPrepared);
  }
}

function renderPrepareRow(
  parent: HTMLElement,
  spell: ResolvedSpell,
  ctx: ComponentRenderContext,
  hasPrepared: boolean,
): void {
  const row = parent.createDiv({ cls: "pc-spell-prep-row" });
  const isCantrip = (spell.entity.level ?? 0) === 0;

  // Prepared box (prepared casters only). Cantrips/always-prepared are locked.
  if (hasPrepared) {
    const locked = isCantrip || spell.alwaysPrepared;
    const box = row.createDiv({
      cls: `archivist-toggle-box${spell.prepared || locked ? " " + CHECKED : ""}${
        locked ? " pc-box-locked" : ""
      }`,
    });
    if (!locked) {
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.editState?.togglePrepared(spell.slug);
      });
    }
  }

  const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
  const name = nameWrap.createSpan({ cls: "pc-spell-name", text: spell.entity.name });
  if (spell.alwaysPrepared) name.createSpan({ cls: "pc-spell-always", text: "always" });
  if (spell.entity.school) nameWrap.createDiv({ cls: "pc-spell-sub", text: spell.entity.school });
  nameWrap.addEventListener("click", () => toggleSpellBlock(row, spell, ctx));

  // Remove with inline two-tap confirm
  const rm = row.createEl("button", { cls: "pc-spell-remove", text: "✕" });
  let armed = false;
  rm.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true;
      rm.classList.add("armed");
      rm.setText("Remove?");
      return;
    }
    ctx.editState?.removeKnownSpell(spell.slug);
  });
}
