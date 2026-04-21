import { App, Modal, Notice, Setting } from "obsidian";
import { Compendium, CompendiumManager } from "./compendium-manager";

const NEW_COMPENDIUM_KEY = "__new_compendium__";

// ---------------------------------------------------------------------------
// CreateCompendiumModal
// ---------------------------------------------------------------------------

/**
 * Modal that prompts for a name and creates a new writable compendium.
 * After creation, calls onCreated with the new Compendium.
 */
export class CreateCompendiumModal extends Modal {
  private manager: CompendiumManager;
  private onCreated: (compendium: Compendium) => void;
  private compName = "";
  private description = "";

  constructor(
    app: App,
    manager: CompendiumManager,
    onCreated: (compendium: Compendium) => void,
  ) {
    super(app);
    this.manager = manager;
    this.onCreated = onCreated;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: "New Compendium" });
    contentEl.createEl("p", {
      text: "Create a new compendium to store your homebrew entities.",
    });

    new Setting(contentEl).setName("Name").addText((text) => {
      text.setPlaceholder("e.g. Homebrew, Campaign Notes");
      text.onChange((value) => { this.compName = value; });
    });

    new Setting(contentEl).setName("Description").addText((text) => {
      text.setPlaceholder("Optional description");
      text.onChange((value) => { this.description = value; });
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Create")
          .setCta()
          .onClick(async () => {
            const name = this.compName.trim();
            if (!name) {
              new Notice("Compendium name is required.");
              return;
            }
            try {
              const comp = await this.manager.create(
                name,
                this.description.trim() || `${name} compendium`,
                true,  // homebrew
                false, // writable
              );
              new Notice(`Created compendium: ${name}`);
              this.close();
              this.onCreated(comp);
            } catch (e: unknown) {
              new Notice(`Failed to create: ${e instanceof Error ? e.message : String(e)}`);
            }
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// CompendiumSelectModal
// ---------------------------------------------------------------------------

/**
 * Modal that presents a dropdown of compendiums and lets the user pick one.
 * Includes a "+ New Compendium" option that opens CreateCompendiumModal.
 */
export class CompendiumSelectModal extends Modal {
  private compendiums: Compendium[];
  private onSelect: (compendium: Compendium) => void;
  private selected: Compendium | null;
  private manager: CompendiumManager | null;

  constructor(
    app: App,
    compendiums: Compendium[],
    onSelect: (compendium: Compendium) => void,
    manager?: CompendiumManager,
  ) {
    super(app);
    this.compendiums = compendiums;
    this.onSelect = onSelect;
    this.selected = compendiums.length > 0 ? compendiums[0] : null;
    this.manager = manager ?? null;
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
      if (this.manager) {
        dropdown.addOption(NEW_COMPENDIUM_KEY, "+ New Compendium...");
      }
      if (this.selected) {
        dropdown.setValue(this.selected.name);
      }
      dropdown.onChange((value) => {
        if (value === NEW_COMPENDIUM_KEY) {
          this.close();
          new CreateCompendiumModal(this.app, this.manager!, (comp) => {
            this.onSelect(comp);
          }).open();
          return;
        }
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
            if (this.selected) {
              this.onSelect(this.selected);
              this.close();
            }
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
 * Includes a "+ New Compendium" option that opens CreateCompendiumModal.
 */
export class SaveAsNewModal extends Modal {
  private compendiums: Compendium[];
  private entityName: string;
  private onSave: (compendium: Compendium, name: string) => void;
  private selected: Compendium | null;
  private manager: CompendiumManager | null;

  constructor(
    app: App,
    compendiums: Compendium[],
    defaultName: string,
    onSave: (compendium: Compendium, name: string) => void,
    manager?: CompendiumManager,
  ) {
    super(app);
    this.compendiums = compendiums;
    this.entityName = defaultName;
    this.onSave = onSave;
    this.selected = compendiums.length > 0 ? compendiums[0] : null;
    this.manager = manager ?? null;
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
      if (this.manager) {
        dropdown.addOption(NEW_COMPENDIUM_KEY, "+ New Compendium...");
      }
      if (this.selected) {
        dropdown.setValue(this.selected.name);
      }
      dropdown.onChange((value) => {
        if (value === NEW_COMPENDIUM_KEY) {
          this.close();
          new CreateCompendiumModal(this.app, this.manager!, (comp) => {
            this.onSave(comp, this.entityName.trim());
          }).open();
          return;
        }
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
            if (!this.entityName.trim() || !this.selected) return;
            this.onSave(this.selected, this.entityName.trim());
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
