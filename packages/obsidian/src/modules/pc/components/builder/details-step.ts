import type { ComponentRenderContext } from "../component.types";
import type { HPBreakdown } from "@archivist-gg/dnd5e/pc/pc.types";

const ALIGNMENTS: Array<{ ab: string; word: string; full: string }> = [
  { ab: "LG", word: "Lawful", full: "Lawful Good" },
  { ab: "NG", word: "Good", full: "Neutral Good" },
  { ab: "CG", word: "Chaotic", full: "Chaotic Good" },
  { ab: "LN", word: "Lawful", full: "Lawful Neutral" },
  { ab: "N", word: "Neutral", full: "Neutral" },
  { ab: "CN", word: "Chaotic", full: "Chaotic Neutral" },
  { ab: "LE", word: "Lawful", full: "Lawful Evil" },
  { ab: "NE", word: "Evil", full: "Neutral Evil" },
  { ab: "CE", word: "Chaotic", full: "Chaotic Evil" },
];

/** SP2 §7 Step 6 — Details: name + optional alignment (3×3) + optional age,
 *  plus the Hit-Points seed (R5 redesign: the Max-HP modal's three modes).
 *  Nothing else (personality/backstory/appearance are out of scope by spec). */
export function renderDetailsStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const form = body.createDiv({ cls: "pc-bform" });

  const nameField = form.createDiv({ cls: "pc-bfield" });
  nameField.createDiv({ cls: "pc-bseclabel", text: "Name" });
  const nameInput = nameField.createEl("input", {
    cls: "pc-binp pc-bform-narrow",
    attr: { type: "text", value: ctx.resolved.definition.name ?? "" },
  });
  nameInput.addEventListener("change", () => ctx.editState?.setName(nameInput.value));

  const alField = form.createDiv({ cls: "pc-bfield" });
  alField.createDiv({ cls: "pc-bseclabel", text: "Alignment · optional" });
  // Width harmony (R5): the grid shares the 340px cap the Name input and the HP
  // card share, so the step reads as one column with a single right edge.
  const grid = alField.createDiv({ cls: "pc-balgrid pc-bform-narrow" });
  const current = ctx.resolved.definition.alignment ?? null;
  for (const a of ALIGNMENTS) {
    // R5: the abbreviation is the label; the full word rides ONLY on the chosen
    // cell, so the unchosen cells stop reading as two stacked words fighting.
    const cell = grid.createDiv({ cls: `pc-bal${current === a.full ? " on" : ""}` });
    cell.createDiv({ cls: "pc-bal-ab", text: a.ab });
    if (current === a.full) cell.createDiv({ cls: "pc-bal-w", text: a.word.toLowerCase() });
    cell.addEventListener("click", () =>
      ctx.editState?.setAlignment(current === a.full ? null : a.full));
  }

  const ageField = form.createDiv({ cls: "pc-bfield" });
  ageField.createDiv({ cls: "pc-bseclabel", text: "Age · optional" });
  const ageWrap = ageField.createDiv({ cls: "pc-bage" });
  const ageInput = ageWrap.createEl("input", {
    cls: "pc-binp",
    attr: { type: "text", value: ctx.resolved.definition.age ?? "" },
  });
  ageInput.addEventListener("change", () => ctx.editState?.setAge(ageInput.value.trim() || null));

  renderHpField(form, ctx);
}

/** The selected Builder mode. Persisted HP values remain in the character. */
export interface HpSeedChoice { mode: "average" | "rolled" | "override"; value: number | null; }

export function getHpSeedChoice(ctx: ComponentRenderContext): HpSeedChoice {
  const stored = ctx.builderUiState?.get("builder.details.hp");
  if (stored && typeof stored === "object" && "mode" in stored &&
      (stored.mode === "average" || stored.mode === "rolled" || stored.mode === "override")) {
    const value = "value" in stored && typeof stored.value === "number" ? stored.value : null;
    return { mode: stored.mode, value };
  }
  const b = ctx.derived?.hpBreakdown;
  if (b?.override != null) return { mode: "override", value: b.override };
  if (b?.diceSource === "rolled") return { mode: "rolled", value: b.diceSum };
  return { mode: "average", value: null };
}

function renderHpField(form: HTMLElement, ctx: ComponentRenderContext): void {
  const choice = getHpSeedChoice(ctx);
  const field = form.createDiv({ cls: "pc-bfield" });
  field.createDiv({ cls: "pc-bseclabel", text: "Hit Points" });
  // The field-CARD (R5): one unit holding the big number, the equation, the mode
  // segment, the per-mode control and the hint — not a loose toggle + caption.
  const card = field.createDiv({ cls: "pc-bhp" });
  const b: HPBreakdown | undefined = ctx.derived?.hpBreakdown;

  const setMode = (mode: HpSeedChoice["mode"]): void => {
    if (mode === choice.mode) return;
    const es = ctx.editState;
    const hadRolled = b?.diceSource === "rolled" || (choice.mode === "rolled" && (choice.value ?? 0) > 0);
    const hadOverride = b?.override != null || (choice.mode === "override" && (choice.value ?? 0) > 0);
    const value = mode === "rolled" ? b?.averageDiceSum ?? null
      : mode === "override" ? b?.final ?? ctx.derived?.hp?.max ?? null
      : null;
    ctx.builderUiState?.set("builder.details.hp", { mode, value });
    if (es) {
      // The three Builder modes are exclusive, even if an existing sheet had
      // both a rolled sum and a manual override saved in its HP modal.
      if (mode !== "rolled" && hadRolled) {
        es.clearRolledHp();
      }
      if (mode !== "override" && hadOverride) {
        es.clearMaxHpOverride();
      }
      if (value != null && value > 0) {
        if (mode === "rolled") es.setRolledHp(value);
        if (mode === "override") es.setMaxHpOverride(value);
      }
    }
    field.remove();
    renderHpField(form, ctx);
  };

  card.createDiv({ cls: "pc-bhp-big", text: String(
    choice.mode === "override" ? choice.value ?? b?.final ?? ctx.derived?.hp?.max ?? "—"
      : b?.final ?? ctx.derived?.hp?.max ?? "—",
  ) });

  // The equation: the modal's own terms, chip-dressed. Grayed under Override,
  // the modal's is-greyed rule.
  if (b) {
    // The equation grays when Override is in force: the modal's is-greyed rule,
    // keyed on the CHOSEN mode (immediate) OR a persisted override (re-render),
    // so the click greys instantly even before the derived pass catches up.
    const overrideActive = choice.mode === "override" || b.override != null;
    const eq = card.createDiv({ cls: `pc-bhp-eq${overrideActive ? " is-greyed" : ""}` });
    const term = (text: string) => eq.createSpan({ cls: "pc-bhp-term", text });
    // The dice term: "N <die> × <levels>" one class; "N <die> × <a> · <die> × <b>" multiclass;
    // the modal's renderEquation prints diceSum + diceSource and leaves WHICH dice to its
    // diceContext title, so the builder states it inline where there is no title to hover.
    const dice = builderDiceContext(ctx);
    term(`${b.diceSum} ${b.diceSource === "rolled" ? "rolled" : dice ?? "average"}`);
    if (b.conLevels > 0) {
      const sign = b.conMod * b.conLevels >= 0 ? "+" : "−";
      term(`${sign} ${Math.abs(b.conMod * b.conLevels)} CON (${b.conMod >= 0 ? "+" : ""}${b.conMod} × ${b.conLevels})`);
    }
    for (const t of b.perLevelTerms) term(`${t.total >= 0 ? "+" : "−"} ${Math.abs(t.total)} ${t.label}`);
    if (b.modifier != null) term(`${b.modifier >= 0 ? "+" : "−"} ${Math.abs(b.modifier)} modifier`);
    if (b.exhaustionMultiplier < 1) term(`× ${b.exhaustionMultiplier} (exhaustion ${b.exhaustionLevel})`);
  }
  // The segment: the spell tab's Cast/Prepare dress (pc-spell-modetoggle idiom),
  // content-sized options — never stretched.
  const seg = card.createDiv({ cls: "pc-bseg" });
  for (const mode of ["average", "rolled", "override"] as const) {
    const opt = seg.createEl("button", {
      cls: `pc-bseg-opt${choice.mode === mode ? " on" : ""}`,
      text: mode === "average" ? "Average" : mode === "rolled" ? "Rolled" : "Override",
    });
    opt.addEventListener("click", () => setMode(mode));
  }

  if (choice.mode === "rolled") {
    const wrap = card.createDiv({ cls: "pc-bhp-inputrow" });
    const input = wrap.createEl("input", {
      cls: "pc-binp pc-bhp-input",
      attr: {
        type: "number", min: "1",
        // Seeded with the current dice sum (the average when nothing is rolled):
        // a starting point the player edits, never an empty box.
        value: String(b?.diceSource === "rolled" ? b.diceSum : choice.value ?? b?.averageDiceSum ?? ""),
      },
    });
    if (b) wrap.createSpan({ cls: "pc-bhp-ghost", text: `rolled dice sum · average: ${b.averageDiceSum}` });
    input.addEventListener("change", () => {
      const v = Number(input.value);
      const clean = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
      if (clean == null) {
        input.value = String(getHpSeedChoice(ctx).value ?? b?.averageDiceSum ?? "");
        return;
      }
      ctx.builderUiState?.set("builder.details.hp", { mode: "rolled", value: clean });
      ctx.editState?.setRolledHp(clean);
    });
  } else if (choice.mode === "override") {
    const wrap = card.createDiv({ cls: "pc-bhp-inputrow" });
    const input = wrap.createEl("input", {
      cls: "pc-binp pc-bhp-input",
      attr: { type: "number", min: "1", value: String(b?.override ?? choice.value ?? b?.final ?? "") },
    });
    const mark = wrap.createSpan({ cls: "archivist-override-mark", text: "*" });
    mark.setAttribute("title", "Override set — replaces every other term");
    wrap.createSpan({ cls: "pc-bhp-ghost", text: "replaces every other term" });
    input.addEventListener("change", () => {
      const v = Number(input.value);
      const clean = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
      if (clean == null) {
        input.value = String(getHpSeedChoice(ctx).value ?? b?.final ?? "");
        return;
      }
      ctx.builderUiState?.set("builder.details.hp", { mode: "override", value: clean });
      ctx.editState?.setMaxHpOverride(clean);
    });
  } else {
    card.createDiv({ cls: "pc-bhint", text: "First level takes the die's max; then the average." });
  }
}

/** "d6 × 5" one class; "d6 ×3 · d8 ×2" multiclass; null when no class carries a readable
 *  hit die. The modal's diceContext (max-hp-modal) owns the title-bar spelling; the
 *  builder's equation chip owns this inline one. Narrowed with `in`, no inline cast. */
function builderDiceContext(ctx: ComponentRenderContext): string | null {
  const parts: string[] = [];
  for (const c of ctx.resolved.classes ?? []) {
    const entity: unknown = c.entity;
    if (!entity || typeof entity !== "object" || !("hit_die" in entity)) continue;
    const die = entity.hit_die;
    if (typeof die !== "string" || !die || c.level < 1) continue;
    parts.push(parts.length === 0 ? `${die} × ${c.level}` : `${die} ×${c.level}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
