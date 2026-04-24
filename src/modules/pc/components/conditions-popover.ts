import type { ComponentRenderContext } from "./component.types";
import {
  CONDITION_SLUGS,
  CONDITION_DISPLAY_NAMES,
} from "../constants/conditions";
import { setConditionIcon, setExhaustionIcon } from "../assets/condition-icons";

let current: { root: HTMLElement; cleanup: () => void } | null = null;

export function openConditionsPopover(anchor: HTMLElement, ctx: ComponentRenderContext): void {
  closeConditionsPopover();
  if (!ctx.editState) return;

  const editState = ctx.editState;
  const popover = activeDocument.body.createDiv({ cls: "pc-cond-popover" });

  // Position anchored below the button. position/z-index are defined in CSS;
  // only top/left are dynamic.
  const rect = anchor.getBoundingClientRect();
  popover.style.top = `${rect.bottom + activeWindow.scrollY + 4}px`;
  popover.style.left = `${rect.left + activeWindow.scrollX}px`;

  popover.createDiv({ cls: "pc-cond-popover-header", text: "Conditions" });

  const list = popover.createDiv({ cls: "pc-cond-popover-list" });
  const active = new Set(ctx.resolved.state.conditions);

  for (const slug of CONDITION_SLUGS) {
    const row = list.createDiv({
      cls: "pc-cond-popover-row",
      attr: { "data-slug": slug },
    });
    const iconEl = row.createDiv({ cls: "pc-cond-icon-wrap" });
    setConditionIcon(iconEl, slug);
    row.createDiv({ cls: "pc-cond-name", text: CONDITION_DISPLAY_NAMES[slug] });
    const toggle = row.createDiv({
      cls: `pc-cond-toggle${active.has(slug) ? " on" : ""}`,
    });
    toggle.addEventListener("click", () => {
      editState.toggleCondition(slug);
      toggle.classList.toggle("on");
    });
  }

  popover.createDiv({ cls: "pc-cond-popover-divider" });

  const exhaustion = popover.createDiv({ cls: "pc-cond-popover-exhaustion" });
  const header = exhaustion.createDiv({ cls: "pc-cond-exhaustion-header" });
  const headerIcon = header.createDiv({ cls: "pc-cond-icon-wrap" });
  setExhaustionIcon(headerIcon);
  header.createDiv({ cls: "pc-cond-name", text: "Exhaustion" });
  header.createDiv({
    cls: "pc-cond-exhaustion-level",
    text: ctx.resolved.state.exhaustion > 0 ? `Level ${ctx.resolved.state.exhaustion}` : "Level --",
  });

  const pillsRow = exhaustion.createDiv({ cls: "pc-cond-exhaustion-pills" });
  const labels: Array<{ label: string; level: number }> = [
    { label: "--", level: 0 },
    { label: "1", level: 1 },
    { label: "2", level: 2 },
    { label: "3", level: 3 },
    { label: "4", level: 4 },
    { label: "5", level: 5 },
    { label: "6", level: 6 },
  ];
  for (const { label, level } of labels) {
    const pill = pillsRow.createSpan({
      cls: `pc-cond-exhaustion-pill${ctx.resolved.state.exhaustion === level ? " active" : ""}`,
      text: label,
    });
    pill.addEventListener("click", () => {
      editState.setExhaustion(level);
      pillsRow.querySelectorAll(".pc-cond-exhaustion-pill").forEach((el) => el.classList.remove("active"));
      pill.classList.add("active");
      header.querySelector(".pc-cond-exhaustion-level")!.textContent =
        level === 0 ? "Level --" : `Level ${level}`;
    });
  }

  // Close handlers — listen at document level, removed on close.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeConditionsPopover();
  };
  // The click that opened the popover bubbles to `document` — but since the
  // anchor ("+" button in the defenses panel) lives inside the sheet, it is
  // matched by `anchor.contains(e.target)` below and correctly ignored,
  // which means the handler can register synchronously and still survive
  // the opening click. Tests that call `openConditionsPopover` from a
  // programmatic context (no preceding click) then fire
  // `document.body.click()` target `<body>` directly, which is outside the
  // anchor, so the popover closes as expected.
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Node)) return;
    if (popover.contains(e.target) || anchor.contains(e.target)) return;
    closeConditionsPopover();
  };
  const onScroll = () => closeConditionsPopover();

  activeDocument.addEventListener("keydown", onKeyDown);
  activeDocument.addEventListener("click", onClick);
  activeWindow.addEventListener("scroll", onScroll, true);

  current = {
    root: popover,
    cleanup: () => {
      activeDocument.removeEventListener("keydown", onKeyDown);
      activeDocument.removeEventListener("click", onClick);
      activeWindow.removeEventListener("scroll", onScroll, true);
    },
  };
}

export function closeConditionsPopover(): void {
  if (!current) return;
  current.cleanup();
  current.root.remove();
  current = null;
}
