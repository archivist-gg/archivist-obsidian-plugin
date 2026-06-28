import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { ResolvedEquipped } from "../../pc.types";
import { renderMedallion } from "./attune-medallion";

export interface AttunementStripOptions {
  onPickEmpty?: (slotIndex: number) => void;
  onClickFilled?: (occupant: ResolvedEquipped, anchor: HTMLElement) => void;
}

export class AttunementStrip implements SheetComponent {
  readonly type = "attunement-strip";

  constructor(private readonly opts: AttunementStripOptions = {}) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-attune-strip" });
    const head = root.createDiv({ cls: "pc-attune-head" });
    head.createDiv({ cls: "pc-attune-label", text: "Attuned" });
    const count = head.createDiv({ cls: "pc-attune-count" });
    count.appendText(String(ctx.derived.attunementUsed ?? 0));
    count.createEl("em", { text: ` / ${ctx.derived.attunementLimit ?? 3}` });

    const slotsRow = root.createDiv({ cls: "pc-attune-meds" });

    const occupants = collectAttuned(ctx);
    const limit = ctx.derived.attunementLimit ?? 3;

    for (let i = 0; i < limit; i++) {
      const occupant = occupants[i] ?? null;
      renderMedallion(slotsRow, {
        slotIndex: i,
        occupant,
        onClickEmpty: (slot) => this.opts.onPickEmpty?.(slot),
        onClickFilled: (o, anchor) => this.opts.onClickFilled?.(o, anchor),
      });
    }
  }
}

function collectAttuned(ctx: ComponentRenderContext): ResolvedEquipped[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  const reg = ctx.core?.entities as { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null } | undefined;
  const out: ResolvedEquipped[] = [];
  equipment.forEach((entry, index) => {
    if (!entry.attuned) return;
    const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
    const found = slug ? reg?.getBySlug?.(slug) : null;
    const entity = found ? ((found.data ?? {}) as never) : null;
    const entityType = found ? (found.entityType ?? null) : null;
    out.push({ index, entity, entityType, entry });
  });
  return out;
}
