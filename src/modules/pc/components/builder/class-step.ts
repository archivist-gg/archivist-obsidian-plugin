import type { ComponentRenderContext } from "../component.types";
import { buildDecisionLedger, type DecisionLedger, wikilinkTailSlug, bareEntitySlug } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";
import { humanizeSlug } from "../../../../shared/rendering/renderer-utils";
import { AddClassModal } from "./class-modal";
import { renderClassChronicle, type ClassData } from "./class-chronicle";

const ABILITY_NAME: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

const ADD_FIRST = "＋ Add Class";
const ADD_ANOTHER = "＋ Add another class";

/** SP2 Plan 5 — the Class & Levels step: chosen-class card stack only; adding
 *  goes through the parchment Add-Class modal (read ≠ add). Replaces the
 *  Plan-3 inline host. */
export function renderClassStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const root = body.createDiv({ cls: "pc-bclass-root" });
  const draw = (): void => { root.empty(); drawStep(root, ctx, draw); };
  draw();
}

function drawStep(root: HTMLElement, ctx: ComponentRenderContext, redraw: () => void): void {
  renderOrphanSubclasses(root, ctx);                      // moved from builder-view.ts
  const classes = ctx.resolved.definition.class ?? [];
  if (!classes.length) {
    const empty = root.createDiv({ cls: "pc-bcempty" });
    empty.createDiv({
      cls: "pc-bcempty-t",
      text: "Every adventurer begins with a calling. Add a class to begin — you can read each one before committing.",
    });
    renderAddButton(root, ctx, true);
    return;
  }
  const stack = root.createDiv({ cls: "pc-bcstack" });
  const ledger = buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities });
  classes.forEach((_, i) => renderClassCard(stack, ctx, ledger, i, redraw));
  renderAddButton(root, ctx, false);
}

function renderAddButton(host: HTMLElement, ctx: ComponentRenderContext, hero: boolean): void {
  // Compact dashed ghost, auto-width — NEVER a full-width row ("too wide!").
  const wrap = host.createDiv({ cls: `pc-bcadd-wrap${hero ? " hero" : ""}` });
  const held = new Set(
    (ctx.resolved.definition.class ?? []).map((c) => stripSlug(c.name)).filter((s): s is string => !!s),
  );
  const btn = wrap.createEl("button", { cls: "pc-bcadd", text: hero ? ADD_FIRST : ADD_ANOTHER });
  btn.addEventListener("click", () => {
    new AddClassModal(ctx.app, ctx, {
      exclude: held,
      onAdd: (slug) => ctx.editState?.addClass(slug, 1),
    }).open();
  });
}

function renderClassCard(
  stack: HTMLElement,
  ctx: ComponentRenderContext,
  ledger: DecisionLedger,
  index: number,
  redraw: () => void,
): void {
  const entry = (ctx.resolved.definition.class ?? [])[index];
  const slug = stripSlug(entry.name);
  const entity = slug ? ctx.core.entities.getByTypeAndSlug("class", slug) : undefined;
  const bag = ctx.builderUiState;
  const collapsed = (bag?.get("builder.class-cards") as Set<number> | undefined) ?? new Set<number>();
  bag?.set("builder.class-cards", collapsed);
  const open = !collapsed.has(index);

  const card = stack.createDiv({ cls: "pc-bccard" });
  const h = card.createDiv({ cls: "pc-bccard-h" });
  h.createSpan({ cls: "pc-bccard-seal", text: "✓" });
  h.createSpan({ cls: "pc-bccard-nm", text: entity?.name ?? humanizeSlug(slug ?? "unknown") });
  const lvl = h.createDiv({ cls: "pc-bccard-lvl" });
  lvl.createSpan({ cls: "pc-bccard-lvl-l", text: "Lv" });
  const sel = lvl.createEl("select", { cls: "pc-bdd" });
  for (let n = 1; n <= 20; n++) {
    sel.createEl("option", { text: String(n), attr: { value: String(n) } });
  }
  sel.value = String(entry.level);
  sel.addEventListener("click", (ev) => ev.stopPropagation());
  sel.addEventListener("change", () => ctx.editState?.setClassLevel(index, Number(sel.value)));
  // Resolve the picked subclass entity once: its name dresses the header here,
  // and the same entity threads into the chronicle so its granted features fold
  // into the timeline & progression (Fix A).
  const subSlug = entry.subclass ? stripSlug(entry.subclass) : undefined;
  const subclassEntity = subSlug ? ctx.core.entities.getByTypeAndSlug("subclass", subSlug) : undefined;
  if (entry.subclass) {
    h.createSpan({
      cls: "pc-bccard-sub",
      text: subclassEntity?.name ?? humanizeSlug(subSlug ?? ""),
    });
  }
  const rgt = h.createDiv({ cls: "pc-bccard-rgt" });
  const rm = rgt.createSpan({ cls: "pc-bccard-rm", text: "remove" });
  rm.addEventListener("click", (ev) => { ev.stopPropagation(); ctx.editState?.removeClass(index); });
  rgt.createSpan({ cls: "pc-bccard-chev", text: open ? "▾" : "▸" });
  h.addEventListener("click", () => {
    if (open) collapsed.add(index); else collapsed.delete(index);
    redraw();
  });

  if (!open) return;
  const cardBody = card.createDiv({ cls: "pc-bccard-body" });
  if (!entity) {
    cardBody.createDiv({ cls: "pc-dstrip-empty", text: "No class data in your vault for this entry." });
    return;
  }
  renderPrereqNote(cardBody, ctx, entity.data, index);
  renderClassChronicle(cardBody, ctx, {
    entity, level: entry.level, mode: "owned", classIndex: index, ledger,
    subclassEntity, stateKey: `builder.class-card.${index}`,
  });
}

/** Multiclass prerequisites are PERMISSIVE — a quiet amber "!" note, never a
 *  block (class-step doc §6). Fires on 2nd+ cards whose primary ability sits
 *  under 13 on the derived totals. */
function renderPrereqNote(body: HTMLElement, ctx: ComponentRenderContext, d: ClassData, index: number): void {
  if (index === 0 || (ctx.resolved.definition.class?.length ?? 0) < 2) return;
  const scores = (ctx.derived as { scores?: Record<string, number> }).scores ?? {};
  const low = (d.primary_abilities ?? []).filter((a) => (scores[a] ?? 10) < 13);
  if (!low.length) return;
  const note = body.createDiv({ cls: "pc-bcprereq" });
  note.createSpan({ cls: "pc-bcprereq-bang", text: "!" });
  note.createSpan({
    text: `Multiclassing usually asks for 13+ ${low.map((a) => ABILITY_NAME[a] ?? a.toUpperCase()).join(" and ")} — keep it if your table allows.`,
  });
}

/** Orphan-subclass data ask (spec §11): a subclass whose `parent_class` tail
 *  resolves to no class entity is registered-but-unoffered. We name the gap and
 *  ask the user to add the class note. Plan 6 upgrades this to the AI hand-off.
 *  Moved verbatim from builder-view.ts (Task 13 deletes the original copy). */
function renderOrphanSubclasses(body: HTMLElement, ctx: ComponentRenderContext): void {
  // Key on bareEntitySlug(slug) like the engine's parent_class==="self" filter
  // (matchesFilter in pc.decision-engine) so the callout never false-positives
  // when a homebrew class's display name ≠ slug. Keep the name tail as a
  // secondary alias since a subclass may also link the display name.
  const classSlugs = new Set<string>();
  for (const c of ctx.core.entities.search("", "class", Number.POSITIVE_INFINITY)) {
    classSlugs.add(bareEntitySlug(c.slug));
    classSlugs.add(wikilinkTailSlug(`[[${c.name}]]`));
  }
  const orphans = ctx.core.entities
    .search("", "subclass", Number.POSITIVE_INFINITY)
    .filter((s) => {
      const pc = (s.data as { parent_class?: string }).parent_class;
      return pc ? !classSlugs.has(wikilinkTailSlug(pc)) : false;
    });
  for (const o of orphans) {
    const pc = (o.data as { parent_class?: string }).parent_class ?? "?";
    body.createDiv({
      cls: "pc-bclass-orphan",
      text:
        `${o.name} requires the class "${wikilinkTailSlug(pc)}", which isn't in your vault` +
        ` — add the class note to enable it.`,
    });
  }
}
