/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { PortraitPickerModal } from "../packages/obsidian/src/modules/pc/components/portrait-picker-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { TFile } from "obsidian";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function img(path: string, ext: string): TFile {
  const f = new TFile();
  f.path = path;
  f.name = path.split("/").pop()!;
  f.extension = ext;
  return f;
}
function mockApp(files: TFile[]) {
  return {
    vault: {
      getFiles: () => files,
      getResourcePath: (f: TFile) => `app://res/${f.path}`,
      getAbstractFileByPath: vi.fn(() => null),
      createFolder: vi.fn(async () => undefined),
      createBinary: vi.fn(async (path: string) => img(path, path.split(".").pop()!)),
    },
  };
}
const pcFile = img("PlayerCharacters/Test.md", "md");
const VAULT_FILES = [
  img("PlayerCharacters/Portraits/baelor.png", "png"),
  img("PlayerCharacters/Portraits/zed.jpg", "jpg"),
  img("Art/elsewhere.png", "png"),
  img("notes/n.md", "md"),
];

function open(opts?: Partial<ConstructorParameters<typeof PortraitPickerModal>[1]>, files?: TFile[]) {
  const app = mockApp(files ?? VAULT_FILES);
  const modal = new PortraitPickerModal(app as never, {
    pcFile,
    hasPortrait: false,
    portraitsFolder: "PlayerCharacters/Portraits",
    isCurrentFile: () => true,
    onPick: vi.fn(),
    onRemove: vi.fn(),
    ...opts,
  } as never);
  modal.open();
  return { modal, el: (modal as unknown as { contentEl: HTMLElement }).contentEl, app };
}
const cells = (el: HTMLElement) => [
  ...el.querySelectorAll("button.pc-portrait-picker-cell:not(.pc-portrait-picker-import)"),
];

describe("PortraitPickerModal grid stage", () => {
  it("scopes to the portraits folder by default; import tile is first", () => {
    const { el } = open();
    const all = [...el.querySelectorAll("button.pc-portrait-picker-cell")];
    expect(all[0].classList.contains("pc-portrait-picker-import")).toBe(true);
    expect(all[0].getAttribute("aria-label")).toBe("Import image from computer");
    expect(cells(el).map((c) => c.getAttribute("aria-label"))).toEqual([
      "Choose baelor.png",
      "Choose zed.jpg",
    ]);
  });
  it("show-all checkbox reveals the whole vault (images only)", () => {
    const { el } = open();
    (el.querySelector(".pc-portrait-picker-check input") as HTMLInputElement).click();
    expect(cells(el).length).toBe(3);
    expect(el.textContent).toContain("elsewhere.png");
  });
  it("search filters the ACTIVE scope after the 150ms debounce", () => {
    const { el } = open();
    const input = el.querySelector("input.pc-portrait-picker-search") as HTMLInputElement;
    input.value = "zed";
    input.dispatchEvent(new Event("input"));
    expect(cells(el).length).toBe(2); // not yet (debounced)
    vi.advanceTimersByTime(160);
    expect(cells(el).length).toBe(1);
    expect(el.textContent).toContain("zed.jpg");
    expect(el.querySelector(".pc-portrait-picker-import")).toBeTruthy(); // tile never filtered
  });
  it("caps AFTER the search filter with the hint row", () => {
    const many = Array.from({ length: 230 }, (_, i) => img(`Art/x${String(i).padStart(3, "0")}.png`, "png"));
    const { el } = open({}, many);
    (el.querySelector(".pc-portrait-picker-check input") as HTMLInputElement).click();
    expect(cells(el).length).toBe(200);
    expect(el.textContent).toContain("More images match. Refine your search.");
  });
  it("empty scoped state hints at the checkbox", () => {
    const { el } = open({}, [img("Art/only.png", "png")]);
    expect(el.textContent).toContain("No images in PlayerCharacters/Portraits yet.");
    expect(el.textContent).toContain("Show all vault images");
  });
  it("Remove appears in the footer only when hasPortrait, and fires onRemove", () => {
    const none = open();
    expect(none.el.querySelector(".pc-portrait-picker-remove")).toBeNull();
    const onRemove = vi.fn();
    const { el } = open({ hasPortrait: true, onRemove });
    (el.querySelector(".pc-portrait-picker-remove") as HTMLElement).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
  it("search input carries the parchment class (styling hook)", () => {
    const { el } = open();
    expect(el.querySelector("input.pc-portrait-picker-search")).toBeTruthy();
  });
  it("caches the candidate list per scope state; search doesn't re-derive it from the vault", () => {
    const files = [img("PlayerCharacters/Portraits/baelor.png", "png")];
    const { el } = open({}, files);
    expect(cells(el).length).toBe(1);
    files.push(img("PlayerCharacters/Portraits/new.png", "png")); // vault "changes" post-open
    const input = el.querySelector("input.pc-portrait-picker-search") as HTMLInputElement;
    input.value = "png";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(160);
    expect(cells(el).length).toBe(1); // still the cached list, not re-fetched
  });
  it("a search that empties a non-empty scope shows the generic no-match text, not the show-all hint", () => {
    const { el } = open();
    const input = el.querySelector("input.pc-portrait-picker-search") as HTMLInputElement;
    input.value = "nonexistent";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(160);
    expect(el.textContent).toContain("No images match.");
    expect(el.textContent).not.toContain("Tick 'Show all vault images'");
  });
});

describe("PortraitPickerModal crop stage", () => {
  it("cell click swaps to the crop stage; commit disabled before image load", () => {
    const { el } = open();
    (cells(el)[0] as HTMLElement).click();
    expect(el.querySelector(".pc-portrait-crop-img")).toBeTruthy();
    const use = [...el.querySelectorAll("button")].find((b) => b.textContent === "Use this framing")!;
    expect((use as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector(".pc-portrait-picker-grid")).toBeNull();
  });
  it("Back returns to the grid without committing", () => {
    const onPick = vi.fn();
    const { el } = open({ onPick });
    (cells(el)[0] as HTMLElement).click();
    ([...el.querySelectorAll("button")].find((b) => b.textContent === "Back") as HTMLElement).click();
    expect(el.querySelector(".pc-portrait-picker-grid")).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });
  it("import defers createBinary: nothing written on Back", async () => {
    const { el, app } = open();
    const fi = el.querySelector("input[type='file']") as HTMLInputElement;
    expect(fi.getAttribute("accept")).toBe(".png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp");
    const file = new File([new Uint8Array([1])], "new.png", { type: "image/png" });
    Object.defineProperty(fi, "files", { value: [file] });
    fi.dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(10);
    expect(el.querySelector(".pc-portrait-crop-img")).toBeTruthy();
    ([...el.querySelectorAll("button")].find((b) => b.textContent === "Back") as HTMLElement).click();
    expect(app.vault.createBinary).not.toHaveBeenCalled();
  });
  it("isCurrentFile=false blocks a vault-pick commit", async () => {
    const onPick = vi.fn();
    const { el } = open({ onPick, isCurrentFile: () => false });
    (cells(el)[0] as HTMLElement).click();
    const im = el.querySelector(".pc-portrait-crop-img") as HTMLImageElement;
    Object.defineProperty(im, "naturalWidth", { value: 100 });
    Object.defineProperty(im, "naturalHeight", { value: 100 });
    im.dispatchEvent(new Event("load"));
    const use = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "Use this framing",
    ) as HTMLButtonElement;
    use.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(onPick).not.toHaveBeenCalled();
  });
  it("default framing commits crop=null (cover)", async () => {
    const onPick = vi.fn();
    const { el } = open({ onPick });
    (cells(el)[0] as HTMLElement).click();
    const im = el.querySelector(".pc-portrait-crop-img") as HTMLImageElement;
    Object.defineProperty(im, "naturalWidth", { value: 100 });
    Object.defineProperty(im, "naturalHeight", { value: 100 });
    im.dispatchEvent(new Event("load"));
    const use = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "Use this framing",
    ) as HTMLButtonElement;
    expect(use.disabled).toBe(false);
    use.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].path).toBe("PlayerCharacters/Portraits/baelor.png");
    expect(onPick.mock.calls[0][1]).toBeNull();
  });
  it("import commit creates the binary in the portraits folder and picks it", async () => {
    const onPick = vi.fn();
    const { el, app } = open({ onPick });
    const fi = el.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File([new Uint8Array([1])], "new.png", { type: "image/png" });
    Object.defineProperty(fi, "files", { value: [file] });
    fi.dispatchEvent(new Event("change"));
    await vi.advanceTimersByTimeAsync(10);
    const im = el.querySelector(".pc-portrait-crop-img") as HTMLImageElement;
    Object.defineProperty(im, "naturalWidth", { value: 100 });
    Object.defineProperty(im, "naturalHeight", { value: 100 });
    im.dispatchEvent(new Event("load"));
    (
      [...el.querySelectorAll("button")].find((b) => b.textContent === "Use this framing") as HTMLButtonElement
    ).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(app.vault.createBinary).toHaveBeenCalledTimes(1);
    expect(app.vault.createBinary.mock.calls[0][0]).toBe("PlayerCharacters/Portraits/new.png");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].path).toBe("PlayerCharacters/Portraits/new.png");
  });
});
