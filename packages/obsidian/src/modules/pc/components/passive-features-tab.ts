import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { bareEntitySlug } from "@archivist-gg/dnd5e/entities/slug";
import { warnOnce } from "@archivist-gg/dnd5e/dnd/warn-once";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";
import { renderActiveEffectsRail, type ActiveEffectItem } from "./active-effects-rail";
import { renderRaceBlock } from "./passive/race-block";
import { renderBackgroundBlock } from "./passive/background-block";

/**
 * Tab 2 — "Passive & Features". Renders, top to bottom (spec §1.1):
 *   0. the **active-effects rail** (R4-G5 §4.4.1: `renderActiveEffectsRail`, fed
 *      by `activeBuffItems` below), ABOVE everything and BEFORE the empty-state
 *      return, so a raging Barbarian with no passive rows still sees the tile that
 *      ends it; it renders nothing when no buff is active;
 *   1. the **Race section** (`renderRaceBlock`, reads `resolved.race`): a
 *      `.pc-tab-heading` + one feature row + row-expand (D7.1), consolidating the
 *      scattered per-trait race rows the model used to emit;
 *   2. the bespoke **Background block** (`renderBackgroundBlock`, reads
 *      `resolved.background`) — replacing the 2024 "(No description provided.)"
 *      placeholder with a real-content reference block;
 *   3. the `passive` economy grouped sections ("Passive & Free Actions": passive/
 *      free features, feats, and free/passive boons).
 *
 * The `race` AND `background` sub-groups are PRE-SPLIT out of the passive model
 * before rendering the sections (F8): the bespoke blocks own that content now
 * (removing `background` also suppresses the generator placeholder row). Any
 * Section left with zero sub-groups after the split is dropped (R1-#6) so a bare
 * "Passive & Free Actions" `<h4>` never renders. Shares the same section renderer
 * as the Actions tab; passive/free rows never dim, so no incapacitated banner
 * here.
 */
export class PassiveFeaturesTab implements SheetComponent {
  readonly type = "passive-features-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Keep `pc-actions-tab` so the tab-scoped attack-tag color rules
    // (actions.css) still apply to any free/special weapon that lands here.
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab pc-passive-features-tab" });

    // Pre-split (§3.2/§4.1, F8): drop the `race` AND `background` sub-groups from
    // every passive Section — their content is owned by the bespoke blocks (the
    // `background` split also suppresses the generator "(No description
    // provided.)" placeholder row) — then drop any Section left with zero
    // sub-groups so a now-empty section never renders a bare heading.
    const sections = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities)
      .filter((s) => s.key === "passive")
      .map((s) => ({
        ...s,
        subGroups: s.subGroups.filter((sg) => sg.key !== "race" && sg.key !== "background"),
      }))
      .filter((s) => s.subGroups.length > 0);

    // R4-G5 §4.4.1: what is currently ACTIVE, at the top of the Passive tab and BEFORE the empty-state
    // return, so a raging Barbarian with no passive rows still sees the tile that ends it. The Actions
    // tab is unchanged (measured: 0 rails there today, and this adds none).
    renderActiveEffectsRail(root, activeBuffItems(ctx));

    const hasBlock = ctx.resolved.race != null || ctx.resolved.background != null;
    if (!hasBlock && sections.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "(No passive or free actions.)" });
      return;
    }

    // Blocks first (Race, then Background — spec §1.1), then the grouped passive
    // sections.
    renderRaceBlock(root, ctx);
    renderBackgroundBlock(root, ctx);
    renderActionSections(root, sections, ctx, true);
  }
}

/** One tile per stored `active_buffs` key, over the TWO keyspaces a buff can live in (R4-G5 §4.4.1):
 *  a class feature's `feature.id` FIRST, then a pool entry's `slug`. The pool arm matches by BARE slug
 *  as well as by full slug (§9.2.4), so an Active state written under the edition twin that §9's
 *  collapse removed still shows a tile · and its End control writes the STORED key, which is the only
 *  key that clears it. An id that matches neither renders no tile and warns once. */
function activeBuffItems(ctx: ComponentRenderContext): ActiveEffectItem[] {
  const items: ActiveEffectItem[] = [];
  for (const key of ctx.resolved.state?.active_buffs ?? []) {
    const feat = (ctx.resolved.features ?? []).find((f) => f.feature.id === key);
    if (feat) {
      items.push({ label: "Active", name: feat.feature.name, onEnd: () => ctx.editState?.toggleActiveBuff(key) });
      continue;
    }
    const bare = bareEntitySlug(key);
    let hit: ResolvedPoolEntry | undefined;
    for (const p of ctx.resolved.pools ?? []) {
      hit = [...p.selected, ...p.grants].find((e) => e.slug === key || bareEntitySlug(e.slug) === bare);
      if (hit) break;
    }
    if (hit) {
      items.push({ label: "Active boon", name: hit.entity.name, onEnd: () => ctx.editState?.toggleActiveBuff(key) });
      continue;
    }
    warnOnce(`passive-rail:${key}`, `active buff "${key}" matches no feature id and no pool entry slug; no tile rendered`);
  }
  return items;
}
