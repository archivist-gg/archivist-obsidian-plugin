import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { collectResourceGroups } from "./resources/resource-model";
import { renderResourceControl } from "./resources/resource-controls";
import { renderSeparated } from "./separated-caption";

/**
 * The Resources tab — every spendable thing the character owns, in one place,
 * grouped by what gives it back.
 *
 * Today a player answering "what can I still spend?" checks Actions, Passive &
 * Features, each pool tab and Inventory: the resources exist, they are just
 * filed by WHERE THEY CAME FROM rather than by WHEN THEY COME BACK. This tab is
 * the second axis. Class features, feats, campaign grants, hit dice and item
 * charges sit together because at the table they are the same question.
 *
 * Three headings, because a rest has two lengths: **Short Rest**, **Long Rest**,
 * **Doesn't reset**. EVERY resource is listed — `surface` decides what the
 * header band ALSO shows and takes nothing out of here, so a resource missing
 * from this list would be a bug (the grouping rule lives in
 * `./resources/resource-model.ts`).
 *
 * The rows are the Passive tab's own three-column `.pc-feature-row`
 * (`minmax(0,2fr) minmax(min-content,1fr) 18px`), reached by carrying
 * `pc-passive-features-tab` on the root: no cost badge, and no new grid. The
 * caret cell is rendered EMPTY and the row is not clickable — there is no expand
 * card behind it, and a caret that opens nothing is a dead affordance
 * (`styles/resources.css` drops the inherited `cursor: pointer` to match).
 */
export class ResourcesTab implements SheetComponent {
  readonly type = "resources-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // `pc-actions-tab` + `pc-passive-features-tab` are carried for their grid and
    // row dress; `pc-resources-tab` is this surface's own hook.
    const root = el.createDiv({
      cls: "pc-tab-body pc-actions-body pc-actions-tab pc-passive-features-tab pc-resources-tab",
    });

    const groups = collectResourceGroups(ctx);
    if (groups.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "(Nothing to spend.)" });
      return;
    }

    for (const group of groups) {
      // No row count beside the heading (user ruling 2026-09-16). What the
      // player reads off this tab is what each resource has left; how MANY
      // resources share a reset is not a number anyone spends, and the rows
      // below are already countable at a glance.
      const heading = root.createEl("h4", { cls: "pc-tab-heading" });
      heading.createSpan({ cls: "pc-resources-heading-label", text: group.heading });

      const list = root.createDiv({ cls: "pc-actions-table pc-feature-list" });
      for (const row of group.rows) {
        const el = list.createDiv({ cls: "pc-action-row pc-feature-row" });
        const nameCell = el.createDiv({ cls: "pc-action-namecell" });
        nameCell.createDiv({ cls: "pc-action-row-name", text: row.name });
        if (row.sub.length) {
          renderSeparated(nameCell.createDiv({ cls: "pc-action-row-sub" }), row.sub, { sep: "·" });
        }
        renderResourceControl(el.createDiv({ cls: "pc-feature-detail" }), row, ctx, "tab");
        // The 18px track the grid declares. Empty on purpose — see the class docblock.
        el.createDiv({ cls: "pc-action-caret" });
      }
    }
  }
}
