import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ArchivistSettings } from "../types/settings";

// TODO(task-17): replace with direct import of ArchivistPlugin once settings/saveSettings are added
interface ArchivistPluginLike extends Plugin {
  settings: ArchivistSettings;
  saveSettings(): Promise<void>;
}

export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPluginLike;

  constructor(app: App, plugin: ArchivistPluginLike) {
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
  }
}
