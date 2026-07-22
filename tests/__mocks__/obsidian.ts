export function setIcon() {}
export function setTooltip(el: HTMLElement, tooltip: string) {
  if (el && tooltip != null) el.setAttribute("aria-label", tooltip);
}
export class Notice {
  constructor(_message: string) {}
}
export class Modal {
  app: unknown;
  contentEl: HTMLElement;
  scope = { register: () => {} };
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = document.createElement("div");
    document.body.appendChild(this.contentEl);
  }
  open(): void {
    (this as { onOpen?: () => void }).onOpen?.();
  }
  close(): void {
    (this as { onClose?: () => void }).onClose?.();
  }
}
export class Plugin {}

export class PluginSettingTab {
  app: unknown;
  containerEl: HTMLElement;
  constructor(app: unknown, _plugin: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }
  display(): void {}
  hide(): void {}
}

/** Structural ToggleComponent mock: `.checkbox-container` host div (matching
 *  Obsidian's DOM), `.is-enabled` tracks the value, click flips + fires
 *  onChange (setValue alone does NOT fire onChange, as in Obsidian). */
export class ToggleComponent {
  toggleEl: HTMLElement;
  private value = false;
  private changeCb: ((value: boolean) => unknown) | null = null;
  constructor(containerEl: HTMLElement) {
    this.toggleEl = document.createElement("div");
    this.toggleEl.classList.add("checkbox-container");
    containerEl.appendChild(this.toggleEl);
    this.toggleEl.addEventListener("click", () => {
      this.setValue(!this.value);
      this.changeCb?.(this.value);
    });
  }
  getValue(): boolean {
    return this.value;
  }
  setValue(value: boolean): this {
    this.value = value;
    this.toggleEl.classList.toggle("is-enabled", value);
    return this;
  }
  setTooltip(tooltip: string): this {
    this.toggleEl.setAttribute("aria-label", tooltip);
    return this;
  }
  onChange(cb: (value: boolean) => unknown): this {
    this.changeCb = cb;
    return this;
  }
}

interface TextComponentMock {
  inputEl: HTMLInputElement;
  setPlaceholder(v: string): TextComponentMock;
  setValue(v: string): TextComponentMock;
  onChange(cb: (value: string) => unknown): TextComponentMock;
}

/** Structural Setting mock mirroring Obsidian's settings-row DOM:
 *  .setting-item > (.setting-item-info > .setting-item-name/.setting-item-description)
 *  + .setting-item-control hosting the components. */
export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.classList.add("setting-item");
    this.infoEl = document.createElement("div");
    this.infoEl.classList.add("setting-item-info");
    this.nameEl = document.createElement("div");
    this.nameEl.classList.add("setting-item-name");
    this.descEl = document.createElement("div");
    this.descEl.classList.add("setting-item-description");
    this.controlEl = document.createElement("div");
    this.controlEl.classList.add("setting-item-control");
    this.infoEl.append(this.nameEl, this.descEl);
    this.settingEl.append(this.infoEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }
  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }
  setDesc(desc: string): this {
    this.descEl.textContent = desc;
    return this;
  }
  setHeading(): this {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }
  addToggle(cb: (toggle: ToggleComponent) => unknown): this {
    cb(new ToggleComponent(this.controlEl));
    return this;
  }
  addText(cb: (text: TextComponentMock) => unknown): this {
    const inputEl = document.createElement("input");
    this.controlEl.appendChild(inputEl);
    const comp: TextComponentMock = {
      inputEl,
      setPlaceholder(v: string) {
        inputEl.placeholder = v;
        return comp;
      },
      setValue(v: string) {
        inputEl.value = v ?? "";
        return comp;
      },
      onChange(fn: (value: string) => unknown) {
        inputEl.addEventListener("input", () => fn(inputEl.value));
        return comp;
      },
    };
    cb(comp);
    return this;
  }
}
export class Component {
  load() {}
  unload() {}
  onload() {}
  onunload() {}
  addChild<T>(child: T): T {
    return child;
  }
  removeChild<T>(child: T): T {
    return child;
  }
  register(_cb: () => void) {}
  registerEvent(_eventRef: unknown) {}
  registerDomEvent(_el: unknown, _type: string, _cb: unknown) {}
  registerInterval(_id: number) {}
}
export class MarkdownRenderer {
  static renderMarkdown(source: string, el: HTMLElement, _sourcePath: string, _component: unknown) {
    el.textContent = source;
  }
  static render(_app: unknown, source: string, el: HTMLElement, _sourcePath: string, _component: unknown) {
    el.textContent = source;
  }
}
export class EditorSuggest {}

export class TAbstractFile {
  name = "";
  path = "";
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  extension = "";
  basename = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
  _content = "";
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.parent === null;
  }
}

export class FileSystemAdapter {
  getBasePath(): string {
    return "";
  }
}

export const Platform = {
  isMacOS: false,
  isWin: false,
  isLinux: true,
  isMobile: false,
  isDesktop: true,
};

export class WorkspaceLeaf {
  view: ItemView | null = null;
  lastSetViewState: { type: string; state?: unknown; active?: boolean } | null = null;
  async setViewState(state: { type: string; state?: unknown; active?: boolean }): Promise<void> {
    this.lastSetViewState = state;
  }
  getRoot(): unknown {
    return null;
  }
}

export class ItemView extends Component {
  leaf: WorkspaceLeaf;
  contentEl: HTMLElement;
  containerEl: HTMLElement;
  app: { workspace: { getLeaf: (f: TFile | null) => WorkspaceLeaf } } = {
    workspace: { getLeaf: () => this.leaf },
  };
  file: TFile | null = null;
  actions: Array<{ icon: string; title: string; callback: () => void }> = [];
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.contentEl = document.createElement("div");
    this.containerEl = document.createElement("div");
  }
  getViewType(): string {
    return "item";
  }
  getIcon(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  addAction(icon: string, title: string, callback: () => void) {
    this.actions.push({ icon, title, callback });
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class TextFileView extends ItemView {
  data = "";
  allowNoFile = false;
  async setViewData(_data: string, _clear: boolean): Promise<void> {}
  getViewData(): string {
    return this.data;
  }
  clear(): void {}
  async onLoadFile(file: TFile): Promise<void> {
    this.file = file;
  }
  async onUnloadFile(_file: TFile): Promise<void> {
    this.file = null;
  }
  requestSave(): void {}
}
