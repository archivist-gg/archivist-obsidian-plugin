import { makeInlineInput } from "./edit-primitives";

export interface ChargesWidgetOpts {
  current: number;
  max: number;
  recovery?: string;
  onSetCurrent: (n: number) => void;
}

export function renderChargesWidget(parent: HTMLElement, opts: ChargesWidgetOpts): HTMLElement {
  const w = parent.createDiv({ cls: "pc-charges-widget" });
  const stepper = w.createDiv({ cls: "pc-charges-stepper" });

  const cur = stepper.createSpan({ cls: "pc-charges-current", text: String(opts.current) });
  cur.style.cursor = "pointer";
  stepper.createSpan({ cls: "pc-charges-sep", text: "/" });
  stepper.createSpan({ cls: "pc-charges-max", text: String(opts.max) });

  cur.addEventListener("click", () => {
    makeInlineInput(cur, {
      initial: opts.current, min: 0, max: opts.max,
      onCommit: (n) => opts.onSetCurrent(n),
      onCancel: () => {/* no-op */},
    });
  });

  if (opts.recovery) {
    w.createDiv({ cls: "pc-charges-recovery", text: `recovers ${opts.recovery}` });
  }

  return w;
}
