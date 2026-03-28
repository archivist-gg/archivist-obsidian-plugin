import { setIcon } from "obsidian";

export interface ChatInputState {
  selectedText?: string;
  model: string;
  permissionMode: "auto" | "safe";
  contextPercent: number;
  isStreaming: boolean;
}

export interface ChatInputCallbacks {
  onSend: (text: string) => void;
  onStop: () => void;
  onModelChange: (model: string) => void;
  onPermissionToggle: () => void;
  onDismissSelection: () => void;
}

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4" },
  { id: "claude-opus-4-6", label: "Opus 4" },
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

  // Input wrapper
  const inputWrapper = wrapper.createDiv({
    cls: state.isStreaming ? "archivist-inquiry-input-wrapper archivist-inquiry-input-streaming" : "archivist-inquiry-input-wrapper",
  });

  // Textarea
  const textarea = inputWrapper.createEl("textarea", {
    cls: "archivist-inquiry-textarea",
    attr: { placeholder: state.isStreaming ? "Archivist is thinking..." : "Ask the Archivist...", rows: "1" },
  });
  if (state.isStreaming) textarea.disabled = true;
  textarea.addEventListener("input", () => { textarea.style.height = "auto"; textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"; });
  textarea.addEventListener("keydown", (e) => {
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
    const sendIcon = actionBtn.createSpan();
    setIcon(sendIcon, "send");
    actionBtn.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (text) { callbacks.onSend(text); textarea.value = ""; textarea.style.height = "auto"; }
    });
  }

  return wrapper;
}

function renderContextGauge(parent: HTMLElement, percent: number): void {
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
