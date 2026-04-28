export interface ChargeBoxesOpts {
  used: number;
  max: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
  onExpend?: () => void;
  onRestore?: () => void;
}

const RESET_LABEL: Record<"dawn" | "short" | "long" | "special", string> = {
  "dawn":    "Dawn",
  "short":   "Short Rest",
  "long":    "Long Rest",
  "special": "Special",
};

export function renderChargeBoxes(parent: HTMLElement, opts: ChargeBoxesOpts): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-charge-boxes" });
  const boxes = wrap.createDiv({ cls: "pc-charge-box-strip" });

  for (let i = 0; i < opts.max; i++) {
    const isExpended = i < opts.used;
    const box = boxes.createDiv({ cls: `pc-charge-box${isExpended ? " expended" : ""}` });
    if (isExpended) box.setAttribute("data-state", "expended");
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isExpended) opts.onRestore?.();
      else opts.onExpend?.();
    });
  }

  if (opts.recovery) {
    const label = formatRecovery(opts.recovery);
    wrap.createDiv({ cls: "pc-charge-recovery", text: `/ ${label}` });
  }
  return wrap;
}

function formatRecovery(rec: { amount: string; reset: "dawn" | "short" | "long" | "special" }): string {
  const base = RESET_LABEL[rec.reset];
  if (rec.reset === "dawn" && rec.amount && rec.amount !== "1") {
    return `${base} ${rec.amount}`;
  }
  return base;
}
