import type { App } from "obsidian";
import type {
  EditContext,
  EntityPresenter,
  RenderContext,
} from "../../shared/rendering/entity-presenter";
import type { ConditionEntity } from "@archivist-gg/dnd5e/condition/condition.types";
import { el, sourceBadgeText } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

/**
 * The `condition` presenter (spec §6). A condition doc carries no modelled
 * mechanics — a name, a source, an authored markdown body and optional fluff
 * images — so the block is the shared parchment card with the description doing
 * all the work.
 *
 * DOM construction follows the armor module (a synchronous skeleton, the
 * appended node returned so the host can swap it). The DESCRIPTION goes through
 * `renderMarkdownDescription` on the race/feat wrapper pattern instead of a
 * plain `textContent`, because condition bodies are real markdown: the SRD
 * Exhaustion entry is a six-row table and the 2024 entries are bolded
 * sub-headings, both of which would ship as raw pipes and asterisks otherwise.
 */

function appOf(ctx: RenderContext): App | undefined {
  return (ctx.plugin as { app?: App } | undefined)?.app;
}

/** Markdown embeds for the `image` field, which is one wikilink or an array of
 *  them (`imageField`, dnd5e `schemas/entity-extras-schema`). A bare path is
 *  wrapped; an already-embedded value is left alone. Obsidian resolves the
 *  vault path — this module never touches the filesystem. */
function imageEmbeds(image: ConditionEntity["image"]): string[] {
  const values = image === undefined ? [] : Array.isArray(image) ? image : [image];
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => {
      if (value.startsWith("![[")) return value;
      return value.startsWith("[[") ? `!${value}` : `![[${value}]]`;
    });
}

/** Fire-and-forget markdown fill into an already-attached node (the race module
 *  contract): the block is returned synchronously and the prose lands a
 *  microtask later, so a slow render can never leave the host empty. */
function fillMarkdown(target: HTMLElement, markdown: string, app?: App): void {
  void renderMarkdownDescription(target, markdown, app).catch((err: unknown) => {
    console.error("[Archivist] condition block render failed", err);
    target.createDiv({
      cls: "archivist-block-error",
      text: `Condition body failed to render: ${String(err)}`,
    });
  });
}

function renderConditionBlock(data: ConditionEntity, app?: App): HTMLElement {
  const wrapper = el("div", {
    cls: "archivist-spell-block-wrapper archivist-condition-block-wrapper",
  });
  const block = el("div", {
    cls: "archivist-spell-block archivist-condition-block",
    parent: wrapper,
  });

  const badgeText = sourceBadgeText(data);
  if (badgeText) el("span", { cls: "source-badge", text: badgeText, parent: block });

  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: data.name, parent: header });
  el("div", { cls: "spell-school", text: "Condition", parent: header });

  if (data.description.length > 0) {
    fillMarkdown(el("div", { cls: "spell-description", parent: block }), data.description, app);
  }

  const embeds = imageEmbeds(data.image);
  if (embeds.length > 0) {
    fillMarkdown(
      el("div", { cls: "archivist-condition-images", parent: block }),
      embeds.join("\n\n"),
      app,
    );
  }

  return wrapper;
}

class ConditionModule implements EntityPresenter {
  readonly type = "condition";

  render(host: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    const block = renderConditionBlock(data as ConditionEntity, appOf(ctx));
    host.appendChild(block);
    return block;
  }

  /**
   * The edit contract from spec §6: re-render the READ body into the edit host
   * plus a Cancel that calls `onExit`. A condition has no modelled fields to
   * offer form controls for, and an `onExit`-only renderer would leave the Edit
   * button showing a blank pane on a writable note — the body being non-empty
   * is the point (asserted in `tests/condition-module.test.ts`).
   */
  renderEditMode(host: HTMLElement, data: unknown, ctx: EditContext): void {
    const wrapper = el("div", { cls: "archivist-condition-edit", parent: host });
    wrapper.appendChild(renderConditionBlock(data as ConditionEntity, appOf(ctx)));

    const actions = el("div", { cls: "archivist-condition-edit-actions", parent: wrapper });
    const cancel = el("button", {
      cls: "archivist-condition-edit-cancel",
      text: "Cancel",
      parent: actions,
    });
    cancel.addEventListener("click", () => {
      ctx.onExit?.();
    });
  }
}

export const conditionModule: EntityPresenter = new ConditionModule();
