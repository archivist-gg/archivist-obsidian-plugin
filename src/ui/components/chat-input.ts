import { setIcon } from "obsidian";
import { MentionDropdown } from "./mention-dropdown";
import { SlashCommandDropdown } from "./slash-commands";

export interface ChatInputState {
  selectedText?: string;
  currentNotePath?: string;
  model: string;
  thinkingBudget: string;
  permissionMode: "auto" | "safe";
  contextPercent: number;
  isStreaming: boolean;
  vaultFiles?: string[];
  mentionedFiles?: string[];
}

export interface ChatInputCallbacks {
  onSend: (text: string) => void;
  onStop: () => void;
  onModelChange: (model: string) => void;
  onThinkingBudgetChange: (budget: string) => void;
  onPermissionToggle: () => void;
  onDismissSelection: () => void;
  onDismissNote?: () => void;
  onMentionFile?: (path: string) => void;
  onRemoveMention?: (path: string) => void;
  onSlashCommand?: (action: string) => void;
}

const MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4" },
];

export function renderChatInput(parent: HTMLElement, state: ChatInputState, callbacks: ChatInputCallbacks): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-input-area" });

  // Context row (selection indicator)
  if (state.selectedText) {
    const ctxRow = wrapper.createDiv({ cls: "archivist-inquiry-context-row" });
    const iconEl = ctxRow.createSpan({ cls: "archivist-inquiry-context-icon" });
    setIcon(iconEl, "highlighter");
    ctxRow.createSpan({ cls: "archivist-inquiry-context-label", text: "Selection" });
    ctxRow.createSpan({
      cls: "archivist-inquiry-context-preview",
      text: state.selectedText.length > 60 ? state.selectedText.slice(0, 60) + "..." : state.selectedText,
    });
    const dismissBtn = ctxRow.createSpan({ cls: "archivist-inquiry-context-dismiss", text: "\u00d7" });
    dismissBtn.addEventListener("click", callbacks.onDismissSelection);
  }

  // Context row (current note indicator)
  if (state.currentNotePath) {
    const noteRow = wrapper.createDiv({ cls: "archivist-inquiry-context-row archivist-inquiry-context-note" });
    const iconEl = noteRow.createSpan({ cls: "archivist-inquiry-context-icon" });
    setIcon(iconEl, "file-text");
    noteRow.createSpan({ cls: "archivist-inquiry-context-label", text: "Note" });
    const basename = state.currentNotePath.split("/").pop() ?? state.currentNotePath;
    noteRow.createSpan({ cls: "archivist-inquiry-context-preview", text: basename });
    if (callbacks.onDismissNote) {
      const dismissNoteBtn = noteRow.createSpan({ cls: "archivist-inquiry-context-dismiss", text: "\u00d7" });
      dismissNoteBtn.addEventListener("click", callbacks.onDismissNote);
    }
  }

  // Mentioned files chips
  if (state.mentionedFiles && state.mentionedFiles.length > 0) {
    const chipsRow = wrapper.createDiv({ cls: "archivist-inquiry-mention-chips" });
    for (const filePath of state.mentionedFiles) {
      const chip = chipsRow.createDiv({ cls: "archivist-inquiry-mention-chip" });
      const chipIcon = chip.createSpan({ cls: "archivist-inquiry-mention-chip-icon" });
      setIcon(chipIcon, "file-text");
      chip.createSpan({ text: filePath.split("/").pop() ?? filePath });
      if (callbacks.onRemoveMention) {
        const removeBtn = chip.createSpan({ cls: "archivist-inquiry-mention-chip-remove", text: "\u00d7" });
        removeBtn.addEventListener("click", () => callbacks.onRemoveMention!(filePath));
      }
    }
  }

  // Input wrapper
  const inputWrapper = wrapper.createDiv({
    cls: state.isStreaming ? "archivist-inquiry-input-wrapper archivist-inquiry-input-streaming" : "archivist-inquiry-input-wrapper",
  });

  // Textarea
  const textarea = inputWrapper.createEl("textarea", {
    cls: "archivist-inquiry-textarea",
    attr: { placeholder: state.isStreaming ? "Archivist is thinking..." : "Ask the Archivist... (@ to mention files, / for commands)", rows: "1" },
  });
  if (state.isStreaming) textarea.disabled = true;
  else requestAnimationFrame(() => textarea.focus());
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    const maxH = Math.max(150, window.innerHeight * 0.4);
    textarea.style.height = Math.min(textarea.scrollHeight, maxH) + "px";
  });
  // @mention dropdown
  let mentionDropdown: MentionDropdown | null = null;
  if (state.vaultFiles && callbacks.onMentionFile) {
    mentionDropdown = new MentionDropdown(textarea, inputWrapper, () => state.vaultFiles ?? [], callbacks.onMentionFile);
  }

  // Slash command dropdown
  let slashDropdown: SlashCommandDropdown | null = null;
  if (callbacks.onSlashCommand) {
    slashDropdown = new SlashCommandDropdown(textarea, inputWrapper, callbacks.onSlashCommand);
  }

  textarea.addEventListener("keydown", (e) => {
    // Let open dropdowns handle navigation keys first
    const dropdownOpen = mentionDropdown?.isOpen() || slashDropdown?.isOpen();
    if (dropdownOpen && (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Escape")) {
      return; // Dropdown keydown handlers will handle this
    }
    if (e.key === "Escape" && state.isStreaming) {
      e.preventDefault();
      callbacks.onStop();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !state.isStreaming) {
      e.preventDefault();
      const text = textarea.value.trim();
      if (text) { callbacks.onSend(text); textarea.value = ""; textarea.style.height = "auto"; }
    }
  });

  // Toolbar row
  const toolbar = inputWrapper.createDiv({ cls: "archivist-inquiry-toolbar" });

  // Model selector (dropdown is a child so position: absolute works)
  const modelContainer = toolbar.createDiv({ cls: "archivist-inquiry-model-selector" });
  const currentModel = MODELS.find((m) => m.id === state.model) ?? MODELS[0];
  modelContainer.createSpan({ text: currentModel.label });
  const chevron = modelContainer.createSpan({ cls: "archivist-inquiry-model-chevron" });
  setIcon(chevron, "chevron-up");

  const modelDropdown = modelContainer.createDiv({ cls: "archivist-inquiry-model-dropdown" });
  modelDropdown.style.display = "none";
  for (const model of MODELS) {
    const option = modelDropdown.createDiv({
      cls: model.id === state.model ? "archivist-inquiry-model-option archivist-inquiry-model-option-active" : "archivist-inquiry-model-option",
      text: model.label,
    });
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onModelChange(model.id);
      modelDropdown.style.display = "none";
    });
  }
  modelContainer.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = modelDropdown.style.display === "none";
    modelDropdown.style.display = isHidden ? "" : "none";
    if (isHidden) {
      const dismiss = () => { modelDropdown.style.display = "none"; document.removeEventListener("click", dismiss); };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    }
  });

  toolbar.createDiv({ cls: "archivist-inquiry-toolbar-sep" });

  // Effort level selector (maps to thinking token budgets like Claudian)
  const thinkingBudgets = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Med" },
    { id: "high", label: "High" },
    { id: "max", label: "Max" },
  ];
  const thinkingContainer = toolbar.createDiv({ cls: "archivist-inquiry-thinking-selector" });
  thinkingContainer.createSpan({ cls: "archivist-inquiry-thinking-selector-label", text: "Effort:" });
  const currentBudget = thinkingBudgets.find(b => b.id === state.thinkingBudget) ?? thinkingBudgets[0];
  thinkingContainer.createSpan({ text: currentBudget.label });

  const thinkingDropdown = thinkingContainer.createDiv({ cls: "archivist-inquiry-thinking-dropdown" });
  thinkingDropdown.style.display = "none";
  for (const budget of thinkingBudgets) {
    const option = thinkingDropdown.createDiv({
      cls: budget.id === state.thinkingBudget ? "archivist-inquiry-model-option archivist-inquiry-model-option-active" : "archivist-inquiry-model-option",
      text: budget.label,
    });
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onThinkingBudgetChange(budget.id);
      thinkingDropdown.style.display = "none";
    });
  }
  thinkingContainer.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = thinkingDropdown.style.display === "none";
    thinkingDropdown.style.display = isHidden ? "" : "none";
    if (isHidden) {
      const dismiss = () => { thinkingDropdown.style.display = "none"; document.removeEventListener("click", dismiss); };
      setTimeout(() => document.addEventListener("click", dismiss), 0);
    }
  });

  toolbar.createDiv({ cls: "archivist-inquiry-toolbar-sep" });

  // Context gauge
  const gauge = toolbar.createDiv({ cls: "archivist-inquiry-gauge" });
  renderContextGauge(gauge, state.contextPercent);

  toolbar.createDiv({ cls: "archivist-inquiry-toolbar-sep" });

  // Permission toggle
  const permToggle = toolbar.createDiv({ cls: "archivist-inquiry-perm-toggle" });
  const isAuto = state.permissionMode === "auto";
  permToggle.createSpan({
    cls: isAuto ? "archivist-inquiry-perm-label archivist-inquiry-perm-auto" : "archivist-inquiry-perm-label",
    text: isAuto ? "Auto" : "Safe",
  });
  const toggle = permToggle.createDiv({ cls: isAuto ? "archivist-inquiry-toggle archivist-inquiry-toggle-on" : "archivist-inquiry-toggle" });
  toggle.createDiv({ cls: "archivist-inquiry-toggle-thumb" });
  permToggle.addEventListener("click", callbacks.onPermissionToggle);

  // Send / Stop button
  const actionBtn = toolbar.createDiv({ cls: "archivist-inquiry-send-btn" });
  if (state.isStreaming) {
    actionBtn.addClass("archivist-inquiry-stop-btn");
    actionBtn.createDiv({ cls: "archivist-inquiry-stop-icon" });
    actionBtn.addEventListener("click", callbacks.onStop);
  } else {
    setIcon(actionBtn, "send");
    actionBtn.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (text) { callbacks.onSend(text); textarea.value = ""; textarea.style.height = "auto"; }
    });
  }

  return wrapper;
}

function renderContextGauge(parent: HTMLElement, percent: number, contextTokens?: number): void {
  const contextWindow = 200000;
  const used = contextTokens ?? Math.round((percent / 100) * contextWindow);
  const usedK = (used / 1000).toFixed(1);
  const maxK = (contextWindow / 1000).toFixed(0);
  const tooltip = `${usedK}k / ${maxK}k tokens${percent > 80 ? " (Approaching limit)" : ""}`;

  parent.setAttribute("title", tooltip);
  parent.setAttribute("aria-label", tooltip);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "14"); svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.style.transform = "rotate(-90deg)";
  const r = 9, circ = 2 * Math.PI * r, offset = circ * (1 - percent / 100);
  const bg = document.createElementNS(ns, "circle");
  bg.setAttribute("cx", "12"); bg.setAttribute("cy", "12"); bg.setAttribute("r", String(r));
  bg.setAttribute("stroke", "var(--background-modifier-border)"); bg.setAttribute("stroke-width", "2.5"); bg.setAttribute("fill", "none");
  svg.appendChild(bg);
  const progress = document.createElementNS(ns, "circle");
  progress.setAttribute("cx", "12"); progress.setAttribute("cy", "12"); progress.setAttribute("r", String(r));
  progress.setAttribute("stroke", percent > 80 ? "var(--text-error)" : "#D97757");
  progress.setAttribute("stroke-width", "2.5"); progress.setAttribute("fill", "none");
  progress.setAttribute("stroke-dasharray", String(circ)); progress.setAttribute("stroke-dashoffset", String(offset));
  progress.setAttribute("stroke-linecap", "round");
  svg.appendChild(progress);
  parent.appendChild(svg);
  parent.createSpan({ cls: "archivist-inquiry-gauge-text", text: `${percent}%` });
}
