import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedPoolEntry } from "../pc.types";

const COST_LABELS: Record<string, string> = {
  action: "1 Action", "bonus-action": "1 Bonus Action", reaction: "Reaction", free: "Free", special: "Special",
};

/** Generic tab that renders one selection pool's picks + grants, with in-place
 *  add/remove writing to the choices ledger. One instance per declared pool
 *  (type = `pool-tab:<id>`); constructed by TabsContainer, not registered. */
export class PoolTab implements SheetComponent {
  readonly type: string;
  constructor(private readonly poolId: string) {
    this.type = `pool-tab:${poolId}`;
  }

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const pool = ctx.resolved?.pools?.find((p) => p.id === this.poolId);
    if (!pool) {
      el.createDiv({ cls: "pc-empty-line", text: "No data for this pool." });
      return;
    }

    const head = el.createDiv({ cls: "pc-pool-head" });
    head.createSpan({ cls: "pc-pool-count", text: `${pool.label} ${pool.selected.length} / ${pool.count}` });
    const addBtn = head.createEl("button", { cls: "pc-pool-addbtn", text: "+ Add" });

    const body = el.createDiv({ cls: "pc-pool-body" });
    let adding = false;

    const selectedSlugs = (): string[] => pool.selected.map((e) => e.slug);

    const writeList = (next: string[]): void => {
      ctx.editState?.setChoice(pool.classIndex, pool.anchorLevel, pool.id, next);
    };

    const renderList = (): void => {
      body.empty();
      for (const entry of pool.selected) this.row(body, entry, false, writeList, selectedSlugs);
      for (const entry of pool.grants) this.row(body, entry, true, writeList, selectedSlugs);
    };

    const renderAdd = (): void => {
      body.empty();
      const picked = new Set(selectedSlugs());
      const atCap = pool.selected.length >= pool.count;
      const candidates = pool.available.filter((e) => !picked.has(e.slug));
      if (!candidates.length) {
        body.createDiv({ cls: "pc-empty-line", text: "No more options available." });
        return;
      }
      for (const entry of candidates) {
        const row = body.createDiv({ cls: "pc-pool-add-row" });
        row.createSpan({ cls: "pc-pool-name", text: entry.entity.name });
        const add = row.createEl("button", { cls: "pc-pool-add", text: atCap ? "Full" : "+ Add" });
        if (atCap) add.setAttribute("disabled", "true");
        else add.addEventListener("click", () => writeList([...selectedSlugs(), entry.slug]));
      }
    };

    addBtn.addEventListener("click", () => {
      adding = !adding;
      addBtn.toggleClass("open", adding);
      addBtn.setText(adding ? "✓ Done" : "+ Add");
      if (adding) renderAdd();
      else renderList();
    });

    renderList();
  }

  private row(
    parent: HTMLElement,
    entry: ResolvedPoolEntry,
    granted: boolean,
    writeList: (next: string[]) => void,
    selectedSlugs: () => string[],
  ): void {
    const e = entry.entity;
    const row = parent.createDiv({ cls: "pc-pool-row" });

    const nameWrap = row.createDiv({ cls: "pc-pool-namewrap" });
    nameWrap.createSpan({ cls: "pc-pool-name", text: e.name });
    if (e.passive) nameWrap.createSpan({ cls: "pc-pool-passive", text: "Passive" });
    if (granted) nameWrap.createSpan({ cls: "pc-pool-granted", text: "Granted" });

    const meta = row.createDiv({ cls: "pc-pool-meta" });
    if (e.action_cost) meta.createSpan({ cls: "pc-pool-cost", text: COST_LABELS[e.action_cost] ?? e.action_cost });
    if (e.consumes?.amount) {
      const word = e.consumes.resource ?? e.consumes.column ?? "resource";
      const display = e.consumes.amount === 1 ? word.replace(/s$/, "") : word;
      const label = `${display.charAt(0).toUpperCase()}${display.slice(1)}`;
      meta.createSpan({ cls: "pc-pool-consume", text: `${e.consumes.amount} ${label}` });
    }
    if (e.duration && typeof e.duration === "object") {
      meta.createSpan({ cls: "pc-pool-duration", text: `${e.duration.amount} ${e.duration.unit}` });
    }

    const desc = row.createDiv({ cls: "pc-pool-desc" });
    desc.addClass("is-collapsed");
    nameWrap.addEventListener("click", () => {
      if (!desc.hasClass("is-collapsed")) {
        desc.addClass("is-collapsed");
      } else {
        desc.empty();
        desc.setText(e.description ?? "");
        desc.removeClass("is-collapsed");
      }
    });

    if (!granted) {
      const rm = row.createEl("button", { cls: "pc-pool-remove", text: "✕" });
      let armed = false;
      rm.addEventListener("click", () => {
        if (!armed) { armed = true; rm.addClass("armed"); rm.setText("Remove?"); return; }
        writeList(selectedSlugs().filter((s) => s !== entry.slug));
      });
    }
  }
}
