import { ItemView, WorkspaceLeaf } from "obsidian";
import { createOwlIcon } from "./components/owl-icon";

export const VIEW_TYPE_INQUIRY = "archivist-inquiry-view";

export class InquiryView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_INQUIRY; }
  getDisplayText(): string { return "Archivist Inquiry"; }
  getIcon(): string { return "bot"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("archivist-inquiry-container");

    // Welcome state placeholder
    const welcome = container.createDiv({ cls: "archivist-inquiry-welcome" });
    welcome.appendChild(createOwlIcon(32));
    welcome.createDiv({ cls: "archivist-inquiry-welcome-title", text: "Good evening" });
    welcome.createDiv({ cls: "archivist-inquiry-welcome-subtitle", text: "What knowledge do you seek?" });
  }

  async onClose(): Promise<void> {}
}
