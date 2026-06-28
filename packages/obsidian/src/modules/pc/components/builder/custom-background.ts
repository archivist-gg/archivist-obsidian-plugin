import { Notice } from "obsidian";
import type { Ability } from "../../../../shared/types/choice";
import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import { ALL_SKILL_SLUGS } from "../../../../shared/types/choice";
import { renderChoiceCallout } from "./choice-callout";
import { applyChoiceToggle } from "./decision-strip";

// ── Form state ────────────────────────────────────────────────────────────

export interface CustomBackgroundState {
  name: string;
  /** Exactly 2 skill slugs. */
  skills: string[];
  /** Exactly 2 mixed tool/language entries. */
  extras: Array<{ kind: "tool" | "language"; value: string }>;
  featureMode: "borrow" | "write" | "inquiry";
  /** borrow */
  borrowedFeature: { name: string; description: string } | null;
  /** write */
  featureName: string;
  featureText: string;
  /** Optional 2024-style benefits drawer. */
  extras2024: { pool: Ability[]; originFeat: string | null } | null;
}

export function emptyCustomBackgroundState(): CustomBackgroundState {
  return {
    name: "",
    skills: [],
    extras: [],
    featureMode: "borrow",
    borrowedFeature: null,
    featureName: "",
    featureText: "",
    extras2024: null,
  };
}

// ── Assembler ───────────────────────────────────────────────────────────────

/** Fallback feature so a freshly-opened form (or a write-mode feature with no
 *  name typed yet) still assembles a schema-valid entity once name + picks are
 *  in. `feature.name`/`description` are both `.min(1)` in background.schema.ts,
 *  so neither may be empty. */
const PLACEHOLDER_FEATURE = {
  name: "Background Feature",
  description: "A feature granted by this custom background.",
};

/** Assembles a BackgroundEntity-shaped record for CompendiumManager.saveEntity.
 *  Returns null while the form is incomplete (no name / wrong pick counts).
 *
 *  saveEntity GENERATES the slug from `name`, so the record intentionally omits
 *  `slug`. Every union member matches the REAL background.types.ts shapes:
 *  fixed tools = { kind:"fixed", items:[...] }, fixed languages =
 *  { kind:"fixed", languages:[...] } — the renderer reads `.items`/`.languages`. */
export function buildCustomBackgroundData(
  st: CustomBackgroundState,
  edition: string,
): Record<string, unknown> | null {
  if (!st.name.trim()) return null;
  if (st.skills.length > 0 && st.skills.length !== 2) return null;
  if (st.extras.length > 0 && st.extras.length !== 2) return null;

  const feature =
    st.featureMode === "borrow" && st.borrowedFeature
      ? {
          name: st.borrowedFeature.name,
          // Borrowed features always carry a description in canonical data, but
          // guard against an empty one (schema min(1)).
          description: st.borrowedFeature.description.trim() || PLACEHOLDER_FEATURE.description,
        }
      : st.featureMode === "write" && st.featureName.trim()
        ? {
            name: st.featureName.trim(),
            description: st.featureText.trim() || PLACEHOLDER_FEATURE.description,
          }
        : { ...PLACEHOLDER_FEATURE };

  // The 2024 benefits are "omit while incomplete": the drawer seeds an empty
  // pool the moment it opens, and a half-filled pool (length ≠ 3) would produce
  // a degenerate ability_score_increases ({pool: []}) + an ability-points choice
  // with an empty pool — a record the REAL backgroundEntitySchema rejects (pool
  // requires .length(3), choice pool .nonempty()) yet saveEntity does not
  // validate, so it would land in the vault as a permanently-unresolvable
  // stepper. Only attach the benefits once the pool is exactly 3 abilities.
  const extras2024Complete = st.extras2024 && st.extras2024.pool.length === 3;

  const data: Record<string, unknown> = {
    name: st.name.trim(),
    edition,
    source: "Homebrew",
    description: "",
    skill_proficiencies: [...st.skills],
    tool_proficiencies: st.extras
      .filter((e) => e.kind === "tool")
      .map((e) => ({ kind: "fixed", items: [e.value] })),
    language_proficiencies: st.extras
      .filter((e) => e.kind === "language")
      .map((e) => ({ kind: "fixed", languages: [e.value] })),
    equipment: [],
    feature,
    ability_score_increases: extras2024Complete ? { pool: [...st.extras2024!.pool] } : null,
    origin_feat:
      extras2024Complete && st.extras2024!.originFeat ? `[[${st.extras2024!.originFeat}]]` : null,
    suggested_characteristics: null,
  };
  if (extras2024Complete) {
    data.choices = [
      {
        kind: "ability-points",
        id: "asi",
        label: "Ability Scores",
        points: 3,
        max_per: 2,
        pool: [...st.extras2024!.pool],
      },
    ];
  }
  return data;
}

// ── Pinned row + parts-builder form ─────────────────────────────────────────

/** The form STATE lives directly under this key (so callers/tests can read
 *  `.skills`/`.extras` without unwrapping); the open flag is a sibling. */
const STATE_KEY = "builder.bg-custom";
const OPEN_KEY = "builder.bg-custom.open";

/** Humanize a hyphenated skill slug for the callout chip label. */
const labelCase = (s: string): string =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** §7 Step 4 — the pinned "✦ Custom Background" entry above the picker table.
 *  Click toggles a parts-builder form that assembles a REAL homebrew
 *  BackgroundEntity and persists it via CompendiumManager.saveEntity, then
 *  selects it through the existing setBackground machinery (registry → picker →
 *  decisions → recalc all flow for free; no new Character fields). */
export function renderCustomBackgroundRow(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const bag = ctx.builderUiState;
  const state: CustomBackgroundState =
    (bag?.get(STATE_KEY) as CustomBackgroundState | undefined) ?? emptyCustomBackgroundState();
  bag?.set(STATE_KEY, state);
  let open = (bag?.get(OPEN_KEY) as boolean | undefined) ?? false;

  const wrap = parent.createDiv({ cls: "pc-bcustomwrap" });
  const row = wrap.createDiv({ cls: `pc-bcustomrow${open ? " open" : ""}` });
  row.createSpan({ cls: "pc-bcustomrow-nm", text: "✦ Custom Background" });
  row.createSpan({ cls: "pc-bctag", text: "Build" });

  // The form lives in its own host so a redraw (state edit) re-renders ONLY the
  // form, never the row — the row's click listener survives.
  const formHost = wrap.createDiv({ cls: "pc-bcustom-host" });
  const drawForm = (): void => {
    formHost.empty();
    if (open) renderForm(formHost, ctx, state, drawForm);
  };
  row.addEventListener("click", () => {
    open = !open;
    bag?.set(OPEN_KEY, open);
    row.toggleClass("open", open);
    drawForm();
  });
  drawForm();
}

function renderForm(
  host: HTMLElement,
  ctx: ComponentRenderContext,
  st: CustomBackgroundState,
  redraw: () => void,
): void {
  const form = host.createDiv({ cls: "pc-bcustom" });
  form.createDiv({
    cls: "pc-bcustom-intro",
    text:
      "Assemble a background from parts: any two skills, any two tool " +
      "proficiencies or languages, and a feature you borrow or write.",
  });

  // ── Name (commit on change, not input, so typing never loses focus on redraw)
  const nameRow = form.createDiv({ cls: "pc-bcustom-namerow" });
  nameRow.createSpan({ cls: "pc-bcustom-namelbl", text: "Name" });
  const nameInput = nameRow.createEl("input", {
    cls: "pc-bcustom-name",
    attr: { type: "text", placeholder: "Background name…" },
  });
  nameInput.value = st.name;
  nameInput.addEventListener("change", () => {
    st.name = nameInput.value;
    redraw();
  });

  // ── Skills: choose 2 over the 18 slugs (choice-callout reuse)
  const skillSel = new Set(st.skills);
  renderChoiceCallout(form, {
    label: "Skills",
    choose: 2,
    options: ALL_SKILL_SLUGS.map((s) => ({ value: s, label: labelCase(s) })),
    selected: skillSel,
    required: true,
    onToggle: (value) => {
      applyChoiceToggle(skillSel, value, 2);
      st.skills = [...skillSel];
      redraw();
    },
  });

  // ── Tools or languages: a text input + two add buttons + removable chips
  renderExtras(form, st, redraw);

  // ── Feature: three seg modes
  renderFeatureSection(form, ctx, st, redraw);

  // ── Optional 2024-style benefits drawer
  render2024Drawer(form, ctx, st, redraw);

  // ── Create & use
  const data = buildCustomBackgroundData(st, editionOf(ctx));
  const foot = form.createDiv({ cls: "pc-bcustom-foot" });
  const create = foot.createEl("button", { cls: "pc-bcreate", text: "Create & use" });
  create.disabled = !data;
  create.addEventListener("click", () => {
    const homebrew = ctx.core.compendiums.getAll().find((c: { homebrew?: boolean }) => c.homebrew);
    const built = buildCustomBackgroundData(st, editionOf(ctx));
    if (!homebrew || !built) return;
    void (
      ctx.core.compendiums as unknown as {
        saveEntity(comp: string, type: string, d: Record<string, unknown>): Promise<{ slug: string }>;
      }
    )
      .saveEntity(homebrew.name, "background", built)
      .then((reg) => {
        ctx.editState?.setBackground(reg.slug);
        new Notice(`Saved to ${homebrew.name}`);
      })
      .catch((err: Error) => new Notice(`Failed to save: ${err.message}`));
  });
}

function editionOf(ctx: ComponentRenderContext): string {
  return (ctx.resolved.definition as { edition?: string }).edition ?? "2014";
}

function renderExtras(form: HTMLElement, st: CustomBackgroundState, redraw: () => void): void {
  const box = form.createDiv({ cls: "pc-bextra" });
  const head = box.createDiv({ cls: "pc-bextra-head" });
  head.createSpan({ cls: "pc-bextra-label", text: "Tools or Languages" });
  head.createSpan({ cls: "pc-bextra-badge", text: "Choose 2 · any mix" });

  const chips = box.createDiv({ cls: "pc-bextra-chips" });
  st.extras.forEach((e, i) => {
    const chip = chips.createSpan({ cls: "pc-bextra-chip" });
    chip.createSpan({ cls: "pc-bextra-chip-v", text: e.value });
    chip.createSpan({ cls: "pc-bextra-chip-ty", text: e.kind === "tool" ? "tool" : "lang" });
    const x = chip.createSpan({ cls: "pc-bextra-chip-x", text: "×" });
    x.addEventListener("click", () => {
      st.extras.splice(i, 1);
      redraw();
    });
  });

  const adder = box.createDiv({ cls: "pc-bextra-adder" });
  const input = adder.createEl("input", {
    cls: "pc-bextra-input",
    attr: { type: "text", placeholder: "Tool or language…" },
  });
  const add = (kind: "tool" | "language"): void => {
    const value = input.value.trim();
    if (!value || st.extras.length >= 2) return;
    st.extras.push({ kind, value });
    redraw();
  };
  const addTool = adder.createSpan({ cls: "pc-bextra-add pc-bextra-add-tool", text: "+ tool" });
  const addLang = adder.createSpan({ cls: "pc-bextra-add pc-bextra-add-lang", text: "+ language" });
  addTool.addEventListener("click", () => add("tool"));
  addLang.addEventListener("click", () => add("language"));
}

function renderFeatureSection(
  form: HTMLElement,
  ctx: ComponentRenderContext,
  st: CustomBackgroundState,
  redraw: () => void,
): void {
  const box = form.createDiv({ cls: "pc-bfeat" });
  box.createDiv({ cls: "pc-bfeat-label", text: "Feature" });

  const seg = box.createDiv({ cls: "pc-bseg" });
  const mkSeg = (mode: CustomBackgroundState["featureMode"], text: string, disabled = false): void => {
    const opt = seg.createSpan({
      cls: `pc-bseg-opt${st.featureMode === mode ? " on" : ""}${disabled ? " disabled" : ""}`,
      text,
    });
    if (disabled) {
      opt.setAttribute("title", "Archivist inquiry generates a feature — coming in a later release.");
      return;
    }
    opt.addEventListener("click", () => {
      st.featureMode = mode;
      redraw();
    });
  };
  mkSeg("borrow", "Borrow");
  mkSeg("write", "Write your own");
  mkSeg("inquiry", "✦ Ask Inquiry", true);

  if (st.featureMode === "borrow") {
    renderBorrow(box, ctx, st, redraw);
  } else if (st.featureMode === "write") {
    renderWrite(box, st);
  }
}

function renderBorrow(
  box: HTMLElement,
  ctx: ComponentRenderContext,
  st: CustomBackgroundState,
  redraw: () => void,
): void {
  const backgrounds = ctx.core.entities.search("", "background", Number.POSITIVE_INFINITY);
  // Every background's feature, as {name, description} options keyed by name.
  const features = backgrounds
    .map((e: RegisteredEntity) => (e.data as { feature?: { name?: string; description?: string } }).feature)
    .filter((f): f is { name: string; description: string } => !!f?.name && typeof f.description === "string");

  const pick = box.createDiv({ cls: "pc-bfeat-pick" });
  const select = pick.createEl("select", { cls: "pc-bborrow pc-bdd" });
  select.createEl("option", { text: "Choose a feature…", attr: { value: "" } });
  for (const f of features) select.createEl("option", { text: f.name, attr: { value: f.name } });
  if (st.borrowedFeature) select.value = st.borrowedFeature.name;

  const desc = box.createDiv({ cls: "pc-bfeat-desc" });
  if (st.borrowedFeature) desc.setText(st.borrowedFeature.description);

  select.addEventListener("change", () => {
    const f = features.find((x) => x.name === select.value);
    st.borrowedFeature = f ? { name: f.name, description: f.description } : null;
    redraw();
  });
}

function renderWrite(box: HTMLElement, st: CustomBackgroundState): void {
  const nameInput = box.createEl("input", {
    cls: "pc-bfeat-name",
    attr: { type: "text", placeholder: "Feature name…" },
  });
  nameInput.value = st.featureName;
  nameInput.addEventListener("change", () => {
    st.featureName = nameInput.value;
  });
  const text = box.createEl("textarea", {
    cls: "pc-bfeat-text",
    attr: { placeholder: "Describe the feature…" },
  });
  text.value = st.featureText;
  text.addEventListener("change", () => {
    st.featureText = text.value;
  });
}

/** The six ability slugs, ordered, with their conventional short labels. */
const ABILITY_OPTIONS: Array<{ value: Ability; label: string }> = [
  { value: "str", label: "STR" },
  { value: "dex", label: "DEX" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "WIS" },
  { value: "cha", label: "CHA" },
];

function render2024Drawer(
  form: HTMLElement,
  ctx: ComponentRenderContext,
  st: CustomBackgroundState,
  redraw: () => void,
): void {
  const box = form.createDiv({ cls: "pc-b2024" });
  const head = box.createDiv({ cls: "pc-b2024-head" });
  head.createSpan({ cls: "pc-b2024-title", text: "✦ 2024-style benefits" });
  const toggle = head.createSpan({ cls: "pc-b2024-toggle", text: st.extras2024 ? "−" : "＋" });
  toggle.addEventListener("click", () => {
    st.extras2024 = st.extras2024 ? null : { pool: [], originFeat: null };
    redraw();
  });
  box.createDiv({
    cls: "pc-b2024-note",
    text:
      "Optionally add an ability-score increase pool of three and an origin feat. " +
      "Build fresh — editions may mix.",
  });

  // Closed: just the title/toggle/note. The benefits only matter when authored,
  // and a half-filled pool is omitted from the assembled entity (see assembler).
  if (!st.extras2024) return;
  const extras = st.extras2024;

  // ── Ability pool: choose 3 of the six abilities (choice-callout reuse).
  const poolSel = new Set<string>(extras.pool);
  renderChoiceCallout(box, {
    label: "Ability Score Increase",
    choose: 3,
    options: ABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label })),
    selected: poolSel,
    required: true,
    onToggle: (value) => {
      applyChoiceToggle(poolSel, value, 3);
      extras.pool = [...poolSel] as Ability[];
      redraw();
    },
  });

  // ── Origin feat: a simple select over registry feats, "None" by default.
  const featRow = box.createDiv({ cls: "pc-b2024-featrow" });
  featRow.createSpan({ cls: "pc-b2024-featlbl", text: "Origin Feat" });
  const feats = ctx.core.entities.search("", "feat", Number.POSITIVE_INFINITY);
  const select = featRow.createEl("select", { cls: "pc-b2024-feat pc-bdd" });
  select.createEl("option", { text: "None", attr: { value: "" } });
  for (const f of feats) {
    select.createEl("option", { text: f.name, attr: { value: f.slug } });
  }
  select.value = extras.originFeat ?? "";
  select.addEventListener("change", () => {
    extras.originFeat = select.value || null;
    redraw();
  });
}
