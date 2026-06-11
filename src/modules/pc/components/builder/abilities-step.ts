import type { ComponentRenderContext } from "../component.types";
import type { Ability } from "../../../../shared/types/choice";
import type { AbilityMethod } from "../../pc.types";
import { ABILITY_KEYS } from "../../../../shared/dnd/constants";
import { ABILITY_METHODS, POINT_BUY_RULES, STANDARD_ARRAY, allowedScores } from "./ability-methods";
import type { PointBuyRule } from "./ability-methods";
import { abilityBonusBreakdown } from "../../pc.recalc";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

/** SP2 §7 Step 3 — Ability Scores: method pills, per-method context bar, six
 *  obelisk tiles (the sheet's exact classes) with a Base dropdown + crimson
 *  bonus caption each. Tiles show FINAL totals from derived; the dropdowns
 *  write BASE scores via setAbilityBaseScore. */
export function renderAbilitiesStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const method = ctx.resolved.definition.ability_method;

  // Method pills.
  const tabs = body.createDiv({ cls: "pc-bmethods" });
  for (const m of ABILITY_METHODS) {
    const pill = tabs.createEl("button", { cls: `pc-bmtab${m.id === method ? " on" : ""}`, text: m.label });
    if (m.homebrew) pill.createSpan({ cls: "pc-bhb", text: "Homebrew" });
    pill.addEventListener("click", () => ctx.editState?.setAbilityMethod(m.id));
  }
  // ✦ Custom — Plan 6 hand-off; renders the prompt box only.
  const customOn = ctx.builderUiState?.get("builder.abilities.custom") === true;
  const custom = tabs.createEl("button", { cls: `pc-bmtab ai${customOn ? " on" : ""}` });
  custom.createSpan({ cls: "pc-bmtab-star", text: "✦ " });
  custom.createSpan({ text: "Custom" });
  custom.addEventListener("click", () => {
    ctx.builderUiState?.set("builder.abilities.custom", !customOn);
    redraw(body, ctx);
  });

  if (customOn) renderCustomBox(body);
  else renderMethodBar(body, ctx, method);

  renderTiles(body, ctx, method);
  body.createDiv({
    cls: "pc-blegend",
    text: "Tiles show final totals. Species and background bonuses fold in automatically — called out in crimson.",
  });
}

function redraw(body: HTMLElement, ctx: ComponentRenderContext): void {
  body.empty();
  renderAbilitiesStep(body, ctx);
}

function renderCustomBox(body: HTMLElement): void {
  const box = body.createDiv({ cls: "pc-baibox" });
  box.createDiv({ cls: "pc-baibox-t", text: "Custom scoring method" });
  box.createDiv({
    cls: "pc-baibox-b",
    text: "Describe a scoring method to Archivist Inquiry — it becomes a reusable tab here, exactly like Archivist Point Buy.",
  });
  const btn = box.createEl("button", { cls: "pc-baibtn", text: "✦ Ask Archivist Inquiry" });
  btn.disabled = true;
  btn.title = "Arrives with the Inquiry hand-off (Plan 6).";
}

function renderTiles(body: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod): void {
  const breakdown = abilityBonusBreakdown(ctx.resolved);
  // DerivedStats holds the final totals on `scores` + the modifiers on `mods`.
  const derivedScores: Partial<Record<Ability, number>> =
    (ctx.derived as unknown as { scores?: Record<Ability, number> }).scores ?? {};
  const derivedMods: Partial<Record<Ability, number>> =
    (ctx.derived as unknown as { mods?: Record<Ability, number> }).mods ?? {};
  const row = body.createDiv({ cls: "pc-babrow" });
  for (const ab of ABILITY_KEYS) {
    const col = row.createDiv({ cls: "pc-babcol" });
    const tile = col.createDiv({ cls: "pc-ab", attr: { "data-ability": ab } });
    tile.createDiv({ cls: "pc-ab-label", text: ABILITY_LABELS[ab] });
    const mod = derivedMods[ab] ?? 0;
    tile.createDiv({ cls: "pc-ab-mod", text: `${mod >= 0 ? "+" : ""}${mod}` });
    tile.createDiv({ cls: "pc-ab-score", text: String(derivedScores[ab] ?? ctx.resolved.definition.abilities[ab]) });

    const ctl = col.createDiv({ cls: "pc-babctl" });
    ctl.createSpan({ cls: "pc-babctl-l", text: "Base" });
    renderBaseSelect(ctl, ctx, method, ab);

    const cap = col.createDiv({ cls: "pc-babcap" });
    const parts: string[] = [];
    if (breakdown[ab].species > 0) parts.push(`+${breakdown[ab].species} species`);
    if (breakdown[ab].background > 0) parts.push(`+${breakdown[ab].background} background`);
    if (parts.length) cap.createSpan({ cls: "pc-bsp", text: parts.join(" · ") });
  }
}

/** Allowed Base values per method: point-buy rules constrain by budget;
 *  standard-array offers unused array values (+ the current one); rolled offers
 *  the session pool (Task 11); manual offers 3-20. */
function baseChoicesFor(ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): number[] {
  const abilities = ctx.resolved.definition.abilities;
  const rule = POINT_BUY_RULES[method];
  if (rule) return allowedScores(rule, abilities, ab);
  if (method === "standard-array") {
    const used = ABILITY_KEYS.filter((k) => k !== ab).map((k) => abilities[k]);
    const pool = [...STANDARD_ARRAY];
    for (const u of used) {
      const i = pool.indexOf(u);
      if (i >= 0) pool.splice(i, 1);
    }
    if (!pool.includes(abilities[ab])) pool.push(abilities[ab]);
    return [...new Set(pool)].sort((a, b) => b - a);
  }
  const out: number[] = [];
  for (let v = 3; v <= 20; v++) out.push(v);
  return out;
}

function renderBaseSelect(ctl: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): void {
  const cur = ctx.resolved.definition.abilities[ab];
  const sel = ctl.createEl("select", { cls: "pc-bdd" });
  const values = baseChoicesFor(ctx, method, ab);
  if (!values.includes(cur)) values.unshift(cur);
  for (const v of values) {
    const o = sel.createEl("option", { text: String(v), attr: { value: String(v) } });
    if (v === cur) o.selected = true;
  }
  sel.addEventListener("change", () => ctx.editState?.setAbilityBaseScore(ab, Number(sel.value)));
}

function renderMethodBar(body: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod): void {
  // Tasks 10-11 fill the per-method bars; manual needs none.
  const rule = POINT_BUY_RULES[method];
  if (rule) renderPointBuyBar(body, ctx, method, rule);
  else if (method === "standard-array") renderArrayBar(body, ctx);
  else if (method === "rolled") renderRollBar(body, ctx);
}

// ── Per-method context bars ───────────────────────────────────────────
// Tasks 10-11 replace these bodies; the signatures here are FIXED. Each is the
// minimal honest context line for now (no placeholder copy).
function renderPointBuyBar(body: HTMLElement, _ctx: ComponentRenderContext, method: AbilityMethod, _rule: PointBuyRule): void {
  const bar = body.createDiv({ cls: "pc-bctx" });
  bar.createSpan({ cls: "pc-bctx-l", text: ABILITY_METHODS.find((m) => m.id === method)?.label ?? "" });
}

function renderArrayBar(body: HTMLElement, _ctx: ComponentRenderContext): void {
  body.createDiv({ cls: "pc-bctx" }).createSpan({ cls: "pc-bctx-l", text: "Standard Array" });
}

function renderRollBar(body: HTMLElement, _ctx: ComponentRenderContext): void {
  body.createDiv({ cls: "pc-bctx" }).createSpan({ cls: "pc-bctx-l", text: "Roll" });
}
