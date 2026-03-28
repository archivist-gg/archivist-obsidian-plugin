import { Setting } from "obsidian";

export function addTextField(
  container: HTMLElement,
  name: string,
  placeholder: string,
  onChange: (value: string) => void,
): Setting {
  return new Setting(container).setName(name).addText((text) =>
    text.setPlaceholder(placeholder).onChange(onChange),
  );
}

export function addDropdown(
  container: HTMLElement,
  name: string,
  options: Record<string, string>,
  onChange: (value: string) => void,
): Setting {
  return new Setting(container).setName(name).addDropdown((dropdown) =>
    dropdown.addOptions(options).onChange(onChange),
  );
}

export function addToggle(
  container: HTMLElement,
  name: string,
  onChange: (value: boolean) => void,
): Setting {
  return new Setting(container).setName(name).addToggle((toggle) =>
    toggle.onChange(onChange),
  );
}

export function addNumberField(
  container: HTMLElement,
  name: string,
  placeholder: string,
  onChange: (value: string) => void,
): Setting {
  return new Setting(container).setName(name).addText((text) => {
    text.setPlaceholder(placeholder).onChange(onChange);
    text.inputEl.type = "number";
  });
}

export function addTextArea(
  container: HTMLElement,
  name: string,
  placeholder: string,
  onChange: (value: string) => void,
): Setting {
  return new Setting(container).setName(name).addTextArea((textarea) =>
    textarea.setPlaceholder(placeholder).onChange(onChange),
  );
}

interface NameTextEntry {
  name: string;
  text: string;
}

export function addRepeatableSection(
  container: HTMLElement,
  sectionName: string,
  entries: NameTextEntry[],
  onUpdate: (entries: NameTextEntry[]) => void,
): void {
  const section = container.createDiv({ cls: "archivist-repeatable-section" });
  const header = section.createDiv({ cls: "archivist-repeatable-header" });
  header.createEl("h4", { text: sectionName });

  const listContainer = section.createDiv({ cls: "archivist-repeatable-list" });

  function renderEntries(): void {
    listContainer.empty();
    for (let i = 0; i < entries.length; i++) {
      const entryDiv = listContainer.createDiv({ cls: "archivist-repeatable-entry" });

      new Setting(entryDiv)
        .setName(`${sectionName} ${i + 1} Name`)
        .addText((text) =>
          text
            .setPlaceholder("Name")
            .setValue(entries[i].name)
            .onChange((val) => {
              entries[i].name = val;
              onUpdate([...entries]);
            }),
        );

      new Setting(entryDiv)
        .setName(`${sectionName} ${i + 1} Text`)
        .addTextArea((textarea) =>
          textarea
            .setPlaceholder("Description...")
            .setValue(entries[i].text)
            .onChange((val) => {
              entries[i].text = val;
              onUpdate([...entries]);
            }),
        );

      new Setting(entryDiv).addButton((btn) =>
        btn
          .setButtonText("Remove")
          .setWarning()
          .onClick(() => {
            entries.splice(i, 1);
            onUpdate([...entries]);
            renderEntries();
          }),
      );
    }
  }

  new Setting(section).addButton((btn) =>
    btn.setButtonText(`Add ${sectionName}`).onClick(() => {
      entries.push({ name: "", text: "" });
      onUpdate([...entries]);
      renderEntries();
    }),
  );

  renderEntries();
}

/**
 * Convert a JS object to a YAML string.
 * Handles strings, numbers, booleans, arrays of strings, and nested objects.
 * Strings containing colons, hashes, or braces are quoted.
 * Arrays of strings render in flow style: [item1, item2].
 */
export function toYamlString(
  obj: Record<string, unknown>,
  indent: number = 0,
): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (typeof value === "boolean") {
      lines.push(`${prefix}${key}: ${value}`);
    } else if (typeof value === "number") {
      lines.push(`${prefix}${key}: ${value}`);
    } else if (typeof value === "string") {
      lines.push(`${prefix}${key}: ${quoteIfNeeded(value)}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;

      // Check if it's an array of plain strings/numbers
      if (value.every((v) => typeof v === "string" || typeof v === "number")) {
        const items = value.map((v) =>
          typeof v === "string" ? quoteIfNeeded(v) : String(v),
        );
        lines.push(`${prefix}${key}: [${items.join(", ")}]`);
      } else {
        // Array of objects
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          if (typeof item === "object" && item !== null) {
            const entries = Object.entries(item as Record<string, unknown>);
            if (entries.length > 0) {
              const [firstKey, firstVal] = entries[0];
              lines.push(
                `${prefix}  - ${firstKey}: ${formatValue(firstVal)}`,
              );
              for (let i = 1; i < entries.length; i++) {
                const [k, v] = entries[i];
                if (v === undefined || v === null || v === "") continue;
                if (Array.isArray(v)) {
                  const items = v.map((item) =>
                    typeof item === "string"
                      ? quoteIfNeeded(item)
                      : String(item),
                  );
                  lines.push(`${prefix}    ${k}: [${items.join(", ")}]`);
                } else {
                  lines.push(`${prefix}    ${k}: ${formatValue(v)}`);
                }
              }
            }
          }
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${prefix}${key}:`);
      const nested = toYamlString(
        value as Record<string, unknown>,
        indent + 1,
      );
      lines.push(nested);
    }
  }

  return lines.join("\n");
}

function needsQuoting(str: string): boolean {
  return /[:#{}[\]]/.test(str);
}

function quoteIfNeeded(str: string): string {
  if (needsQuoting(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return quoteIfNeeded(value);
  return String(value);
}
