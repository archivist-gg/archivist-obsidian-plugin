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
