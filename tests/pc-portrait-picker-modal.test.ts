/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { PortraitPickerModal } from "../packages/obsidian/src/modules/pc/components/portrait-picker-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { TFile } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

function img(path: string, ext: string): TFile {
  const f = new TFile();
  f.path = path; f.name = path.split("/").pop()!; f.extension = ext;
  return f;
}
function mockApp(files: TFile[]) {
  return {
    vault: {
      getFiles: () => files,
      getResourcePath: (f: TFile) => `app://res/${f.path}`,
      createBinary: vi.fn(async (path: string) => img(path, path.split(".").pop()!)),
    },
    fileManager: {
      getAvailablePathForAttachment: vi.fn(async (name: string) => `attachments/${name}`),
    },
  };
}
const pcFile = img("PlayerCharacters/Test.md", "md");

function open(opts?: Partial<ConstructorParameters<typeof PortraitPickerModal>[1]>, files?: TFile[]) {
  const app = mockApp(files ?? [img("Art/a.png", "png"), img("Art/B.JPG", "JPG"), img("notes/n.md", "md")]);
  const modal = new PortraitPickerModal(app as never, {
    pcFile, hasPortrait: false, isCurrentFile: () => true,
    onPick: vi.fn(), onRemove: vi.fn(), ...opts,
  } as never);
  modal.open();
  return { modal, el: (modal as unknown as { contentEl: HTMLElement }).contentEl, app };
}

describe("PortraitPickerModal", () => {
  it("lists only image files (case-insensitive ext), sorted, with thumbs", () => {
    const { el } = open();
    const rows = el.querySelectorAll(".pc-portrait-picker-row");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Art/B.JPG");
    expect(rows[1].textContent).toContain("Art/a.png");
    expect(rows[1].querySelector("img")!.getAttribute("src")).toBe("app://res/Art/a.png");
  });
  it("pins Import always; Remove only when hasPortrait", () => {
    const a = open();
    expect(a.el.textContent).toContain("Import from computer...");
    expect(a.el.textContent).not.toContain("Remove current image");
    const b = open({ hasPortrait: true });
    expect(b.el.textContent).toContain("Remove current image");
  });
  it("search filters the list but never the action rows", () => {
    const { el } = open();
    const input = el.querySelector("input[type='text'], input:not([type='file'])") as HTMLInputElement;
    input.value = "b.jpg";
    input.dispatchEvent(new Event("input"));
    expect(el.querySelectorAll(".pc-portrait-picker-row").length).toBe(1);
    expect(el.textContent).toContain("Import from computer...");
  });
  it("row click calls onPick with the TFile and closes", () => {
    const onPick = vi.fn();
    const { el } = open({ onPick });
    (el.querySelectorAll(".pc-portrait-picker-row")[1] as HTMLElement).click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].path).toBe("Art/a.png");
  });
  it("isCurrentFile=false blocks the write", () => {
    const onPick = vi.fn();
    const { el } = open({ onPick, isCurrentFile: () => false });
    (el.querySelectorAll(".pc-portrait-picker-row")[0] as HTMLElement).click();
    expect(onPick).not.toHaveBeenCalled();
  });
  it("remove row calls onRemove", () => {
    const onRemove = vi.fn();
    const { el } = open({ hasPortrait: true, onRemove });
    const row = Array.from(el.querySelectorAll(".pc-portrait-picker-action"))
      .find((r) => r.textContent!.includes("Remove")) as HTMLElement;
    row.click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
  it("import file input carries the exact accept list, not image/*", () => {
    const { el } = open();
    const fi = el.querySelector("input[type='file']") as HTMLInputElement;
    expect(fi.getAttribute("accept")).toBe(".png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp");
  });
});
