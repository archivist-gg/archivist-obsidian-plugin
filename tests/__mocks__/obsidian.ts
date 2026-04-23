export function setIcon() {}
export class Notice {
  constructor(_message: string) {}
}
export class Modal {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
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
