import { MarkdownRenderer, type App } from "obsidian";
import { setIcon } from "obsidian";
import { renderMonsterBlock } from "../../renderers/monster-renderer";
import { renderSpellBlock } from "../../renderers/spell-renderer";
import { renderItemBlock } from "../../renderers/item-renderer";
import type { Message } from "../../types/conversation";
import * as yaml from "js-yaml";

export function renderUserMessage(parent: HTMLElement, message: Message): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-user" });
  wrapper.createDiv({ cls: "archivist-inquiry-msg-bubble" }).textContent = message.content;
  return wrapper;
}

export function renderAssistantMessage(parent: HTMLElement, message: Message, app: App, sourcePath: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-assistant" });
  if (message.content) {
    const textDiv = wrapper.createDiv({ cls: "archivist-inquiry-msg-text" });
    MarkdownRenderer.render(app, message.content, textDiv, sourcePath, null as any);
    const copyBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-copy" });
    setIcon(copyBtn, "copy");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(message.content);
      setIcon(copyBtn, "check");
      setTimeout(() => setIcon(copyBtn, "copy"), 2000);
    });
  }
  if (message.generatedEntity) {
    const blockWrapper = wrapper.createDiv({ cls: "archivist-inquiry-stat-block" });
    renderGeneratedBlock(blockWrapper, message.generatedEntity);
  }
  return wrapper;
}

export function renderToolCallMessage(parent: HTMLElement, toolName: string, toolInput?: Record<string, unknown>, isComplete = true): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-tool-call" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-tool-call-header" });
  const iconEl = header.createSpan({ cls: "archivist-inquiry-tool-call-icon" });
  setIcon(iconEl, getToolIcon(toolName));
  header.createSpan({ cls: "archivist-inquiry-tool-call-name", text: toolName.replace("mcp__archivist__", "") });
  if (toolInput) {
    const summary = getToolSummary(toolName, toolInput);
    if (summary) header.createSpan({ cls: "archivist-inquiry-tool-call-summary", text: summary });
  }
  const statusEl = header.createSpan({ cls: "archivist-inquiry-tool-call-status" });
  if (isComplete) { setIcon(statusEl, "check"); statusEl.addClass("archivist-inquiry-tool-status-done"); }
  else { statusEl.addClass("archivist-inquiry-tool-status-running"); }
  return wrapper;
}

export function renderErrorMessage(parent: HTMLElement, errorText: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-error" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-msg-error-icon" });
  setIcon(iconEl, "alert-circle");
  wrapper.createSpan({ text: errorText });
  return wrapper;
}

export function renderThinkingIndicator(parent: HTMLElement): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-thinking" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-thinking-icon" });
  setIcon(iconEl, "loader-2");
  wrapper.createSpan({ text: "Thinking..." });
  return wrapper;
}

function renderGeneratedBlock(parent: HTMLElement, entity: { type: string; data: unknown }): void {
  try {
    switch (entity.type) {
      case "monster": parent.appendChild(renderMonsterBlock(entity.data as any)); break;
      case "spell": parent.appendChild(renderSpellBlock(entity.data as any)); break;
      case "item": parent.appendChild(renderItemBlock(entity.data as any)); break;
      default:
        parent.createEl("pre", { cls: "archivist-inquiry-json" }).textContent = JSON.stringify(entity.data, null, 2);
    }
  } catch { parent.createDiv({ cls: "archivist-inquiry-msg-error", text: "Failed to render block" }); }

  const copyBtn = parent.createDiv({ cls: "archivist-inquiry-block-copy" });
  const copyIcon = copyBtn.createSpan();
  setIcon(copyIcon, "clipboard-copy");
  copyBtn.createSpan({ text: "Copy to Clipboard" });
  copyBtn.addEventListener("click", () => {
    const fenceType = entity.type;
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    navigator.clipboard.writeText(`\`\`\`${fenceType}\n${yamlStr}\`\`\``);
    copyBtn.empty();
    const checkIcon = copyBtn.createSpan();
    setIcon(checkIcon, "check");
    copyBtn.createSpan({ text: "Copied!" });
    setTimeout(() => {
      copyBtn.empty();
      const icon2 = copyBtn.createSpan();
      setIcon(icon2, "clipboard-copy");
      copyBtn.createSpan({ text: "Copy to Clipboard" });
    }, 2000);
  });
}

function getToolIcon(toolName: string): string {
  const name = toolName.replace("mcp__archivist__", "");
  if (name.includes("search")) return "search";
  if (name.includes("get")) return "book-open";
  if (name.includes("generate")) return "wand-2";
  return "wrench";
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  const name = toolName.replace("mcp__archivist__", "");
  if (name === "search_srd") return `"${input.query}"`;
  if (name === "get_srd_entity") return `"${input.name}"`;
  if (name === "generate_monster" && input.monster) return `"${(input.monster as any).name}"`;
  if (name === "generate_spell" && input.spell) return `"${(input.spell as any).name}"`;
  if (name === "generate_item" && input.item) return `"${(input.item as any).name}"`;
  return "";
}
