import type { ComponentRenderContext } from "../component.types";

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
 *  plus the D10 Hit-Points seed choice (Average / Manual).
 *  Nothing else (personality/backstory/appearance are out of scope by spec). */
export function renderDetailsStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const form = body.createDiv({ cls: "pc-bform" });

  const nameField = form.createDiv({ cls: "pc-bfield" });
  nameField.createDiv({ cls: "pc-bseclabel", text: "Name" });
  const nameInput = nameField.createEl("input", {
    cls: "pc-binp",
    attr: { type: "text", value: ctx.resolved.definition.name ?? "" },
  });
  nameInput.addEventListener("change", () => ctx.editState?.setName(nameInput.value));

  const alField = form.createDiv({ cls: "pc-bfield" });
  alField.createDiv({ cls: "pc-bseclabel", text: "Alignment · optional" });
  const grid = alField.createDiv({ cls: "pc-balgrid" });
  const current = ctx.resolved.definition.alignment ?? null;
  for (const a of ALIGNMENTS) {
    const cell = grid.createDiv({ cls: `pc-bal${current === a.full ? " on" : ""}` });
    cell.createDiv({ cls: "pc-bal-ab", text: a.ab });
    cell.createDiv({ cls: "pc-bal-w", text: a.word });
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

/** D10 (user-amended): how Finish seeds HP. Session-only choice — Average is
 *  the default and writes nothing to the file until Finish. */
export interface HpSeedChoice { mode: "average" | "manual"; value: number | null; }

export function getHpSeedChoice(ctx: ComponentRenderContext): HpSeedChoice {
  return (ctx.builderUiState?.get("builder.details.hp") as HpSeedChoice | undefined)
    ?? { mode: "average", value: null };
}

function renderHpField(form: HTMLElement, ctx: ComponentRenderContext): void {
  const choice = getHpSeedChoice(ctx);
  const field = form.createDiv({ cls: "pc-bfield" });
  field.createDiv({ cls: "pc-bseclabel", text: "Hit Points" });
  const seg = field.createDiv({ cls: "pc-bseg" });
  // HP field is the last field in the form, so remove + re-render appends it
  // back at the same position — no flicker of order.
  const setMode = (mode: "average" | "manual"): void => {
    ctx.builderUiState?.set("builder.details.hp", { ...getHpSeedChoice(ctx), mode });
    field.remove();
    renderHpField(form, ctx);
  };
  const avg = seg.createEl("button", { cls: `pc-bseg-opt${choice.mode === "average" ? " on" : ""}`, text: "Average" });
  avg.addEventListener("click", () => setMode("average"));
  const man = seg.createEl("button", { cls: `pc-bseg-opt${choice.mode === "manual" ? " on" : ""}`, text: "Manual" });
  man.addEventListener("click", () => setMode("manual"));
  if (choice.mode === "manual") {
    const wrap = field.createDiv({ cls: "pc-bage" });
    const input = wrap.createEl("input", {
      cls: "pc-binp pc-bhp-input",
      attr: { type: "number", min: "1", value: choice.value != null ? String(choice.value) : "" },
    });
    // Writes ONLY to the session bag — must never trigger a re-render: a blur
    // that re-renders mid-flight would swallow a following Finish click.
    input.addEventListener("change", () => {
      const v = Number(input.value);
      ctx.builderUiState?.set("builder.details.hp", {
        mode: "manual",
        value: Number.isFinite(v) && v > 0 ? Math.round(v) : null,
      });
    });
  } else {
    field.createDiv({ cls: "pc-bhint", text: "Max HP from class hit dice (first level max, then average)." });
  }
}
