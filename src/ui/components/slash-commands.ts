import { setIcon } from "obsidian";

interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  action: string;
}

const COMMANDS: SlashCommand[] = [
  { name: "compact", description: "Compact conversation to free context", icon: "minimize-2", action: "compact" },
  { name: "clear", description: "Clear conversation history", icon: "trash-2", action: "clear" },
  { name: "help", description: "Show available commands and shortcuts", icon: "help-circle", action: "help" },
  { name: "model", description: "Cycle through AI models", icon: "cpu", action: "model" },
  { name: "export", description: "Copy conversation as markdown", icon: "download", action: "export" },
];

export class SlashCommandDropdown {
  private dropdown: HTMLElement | null = null;
  private items: HTMLElement[] = [];
  private activeIndex = 0;
  private filteredCommands: SlashCommand[] = [];

  constructor(
    private textarea: HTMLTextAreaElement,
    private container: HTMLElement,
    private onExecute: (action: string) => void,
  ) {
    this.textarea.addEventListener("input", () => this.check());
    this.textarea.addEventListener("keydown", (e) => this.onKeydown(e));
    document.addEventListener("click", (e) => {
      if (this.dropdown && !this.container.contains(e.target as Node)) this.hide();
    });
  }

  private check(): void {
    const val = this.textarea.value;
    if (!val.startsWith("/")) { this.hide(); return; }

    const query = val.slice(1).toLowerCase();
    this.filteredCommands = COMMANDS.filter(c => c.name.includes(query));

    if (this.filteredCommands.length === 0) { this.hide(); return; }
    this.show();
  }

  private show(): void {
    this.hide();
    this.dropdown = this.container.createDiv({ cls: "archivist-inquiry-slash-dropdown" });
    this.items = [];
    this.activeIndex = 0;

    for (let i = 0; i < this.filteredCommands.length; i++) {
      const cmd = this.filteredCommands[i];
      const item = this.dropdown.createDiv({ cls: "archivist-inquiry-slash-item" });
      const iconEl = item.createSpan({ cls: "archivist-inquiry-slash-item-icon" });
      setIcon(iconEl, cmd.icon);
      const textEl = item.createDiv({ cls: "archivist-inquiry-slash-item-text" });
      textEl.createSpan({ cls: "archivist-inquiry-slash-item-name", text: "/" + cmd.name });
      textEl.createSpan({ cls: "archivist-inquiry-slash-item-desc", text: cmd.description });

      if (i === 0) item.addClass("archivist-inquiry-slash-item-active");

      const idx = i;
      item.addEventListener("click", (e) => { e.stopPropagation(); this.select(idx); });
      item.addEventListener("mouseenter", () => this.setActive(idx));
      this.items.push(item);
    }
  }

  private hide(): void {
    if (this.dropdown) { this.dropdown.remove(); this.dropdown = null; }
    this.items = [];
    this.activeIndex = 0;
  }

  private setActive(idx: number): void {
    if (this.items[this.activeIndex]) this.items[this.activeIndex].removeClass("archivist-inquiry-slash-item-active");
    this.activeIndex = idx;
    if (this.items[idx]) this.items[idx].addClass("archivist-inquiry-slash-item-active");
  }

  private select(idx: number): void {
    const cmd = this.filteredCommands[idx];
    if (!cmd) return;
    this.textarea.value = "";
    this.hide();
    this.onExecute(cmd.action);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setActive(Math.min(this.activeIndex + 1, this.items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setActive(Math.max(this.activeIndex - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (this.filteredCommands.length > 0) {
        e.preventDefault();
        this.select(this.activeIndex);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    }
  }

  destroy(): void {
    this.hide();
  }
}
