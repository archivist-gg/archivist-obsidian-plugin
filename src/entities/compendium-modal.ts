import { App, Modal, Setting } from "obsidian";
import { Compendium } from "./compendium-manager";

// ---------------------------------------------------------------------------
// CompendiumSelectModal
// ---------------------------------------------------------------------------

/**
 * Modal that presents a dropdown of compendiums and lets the user pick one.
 * Used by "Add to Compendium" buttons and chat "Copy & Save" flows.
 */
export class CompendiumSelectModal extends Modal {
  private compendiums: Compendium[];
  private onSelect: (compendium: Compendium) => void;
  private selected: Compendium;

  constructor(
    app: App,
    compendiums: Compendium[],
    onSelect: (compendium: Compendium) => void,
  ) {
    super(app);
    this.compendiums = compendiums;
    this.onSelect = onSelect;
    this.selected = compendiums[0];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: "Select Compendium" });
    contentEl.createEl("p", {
      text: "Choose which compendium to save this entity to.",
    });

    // Compendium dropdown
    new Setting(contentEl).setName("Compendium").addDropdown((dropdown) => {
      for (const comp of this.compendiums) {
        dropdown.addOption(comp.name, `${comp.name} -- ${comp.description}`);
      }
      dropdown.setValue(this.selected.name);
      dropdown.onChange((value) => {
        const found = this.compendiums.find((c) => c.name === value);
        if (found) this.selected = found;
      });
    });

    // Action buttons
    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            this.onSelect(this.selected);
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// SaveAsNewModal
// ---------------------------------------------------------------------------

/**
 * Modal that lets the user name a new entity and pick a target compendium.
 * Used by "Save As New" in edit mode.
 */
export class SaveAsNewModal extends Modal {
  private compendiums: Compendium[];
  private entityName: string;
  private onSave: (compendium: Compendium, name: string) => void;
  private selected: Compendium;

  constructor(
    app: App,
    compendiums: Compendium[],
    defaultName: string,
    onSave: (compendium: Compendium, name: string) => void,
  ) {
    super(app);
    this.compendiums = compendiums;
    this.entityName = defaultName;
    this.onSave = onSave;
    this.selected = compendiums[0];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: "Save As New Entity" });

    // Entity name
    new Setting(contentEl).setName("Name").addText((text) => {
      text.setValue(this.entityName);
      text.setPlaceholder("Entity name");
      text.onChange((value) => {
        this.entityName = value;
      });
    });

    // Compendium dropdown
    new Setting(contentEl).setName("Compendium").addDropdown((dropdown) => {
      for (const comp of this.compendiums) {
        dropdown.addOption(comp.name, `${comp.name} -- ${comp.description}`);
      }
      dropdown.setValue(this.selected.name);
      dropdown.onChange((value) => {
        const found = this.compendiums.find((c) => c.name === value);
        if (found) this.selected = found;
      });
    });

    // Action buttons
    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            if (!this.entityName.trim()) return;
            this.onSave(this.selected, this.entityName.trim());
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
