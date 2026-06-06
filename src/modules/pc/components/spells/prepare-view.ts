import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { toggleSpellBlock } from "./spell-block-expand";
import { renderAddDrawer } from "./add-drawer";
import { editionTag } from "./spell-display";
import { baseClassName } from "../../pc.spellcasting";

// Ephemeral Prepare-list filters. Module-scoped but reset at the top of
// renderPrepareView on every full re-render (see §5.1). 0 = cantrip.
let levelFilter: number | "all" = "all";
let classFilter: string = "all";

// Matches the checked modifier rendered by renderChargeBoxes (actions/charge-boxes.ts)
// so prepared boxes look identical to the cast-view slot boxes.
const CHECKED = "archivist-toggle-box-checked";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function renderPrepareView(root: HTMLElement, ctx: ComponentRenderContext): void {
  // Ephemeral filter state resets on every full re-render (character switch,
  // mode toggle, post-mutation recalc) — spec §5.1. Chip clicks call redraw(),
  // not renderPrepareView, so a filter persists within one interaction session.
  levelFilter = "all";
  classFilter = "all";

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

  const presentLevels = [...new Set(ctx.resolved.spells.map((s) => s.entity.level ?? 0))].sort(
    (a, b) => a - b,
  );

  // The body shows EITHER the prepared list OR the add-spell drawer; the
  // "+ Add Spells" button toggles between them in place (it replaces the list,
  // not stacks on top). The button reflects the open state so a second click
  // returns to the prepared list.
  const body = root.createDiv({ cls: "pc-spell-prep-body" });
  let adding = false;

  const syncAddBtn = () => {
    addBtn.empty();
    addBtn.classList.toggle("open", adding);
    addBtn.appendText(adding ? "✓ Done" : "+ Add Spells");
  };

  const renderPrepareList = (host: HTMLElement): void => {
    const bar = host.createDiv({ cls: "pc-spell-filterbar" });
    const listHost = host.createDiv();

    const drawLevelChips = () => {
      const grp = bar.createDiv({ cls: "pc-spell-fgroup" });
      grp.createSpan({ cls: "pc-spell-flabel", text: "Level" });
      const chip = (label: string, val: number | "all") => {
        const c = grp.createSpan({
          cls: `pc-spell-fchip${levelFilter === val ? " active" : ""}`,
          text: label,
        });
        c.addEventListener("click", () => {
          levelFilter = val;
          redraw();
        });
      };
      chip("All", "all");
      for (const l of presentLevels) chip(l === 0 ? "Cantrip" : ordinal(l), l);
    };

    const drawClassChips = () => {
      if (ctx.derived.spellcastingClasses.length <= 1) return;
      const grp = bar.createDiv({ cls: "pc-spell-fgroup pc-spell-fchip-class" });
      grp.createSpan({ cls: "pc-spell-flabel", text: "Class" });
      const chip = (label: string, val: string) => {
        const c = grp.createSpan({
          cls: `pc-spell-fchip${classFilter === val ? " active" : ""}`,
          text: label,
        });
        c.addEventListener("click", () => {
          classFilter = val;
          redraw();
        });
      };
      chip("All", "all");
      for (const cls of ctx.derived.spellcastingClasses)
        chip(cls.className, baseClassName(cls.classSlug));
    };

    const redraw = () => {
      bar.empty();
      listHost.empty();
      drawLevelChips();
      drawClassChips();
      const shown = ctx.resolved.spells.filter((s) => {
        if (levelFilter !== "all" && (s.entity.level ?? 0) !== levelFilter) return false;
        if (classFilter !== "all" && baseClassName(s.classSlug ?? "") !== classFilter) return false;
        return true;
      });
      const byLevel = new Map<number, ResolvedSpell[]>();
      for (const s of shown) {
        const l = s.entity.level ?? 0;
        (byLevel.get(l) ?? byLevel.set(l, []).get(l)!).push(s);
      }
      for (const lvl of [...byLevel.keys()].sort((a, b) => a - b)) {
        const sec = listHost.createDiv({ cls: "pc-actions-section-head" });
        sec.createSpan({ text: lvl === 0 ? "Cantrips" : `${ordinal(lvl)} Level` });
        const list = listHost.createDiv({ cls: "pc-spell-list" });
        for (const s of byLevel.get(lvl)!) renderPrepareRow(list, s, ctx, hasPrepared);
      }
    };
    redraw();
  };

  const renderBody = () => {
    body.empty();
    if (adding) renderAddDrawer(body, ctx);
    else renderPrepareList(body);
  };

  addBtn.addEventListener("click", () => {
    adding = !adding;
    syncAddBtn();
    renderBody();
  });

  syncAddBtn();
  renderBody();
}

function renderPrepareRow(
  parent: HTMLElement,
  spell: ResolvedSpell,
  ctx: ComponentRenderContext,
  hasPrepared: boolean,
): void {
  // Block-level host wraps the flex row so the expanded reference block stacks
  // BELOW the row (as a sibling of the flex row) instead of landing beside the
  // title. Mirrors inventory's .pc-inv-row-host idiom.
  const host = parent.createDiv({ cls: "pc-spell-prep-row-host" });
  const row = host.createDiv({ cls: "pc-spell-prep-row" });
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
  const tag = editionTag(spell);
  if (tag) name.parentElement!.createSpan({ cls: `pc-spell-srctag ${tag.mod}`, text: tag.label });
  if (spell.alwaysPrepared) name.createSpan({ cls: "pc-spell-always", text: "always" });
  if (spell.entity.school) nameWrap.createDiv({ cls: "pc-spell-sub", text: spell.entity.school });
  nameWrap.addEventListener("click", () => {
    toggleSpellBlock(host, spell, ctx);
    row.classList.toggle("pc-row-open", !!host.querySelector(":scope > .pc-spell-expand"));
  });

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
