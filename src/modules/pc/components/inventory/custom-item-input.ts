export interface CustomItemInputOpts {
  onAdd: (text: string) => void;
}

export function renderCustomItemInput(parent: HTMLElement, opts: CustomItemInputOpts): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-inv-custom-input" });
  wrap.createSpan({ cls: "pc-inv-custom-label", text: "Custom" });
  const input = wrap.createEl("input", {
    type: "text",
    attr: { placeholder: "'50 ft of hempen rope' (no compendium entry)" },
  });
  const btn = wrap.createEl("button", { text: "Add" });

  const tryAdd = () => {
    const v = input.value.trim();
    if (v.length === 0) return;
    opts.onAdd(v);
    input.value = "";
  };

  btn.addEventListener("click", tryAdd);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryAdd();
    }
  });

  return wrap;
}
