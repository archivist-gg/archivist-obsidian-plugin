import type { ComponentRenderContext } from "../component.types";

// CharacterEditState survives sheet re-renders; the action-row DOM does not.
const openPickerByEditState = new WeakMap<object, string>();

/** Spend one ordinary spell slot from an action row, using the Spells tab's writer. */
export function renderSlotSpendControl(parent: HTMLElement, ctx: ComponentRenderContext, controlKey: string): boolean {
  const levels = Array.from({ length: 9 }, (_, index) => index + 1)
    .map((level) => ({
      level,
      total: ctx.resolved.definition.overrides.spell_slots?.[level] ?? ctx.derived.derivedSpellSlots?.[level] ?? 0,
      used: ctx.resolved.state.spell_slots?.[level]?.used ?? 0,
    }))
    .filter(({ total }) => total > 0);
  if (!levels.length) return false;

  const anchor = parent.createDiv({ cls: "pc-spend pc-slot-pop-anchor" });
  const trigger = anchor.createEl("button", {
    cls: "pc-spend-control pc-slot-picker-trigger",
    text: "Spend 1 slot ▾",
    attr: { type: "button", "aria-expanded": "false", "aria-label": "Choose a spell slot to spend" },
  });
  trigger.disabled = !ctx.editState || levels.every(({ total, used }) => used >= total);
  let pop: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  const doc = anchor.ownerDocument;
  const close = (forgetOpen = true) => {
    pop?.remove();
    pop = null;
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    doc.removeEventListener("pointerdown", outside);
    doc.removeEventListener("keydown", escape);
    observer?.disconnect();
    observer = null;
    if (forgetOpen && ctx.editState && openPickerByEditState.get(ctx.editState) === controlKey) {
      openPickerByEditState.delete(ctx.editState);
    }
  };
  const outside = (event: Event) => {
    if (!anchor.contains(event.target as Node)) close();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  const open = () => {
    if (pop) return;
    if (ctx.editState) openPickerByEditState.set(ctx.editState, controlKey);
    pop = anchor.createDiv({ cls: "pc-pop pc-slot-pop" });
    pop.createSpan({ cls: "pc-pop-arrow" });
    pop.createDiv({ cls: "pc-pop-h", text: "Choose a spell slot" });
    const list = pop.createDiv({ cls: "pc-slot-pop-list" });
    for (const slot of levels) {
      const { level, total } = slot;
      const row = list.createEl("button", {
        cls: "pc-slot-pop-row",
        attr: { type: "button" },
      });
      row.createSpan({ cls: "pc-slot-pop-level", text: `${ordinal(level)} level` });
      const boxes = row.createSpan({ cls: "pc-charge-boxes" }).createSpan({ cls: "archivist-toggle-box-row" });
      const pips = Array.from({ length: total }, () => boxes.createSpan({ cls: "archivist-toggle-box" }));
      const count = row.createSpan({ cls: "pc-slot-pop-count" });
      const update = () => {
        const remaining = Math.max(0, total - slot.used);
        row.disabled = remaining === 0;
        row.setAttribute("aria-label", `Spend a ${ordinal(level)}-level spell slot (${remaining} of ${total} available)`);
        pips.forEach((pip, i) => pip.classList.toggle("archivist-toggle-box-checked", i < slot.used));
        count.textContent = `${remaining}/${total}`;
      };
      update();
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (slot.used >= total) return;
        ctx.editState?.expendSlot(level);
        // The real writer re-renders the sheet synchronously. In isolated uses,
        // update this still-connected picker without closing it.
        if (anchor.isConnected) {
          slot.used += 1;
          update();
          trigger.disabled = levels.every(({ total, used }) => used >= total);
        }
      });
    }
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    // Prefer the approved upward overlay; flip down when the sheet offers more room there.
    const sheet = anchor.closest<HTMLElement>(".archivist-pc-sheet");
    if (sheet) {
      const bounds = sheet.getBoundingClientRect();
      const target = trigger.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        pop.style.width = `${Math.min(292, Math.max(0, bounds.width - 16))}px`;
        const desired = pop.getBoundingClientRect();
        const above = target.top - bounds.top - 12;
        const below = bounds.bottom - target.bottom - 12;
        const down = above < desired.height && below > above;
        pop.classList.toggle("opens-down", down);
        list.style.maxHeight = `${Math.max(0, (down ? below : above) - 35)}px`;
        pop.style.left = `${Math.max(bounds.left + 8, Math.min(target.right - desired.width + 7, bounds.right - desired.width - 8)) - anchor.getBoundingClientRect().left}px`;
      }
    }
    doc.addEventListener("pointerdown", outside);
    doc.addEventListener("keydown", escape);
    const Observer = doc.defaultView?.MutationObserver;
    if (Observer) {
      // A re-render removes this anchor, but the new anchor inherits the open key.
      observer = new Observer(() => { if (!anchor.isConnected) close(false); });
      observer.observe(doc, { childList: true, subtree: true });
    }
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (pop) close(); else open();
  });
  if (ctx.editState && openPickerByEditState.get(ctx.editState) === controlKey) {
    queueMicrotask(() => { if (anchor.isConnected) open(); });
  }
  return true;
}

function ordinal(level: number): string {
  if (level === 1) return "1st";
  if (level === 2) return "2nd";
  if (level === 3) return "3rd";
  return `${level}th`;
}
