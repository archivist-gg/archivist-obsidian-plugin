import { Modal, Notice, setIcon, type App, type TFile } from "obsidian";
import { PORTRAIT_IMAGE_EXTENSIONS, coverCrop, marqueeToCrop, isCoverCrop, type CropParams } from "../pc.portrait";

export interface PortraitPickerOptions {
  pcFile: TFile;
  hasPortrait: boolean;
  /** Normalized, resolved by the caller (T5 owns settings resolution). */
  portraitsFolder: string;
  /** Guard: the view still shows the file captured at open (spec F11). */
  isCurrentFile: () => boolean;
  /** Sole commit path. `crop === null` means "use the default cover crop". */
  onPick: (image: TFile, crop: CropParams | null) => void;
  onRemove: () => void;
}

const IMPORT_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp";
const SEARCH_DEBOUNCE_MS = 150;
const GRID_CAP = 200;
const MAX_DISPLAY_HEIGHT = 320;
// Mirrors `.pc-portrait-picker-body { width: 432px }` (components.css): the
// crop img/stage `max-width: 100%` caps the RENDERED width at the body width,
// so the layout-less fallback derivation must cap at the same number or
// derived dims diverge from rendered dims and every committed crop fraction
// is wrong (P4b framing lesson, .superpowers/sdd/p4b-framing-debug-report.md).
// Contract-tested in tests/pc-portrait-picker-modal.test.ts.
const MAX_DISPLAY_WIDTH = 432;
const GUARD_MESSAGE = "The view no longer shows this character. Portrait not changed.";
// #^[]|\:/ plus C0 control characters (deliberately stripped from imported filenames).
// eslint-disable-next-line no-control-regex -- intentional: sanitizing filesystem-unsafe control chars
const FORBIDDEN_BASENAME_CHARS = new RegExp("[#^\\[\\]|\\\\/:\\x00-\\x1f]", "g");

type Corner = "nw" | "ne" | "sw" | "se";
const OPPOSITE_CORNER: Record<Corner, Corner> = { nw: "se", ne: "sw", sw: "ne", se: "nw" };

type PendingSource =
  | { kind: "vault"; file: TFile; url: string }
  | { kind: "import"; importFile: File; url: string; objectUrl: true };

type DragState =
  | { kind: "move"; pointerId: number; startPX: number; startPY: number; startMx: number; startMy: number }
  | {
      kind: "resize";
      pointerId: number;
      corner: Corner;
      anchorX: number;
      anchorY: number;
      startPX: number;
      startPY: number;
      startCornerX: number;
      startCornerY: number;
    };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** Splits an import filename into a sanitized base + its extension. */
function sanitizeName(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  const rawBase = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";
  const cleaned = rawBase.replace(FORBIDDEN_BASENAME_CHARS, "").trim();
  return { base: cleaned.length > 0 ? cleaned : "portrait", ext };
}

/** Absolute pixel position of one corner of the mx/my/side square. */
function cornerPoint(corner: Corner, mx: number, my: number, side: number): { x: number; y: number } {
  const right = corner === "ne" || corner === "se";
  const bottom = corner === "sw" || corner === "se";
  return { x: right ? mx + side : mx, y: bottom ? my + side : my };
}

/** Largest square side reachable by dragging `corner` while its opposite corner (the anchor) stays fixed. */
function maxSideFor(corner: Corner, anchorX: number, anchorY: number, dispW: number, dispH: number): number {
  const growsRight = corner === "ne" || corner === "se";
  const growsDown = corner === "sw" || corner === "se";
  const availX = growsRight ? dispW - anchorX : anchorX;
  const availY = growsDown ? dispH - anchorY : anchorY;
  return Math.max(0, Math.min(availX, availY));
}

/** Reconstructs the square's top-left origin from a fixed anchor corner + a resolved side. */
function originFor(corner: Corner, anchorX: number, anchorY: number, side: number): { mx: number; my: number } {
  const right = corner === "ne" || corner === "se";
  const bottom = corner === "sw" || corner === "se";
  return { mx: right ? anchorX : anchorX - side, my: bottom ? anchorY : anchorY - side };
}

export class PortraitPickerModal extends Modal {
  private stage: "grid" | "crop" = "grid";

  // Grid-stage state.
  private searchTerm = "";
  private searchRawValue = "";
  private searchDebounceTimer: ReturnType<typeof activeWindow.setTimeout> | null = null;
  private showAll = false;
  private fileInputEl!: HTMLInputElement;
  private listWrapEl!: HTMLElement;
  private originKey: string | null = null;
  // Cached per scope-state (modal open + checkbox toggle only, NOT per keystroke —
  // Gate-1b #2). Search filters this cached list; it never re-derives it.
  private candidates: TFile[] = [];

  // Crop-stage state.
  private pendingSource: PendingSource | null = null;
  private dispW = 0;
  private dispH = 0;
  private marquee: { mx: number; my: number; side: number } | null = null;
  private commitEnabled = false;
  private cropIsFallbackNull = false;
  private cropImgEl?: HTMLImageElement;
  private cropStageEl?: HTMLElement;
  private marqueeEl?: HTMLElement;
  private useBtnEl?: HTMLButtonElement;
  private dragState: DragState | null = null;

  constructor(
    app: App,
    private readonly opts: PortraitPickerOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass("archivist-modal", "pc-portrait-picker");
    this.refreshCandidates();
    this.renderGridStage(true);

    this.scope.register([], "Escape", () => {
      if (this.stage === "crop") {
        this.backToGrid();
        return false;
      }
      return true;
    });
    this.scope.register([], "Enter", () => {
      if (this.stage === "crop" && this.commitEnabled) {
        this.commitFromCrop();
        return false;
      }
      return true;
    });
  }

  onClose(): void {
    if (this.searchDebounceTimer) activeWindow.clearTimeout(this.searchDebounceTimer);
    this.releasePendingObjectUrl();
    this.contentEl.empty();
  }

  // ---------------------------------------------------------------- grid --

  private renderGridStage(autofocusSearch: boolean): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Character portrait" });
    const body = this.contentEl.createDiv({ cls: "pc-portrait-picker-body" });

    const search = body.createEl("input", {
      cls: "pc-portrait-picker-search",
      attr: { type: "text", placeholder: "Search images..." },
    });
    search.value = this.searchRawValue;
    search.addEventListener("input", () => {
      this.searchRawValue = search.value;
      if (this.searchDebounceTimer) activeWindow.clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = activeWindow.setTimeout(() => {
        this.searchTerm = search.value.trim().toLowerCase();
        this.renderGridList();
      }, SEARCH_DEBOUNCE_MS);
    });
    if (autofocusSearch) search.focus();

    const scopeRow = body.createDiv({ cls: "pc-portrait-picker-scope" });
    const scopeText = scopeRow.createSpan();
    scopeText.appendText("Showing ");
    scopeText.createEl("b", { text: this.opts.portraitsFolder });
    const checkLabel = scopeRow.createEl("label", { cls: "pc-portrait-picker-check" });
    const checkbox = checkLabel.createEl("input", { attr: { type: "checkbox" } });
    checkbox.checked = this.showAll;
    checkLabel.appendText("Show all vault images");
    checkbox.addEventListener("change", () => {
      this.showAll = checkbox.checked;
      this.refreshCandidates();
      this.renderGridList();
    });

    this.listWrapEl = body.createDiv({ cls: "pc-portrait-picker-listwrap" });
    this.renderGridList();

    const fileInput = body.createEl("input", {
      cls: "pc-portrait-picker-file-input",
      attr: { type: "file", accept: IMPORT_ACCEPT },
    });
    fileInput.addEventListener("change", () => this.handleFileSelected(fileInput));
    this.fileInputEl = fileInput;

    const footer = this.contentEl.createDiv({ cls: "archivist-modal-buttons pc-portrait-picker-foot" });
    if (this.opts.hasPortrait) {
      const removeBtn = footer.createEl("button", {
        cls: "pc-portrait-picker-remove",
        attr: { type: "button" },
      });
      const removeIcon = removeBtn.createSpan({ cls: "pc-portrait-picker-remove-icon" });
      setIcon(removeIcon, "trash-2");
      removeBtn.appendText("Remove current image");
      removeBtn.addEventListener("click", () => {
        this.opts.onRemove();
        this.close();
      });
    }
    const cancelBtn = footer.createEl("button", { attr: { type: "button" }, text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
  }

  /** Recomputes the cached candidate list for the current scope. Call ONLY on
   * modal open and show-all toggle (Gate-1b #2) — never per keystroke. */
  private refreshCandidates(): void {
    const folder = this.opts.portraitsFolder;
    const images = this.app.vault
      .getFiles()
      .filter((f) => PORTRAIT_IMAGE_EXTENSIONS.has(f.extension.toLowerCase()));
    const scoped = this.showAll ? images : images.filter((f) => f.path.startsWith(folder + "/"));
    this.candidates = scoped.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  private renderGridList(): void {
    this.listWrapEl.empty();
    const candidates = this.candidates;
    const term = this.searchTerm;
    const filtered = term.length === 0 ? candidates : candidates.filter((f) => f.path.toLowerCase().includes(term));
    const capped = filtered.slice(0, GRID_CAP);

    const grid = this.listWrapEl.createDiv({ cls: "pc-portrait-picker-grid" });
    const importTile = grid.createEl("button", {
      cls: "pc-portrait-picker-cell pc-portrait-picker-import",
      attr: { type: "button", "aria-label": "Import image from computer", title: "Import from computer" },
    });
    importTile.dataset.portraitKey = "import";
    importTile.createDiv({ cls: "pc-portrait-picker-thumb", text: "+" });
    importTile.createDiv({ cls: "pc-portrait-picker-cellname", text: "Import image" });
    importTile.addEventListener("click", () => this.fileInputEl.click());

    if (filtered.length === 0) {
      // Scope genuinely empty (before any search) gets the "tick show-all" hint;
      // a search that empties an otherwise non-empty scope just says no match
      // (spec §3.4 — same string show-all-with-no-matches uses).
      const scopeIsEmpty = candidates.length === 0;
      this.listWrapEl.createEl("p", {
        cls: "pc-portrait-picker-empty",
        text:
          scopeIsEmpty && !this.showAll
            ? `No images in ${this.opts.portraitsFolder} yet. Tick 'Show all vault images' to browse the whole vault.`
            : "No images match.",
      });
      return;
    }

    for (const file of capped) {
      const cell = grid.createEl("button", {
        cls: "pc-portrait-picker-cell",
        attr: { type: "button", "aria-label": `Choose ${file.name}` },
      });
      cell.dataset.portraitKey = file.path;
      const thumb = cell.createDiv({ cls: "pc-portrait-picker-thumb" });
      thumb.createEl("img", { attr: { src: this.app.vault.getResourcePath(file), alt: "", loading: "lazy" } });
      cell.createDiv({ cls: "pc-portrait-picker-cellname", text: file.name });
      cell.addEventListener("click", () => {
        this.originKey = file.path;
        this.pendingSource = { kind: "vault", file, url: this.app.vault.getResourcePath(file) };
        this.enterCropStage();
      });
    }

    if (filtered.length > GRID_CAP) {
      this.listWrapEl.createEl("p", {
        cls: "pc-portrait-picker-hint-cap",
        text: "More images match. Refine your search.",
      });
    }
  }

  private handleFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    this.originKey = "import";
    this.pendingSource = { kind: "import", importFile: file, url: URL.createObjectURL(file), objectUrl: true };
    this.enterCropStage();
  }

  private enterCropStage(): void {
    if (this.searchDebounceTimer) activeWindow.clearTimeout(this.searchDebounceTimer);
    this.stage = "crop";
    this.dispW = 0;
    this.dispH = 0;
    this.marquee = null;
    this.commitEnabled = false;
    this.cropIsFallbackNull = false;
    this.dragState = null;
    this.renderCropStage();
  }

  // ---------------------------------------------------------------- crop --

  private renderCropStage(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Character portrait" });
    const body = this.contentEl.createDiv({ cls: "pc-portrait-picker-body" });
    body.createEl("p", {
      cls: "pc-portrait-crop-hint",
      text: "Drag the circle over the part you want · corners resize",
    });

    const stage = body.createDiv({ cls: "pc-portrait-crop-stage is-loading" });
    this.cropStageEl = stage;
    const img = stage.createEl("img", {
      cls: "pc-portrait-crop-img",
      attr: { src: this.pendingSource?.url ?? "", alt: "" },
    });
    this.cropImgEl = img;
    img.addEventListener("load", () => this.onCropImageLoad());
    img.addEventListener("error", () => this.onCropImageError());

    const marquee = stage.createDiv({ cls: "pc-portrait-crop-marquee" });
    this.marqueeEl = marquee;
    marquee.addEventListener("pointerdown", (e) => this.beginMove(e));
    marquee.addEventListener("pointermove", (e) => this.onPointerMove(e));
    marquee.addEventListener("pointerup", (e) => this.endDrag(e));
    marquee.addEventListener("pointercancel", (e) => this.endDrag(e));
    (["nw", "ne", "sw", "se"] as const).forEach((corner) => {
      const handle = marquee.createDiv({ cls: `pc-portrait-crop-handle pc-portrait-crop-handle-${corner}` });
      handle.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.beginResize(e, corner);
      });
      handle.addEventListener("pointermove", (e) => this.onPointerMove(e));
      handle.addEventListener("pointerup", (e) => this.endDrag(e));
      handle.addEventListener("pointercancel", (e) => this.endDrag(e));
    });

    const footer = this.contentEl.createDiv({ cls: "archivist-modal-buttons pc-portrait-picker-foot" });
    const backBtn = footer.createEl("button", { cls: "pc-portrait-picker-back", attr: { type: "button" }, text: "Back" });
    backBtn.addEventListener("click", () => this.backToGrid());
    const useBtn = footer.createEl("button", {
      cls: "mod-cta",
      attr: { type: "button" },
      text: "Use this framing",
    });
    useBtn.disabled = true;
    useBtn.addEventListener("click", () => this.commitFromCrop());
    this.useBtnEl = useBtn;
  }

  private onCropImageLoad(): void {
    const img = this.cropImgEl;
    if (!img) return;
    this.cropStageEl?.removeClass("is-loading");
    const nw = img.naturalWidth;
    if (nw === 0) {
      new Notice("Cannot read this image, using the full picture.");
      this.cropIsFallbackNull = true;
      this.dispW = 0;
      this.dispH = 0;
      this.marquee = null;
      this.setUseEnabled(true);
      return;
    }
    const dims = this.resolveDisplayedDims(img);
    this.dispW = dims.w;
    this.dispH = dims.h;
    const cover = coverCrop(this.dispW, this.dispH);
    this.marquee = { mx: cover.x * this.dispW, my: cover.y * this.dispW, side: cover.size * this.dispW };
    this.cropIsFallbackNull = false;
    this.renderMarqueeGeometry();
    this.setUseEnabled(true);
  }

  private onCropImageError(): void {
    new Notice("Could not load this image.");
    this.backToGrid();
  }

  /**
   * The crop image's displayed dimensions: the SINGLE source of truth for
   * every marquee computation (init, move clamping, min/max side, commit
   * conversion). Prefers the MEASURED live layout (real Obsidian), so the
   * coordinate space is exactly what the user sees and cannot diverge from
   * the CSS; falls back to deriving what the CSS caps (`max-height: 320px`
   * plus `max-width: 100%` of the 432px body) produce, for layout-less
   * environments (jsdom tests) where rects measure 0.
   */
  private resolveDisplayedDims(img: HTMLImageElement): { w: number; h: number } {
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return { w: rect.width, h: rect.height };
    let h = Math.min(img.naturalHeight, MAX_DISPLAY_HEIGHT);
    let w = (img.naturalWidth * h) / img.naturalHeight;
    if (w > MAX_DISPLAY_WIDTH) {
      w = MAX_DISPLAY_WIDTH;
      h = (w * img.naturalHeight) / img.naturalWidth;
    }
    return { w, h };
  }

  /** Re-syncs dispW/dispH from the live image (gesture start + commit). */
  private refreshDisplayedDims(): void {
    const img = this.cropImgEl;
    if (!img || img.naturalWidth === 0) return;
    const dims = this.resolveDisplayedDims(img);
    this.dispW = dims.w;
    this.dispH = dims.h;
  }

  private setUseEnabled(enabled: boolean): void {
    this.commitEnabled = enabled;
    const btn = this.useBtnEl;
    if (!btn) return;
    btn.disabled = !enabled;
    if (enabled) btn.focus();
  }

  private renderMarqueeGeometry(): void {
    if (!this.marqueeEl || !this.marquee) return;
    this.marqueeEl.setCssProps({
      "--pc-crop-mx": `${this.marquee.mx}px`,
      "--pc-crop-my": `${this.marquee.my}px`,
      "--pc-crop-side": `${this.marquee.side}px`,
    });
  }

  private beginMove(e: PointerEvent): void {
    if (!this.marquee) return;
    this.refreshDisplayedDims();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* no active pointer: gesture continues via bubbling listeners */
    }
    this.dragState = {
      kind: "move",
      pointerId: e.pointerId,
      startPX: e.clientX,
      startPY: e.clientY,
      startMx: this.marquee.mx,
      startMy: this.marquee.my,
    };
  }

  private beginResize(e: PointerEvent, corner: Corner): void {
    if (!this.marquee) return;
    this.refreshDisplayedDims();
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* no active pointer: gesture continues via bubbling listeners */
    }
    const { mx, my, side } = this.marquee;
    const anchor = cornerPoint(OPPOSITE_CORNER[corner], mx, my, side);
    const start = cornerPoint(corner, mx, my, side);
    this.dragState = {
      kind: "resize",
      pointerId: e.pointerId,
      corner,
      anchorX: anchor.x,
      anchorY: anchor.y,
      startPX: e.clientX,
      startPY: e.clientY,
      startCornerX: start.x,
      startCornerY: start.y,
    };
  }

  private onPointerMove(e: PointerEvent): void {
    const drag = this.dragState;
    if (!drag || !this.marquee || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startPX;
    const dy = e.clientY - drag.startPY;
    if (drag.kind === "move") {
      const maxX = Math.max(0, this.dispW - this.marquee.side);
      const maxY = Math.max(0, this.dispH - this.marquee.side);
      this.marquee.mx = clamp(drag.startMx + dx, 0, maxX);
      this.marquee.my = clamp(drag.startMy + dy, 0, maxY);
    } else {
      const candX = drag.startCornerX + dx;
      const candY = drag.startCornerY + dy;
      const rawSide = Math.max(Math.abs(candX - drag.anchorX), Math.abs(candY - drag.anchorY));
      const minSide = Math.min(24, Math.min(this.dispW, this.dispH));
      const maxSide = Math.max(minSide, maxSideFor(drag.corner, drag.anchorX, drag.anchorY, this.dispW, this.dispH));
      const side = clamp(rawSide, minSide, maxSide);
      const origin = originFor(drag.corner, drag.anchorX, drag.anchorY, side);
      this.marquee.mx = origin.mx;
      this.marquee.my = origin.my;
      this.marquee.side = side;
    }
    this.renderMarqueeGeometry();
  }

  private endDrag(e: PointerEvent): void {
    if (this.dragState && this.dragState.pointerId === e.pointerId) this.dragState = null;
  }

  // -------------------------------------------------------------- commit --

  private resolveCrop(): CropParams | null {
    if (this.cropIsFallbackNull || !this.marquee || this.dispW <= 0) return null;
    this.refreshDisplayedDims();
    const params = marqueeToCrop(this.marquee.mx, this.marquee.my, this.marquee.side, this.dispW);
    return isCoverCrop(params, this.dispW, this.dispH) ? null : params;
  }

  private commitFromCrop(): void {
    if (!this.commitEnabled || !this.pendingSource) return;
    if (this.pendingSource.kind === "vault") {
      this.commitVaultPick(this.pendingSource);
    } else {
      void this.commitImport(this.pendingSource);
    }
  }

  private commitVaultPick(source: Extract<PendingSource, { kind: "vault" }>): void {
    if (!this.opts.isCurrentFile()) {
      new Notice(GUARD_MESSAGE);
      this.close();
      return;
    }
    this.opts.onPick(source.file, this.resolveCrop());
    this.close();
  }

  private async commitImport(source: Extract<PendingSource, { kind: "import" }>): Promise<void> {
    if (!this.opts.isCurrentFile()) {
      new Notice(GUARD_MESSAGE);
      this.close();
      return;
    }
    try {
      await this.ensureFolder(this.opts.portraitsFolder);
      const { base, ext } = sanitizeName(source.importFile.name);
      const path = this.uniquifyPath(this.opts.portraitsFolder, base, ext);
      const buf = await source.importFile.arrayBuffer();
      const created = await this.app.vault.createBinary(path, buf);
      if (!this.opts.isCurrentFile()) {
        new Notice(GUARD_MESSAGE);
        this.close();
        return;
      }
      this.opts.onPick(created, this.resolveCrop());
      this.close();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice("Import failed: " + message);
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    const segments = folder.split("/").filter((s) => s.length > 0);
    let acc = "";
    for (const seg of segments) {
      acc = acc.length > 0 ? `${acc}/${seg}` : seg;
      if (!this.app.vault.getAbstractFileByPath(acc)) {
        await this.app.vault.createFolder(acc).catch(() => {});
      }
    }
  }

  private uniquifyPath(folder: string, base: string, ext: string): string {
    const suffix = ext.length > 0 ? `.${ext}` : "";
    let candidate = `${base}${suffix}`;
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(`${folder}/${candidate}`)) {
      candidate = `${base} ${n}${suffix}`;
      n += 1;
    }
    return `${folder}/${candidate}`;
  }

  private backToGrid(): void {
    this.releasePendingObjectUrl();
    const key = this.originKey;
    this.pendingSource = null;
    this.marquee = null;
    this.commitEnabled = false;
    this.dragState = null;
    this.stage = "grid";
    this.renderGridStage(false);
    this.refocusCell(key);
  }

  private refocusCell(key: string | null): void {
    if (!key) return;
    const cells = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".pc-portrait-picker-cell"));
    cells.find((c) => c.dataset.portraitKey === key)?.focus();
  }

  private releasePendingObjectUrl(): void {
    if (this.pendingSource?.kind === "import") {
      URL.revokeObjectURL(this.pendingSource.url);
    }
  }
}
