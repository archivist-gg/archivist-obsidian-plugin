import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchivistPlugin from "../main";

export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPlugin;

  constructor(app: App, plugin: ArchivistPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Archivist Inquiry" });

    new Setting(containerEl)
      .setName("TTRPG Root Directory")
      .setDesc("Scope AI vault access to this directory. Leave as / for entire vault.")
      .addText((text) =>
        text.setPlaceholder("/").setValue(this.plugin.settings.ttrpgRootDir)
          .onChange(async (value) => { this.plugin.settings.ttrpgRootDir = value || "/"; await this.plugin.saveSettings(); }),
      );

    new Setting(containerEl)
      .setName("Permission Mode")
      .setDesc("Auto: auto-approve tool calls. Safe: require approval for writes.")
      .addDropdown((dropdown) =>
        dropdown.addOption("safe", "Safe").addOption("auto", "Auto")
          .setValue(this.plugin.settings.permissionMode)
          .onChange(async (value) => { this.plugin.settings.permissionMode = value as "auto" | "safe"; await this.plugin.saveSettings(); }),
      );

    new Setting(containerEl)
      .setName("Default Model")
      .setDesc("Model used for new conversations.")
      .addDropdown((dropdown) =>
        dropdown.addOption("claude-sonnet-4-6", "Sonnet 4").addOption("claude-opus-4-6", "Opus 4").addOption("claude-haiku-4-5-20251001", "Haiku 4")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => { this.plugin.settings.defaultModel = value; await this.plugin.saveSettings(); }),
      );

    new Setting(containerEl)
      .setName("Max Conversations")
      .setDesc("Maximum stored conversations. Oldest auto-deleted when exceeded.")
      .addText((text) =>
        text.setPlaceholder("50").setValue(String(this.plugin.settings.maxConversations))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) { this.plugin.settings.maxConversations = num; await this.plugin.saveSettings(); }
          }),
      );

    // Entity Compendium
    containerEl.createEl("h3", { text: "Entity Compendium" });

    new Setting(containerEl)
      .setName("Compendium Root Folder")
      .setDesc("Root vault folder where entity notes are stored.")
      .addText((text) =>
        text.setPlaceholder("Compendium").setValue(this.plugin.settings.compendiumRoot)
          .onChange(async (value) => { this.plugin.settings.compendiumRoot = value || "Compendium"; await this.plugin.saveSettings(); }),
      );

    new Setting(containerEl)
      .setName("User Entity Folder")
      .setDesc("Subfolder name for user-created and AI-generated entities.")
      .addText((text) =>
        text.setPlaceholder("me").setValue(this.plugin.settings.userEntityFolder)
          .onChange(async (value) => { this.plugin.settings.userEntityFolder = value || "me"; await this.plugin.saveSettings(); }),
      );

    // External Context Directories
    containerEl.createEl("h3", { text: "External Context Directories" });
    containerEl.createEl("p", {
      text: "Additional directories the AI can access for reference material.",
      cls: "setting-item-description",
    });

    this.renderExternalContextPaths(containerEl);
  }

  private renderExternalContextPaths(containerEl: HTMLElement): void {
    // Remove old list if re-rendering
    const oldList = containerEl.querySelector(".archivist-external-paths");
    if (oldList) oldList.remove();

    const wrapper = containerEl.createDiv({ cls: "archivist-external-paths" });
    const paths = this.plugin.settings.externalContextPaths;

    // Existing paths
    for (const path of paths) {
      const row = wrapper.createDiv({ cls: "archivist-external-path-row" });
      row.createSpan({ text: path, cls: "archivist-external-path-text" });
      const removeBtn = row.createEl("button", { text: "Remove", cls: "archivist-external-path-remove" });
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.externalContextPaths = this.plugin.settings.externalContextPaths.filter((p) => p !== path);
        await this.plugin.saveSettings();
        this.renderExternalContextPaths(containerEl);
      });
    }

    // Add new path
    const addRow = wrapper.createDiv({ cls: "archivist-external-path-add-row" });
    const input = addRow.createEl("input", {
      type: "text",
      placeholder: "/absolute/path/to/directory",
      cls: "archivist-external-path-input",
    });
    const addBtn = addRow.createEl("button", { text: "Add", cls: "archivist-external-path-add-btn" });

    const addPath = async () => {
      const value = input.value.trim();
      if (!value) return;
      if (this.plugin.settings.externalContextPaths.includes(value)) {
        input.value = "";
        return;
      }
      this.plugin.settings.externalContextPaths.push(value);
      await this.plugin.saveSettings();
      input.value = "";
      this.renderExternalContextPaths(containerEl);
    };

    addBtn.addEventListener("click", addPath);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPath();
      }
    });
  }
}
