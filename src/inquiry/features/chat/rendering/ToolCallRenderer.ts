import { setIcon } from 'obsidian';
import * as yaml from 'js-yaml';

import { extractResolvedAnswersFromResultText, type TodoItem } from '../../../core/tools';
import { getToolIcon, MCP_ICON_MARKER } from '../../../core/tools/toolIcons';
import {
  TOOL_ASK_USER_QUESTION,
  TOOL_BASH,
  TOOL_EDIT,
  TOOL_ENTER_PLAN_MODE,
  TOOL_EXIT_PLAN_MODE,
  TOOL_GLOB,
  TOOL_GREP,
  TOOL_LS,
  TOOL_READ,
  TOOL_SKILL,
  TOOL_TODO_WRITE,
  TOOL_TOOL_SEARCH,
  TOOL_WEB_FETCH,
  TOOL_WEB_SEARCH,
  TOOL_WRITE,
} from '../../../core/tools/toolNames';
import type { ToolCallInfo } from '../../../core/types';
import { appendSvg, MCP_ICON_SVG } from '../../../shared/icons';
import { setupCollapsible } from './collapsible';
import { renderDndEntityBlock, type CopyAndSaveCallback, type UpdateEntityCallback } from './DndEntityRenderer';
import type { App } from 'obsidian';
import type { EntityRegistry } from '../../../../shared/entities/entity-registry';
import { parseDndCodeFence } from './dndCodeFence';
import { renderTodoItems } from './todoUtils';

function getDndEntityType(toolName: string): string | null {
  if (toolName.includes('generate_monster')) return 'monster';
  if (toolName.includes('generate_spell')) return 'spell';
  if (toolName.includes('generate_item')) return 'item';
  return null;
}

/** Safe string conversion that handles objects without "[object Object]" output. */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

/**
 * Detects if a tool name is a D&D generation tool and returns the entity type.
 * Exported for use by StreamController to create skeleton placeholders.
 */
export function getDndGenerationEntityType(toolName: string): string | null {
  return getDndEntityType(toolName);
}

/**
 * Renders a skeleton placeholder block for a D&D entity being generated.
 * Shows pulsing bars that get replaced with partial data as it arrives,
 * and is ultimately replaced by the full stat block on tool_result.
 */
export function renderBlockSkeleton(
  parentEl: HTMLElement,
  entityType: string,
): { el: HTMLElement; updateFromPartial: (data: Record<string, unknown>) => void } {
  const wrapper = parentEl.createDiv({ cls: 'archivist-stat-block' });
  const skeleton = wrapper.createDiv({ cls: 'archivist-block-skeleton' });

  const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  const headerEl = skeleton.createDiv({ cls: 'archivist-skeleton-header', text: `Generating ${typeLabel}...` });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar' });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar' });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar archivist-skeleton-bar-short' });

  const updateFromPartial = (data: Record<string, unknown>) => {
    const existingPartial = skeleton.querySelector('.archivist-skeleton-partial');
    const partialEl = existingPartial as HTMLElement || skeleton.createDiv({ cls: 'archivist-skeleton-partial' });
    if (!existingPartial) {
      skeleton.querySelectorAll('.archivist-skeleton-bar').forEach(bar => bar.remove());
    }
    partialEl.empty();

    if (data.name) {
      headerEl.setText(safeStringify(data.name));
    }
    if (data.type || data.size) {
      partialEl.createDiv({ cls: 'archivist-skeleton-type', text: [data.size, data.type].filter(Boolean).map(safeStringify).join(' ') });
    }
    if (data.ac) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `AC: ${safeStringify(data.ac)}` });
    }
    if (data.hp) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `HP: ${safeStringify(data.hp)}` });
    }
    if (data.abilities) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: 'Abilities loaded...' });
    }
    if (data.level !== undefined) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `Level ${safeStringify(data.level)} ${safeStringify(data.school ?? '')}` });
    }
    if (data.rarity) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `Rarity: ${safeStringify(data.rarity)}` });
    }
  };

  return { el: wrapper, updateFromPartial };
}

export function setToolIcon(el: HTMLElement, name: string): void {
  const icon = getToolIcon(name);
  if (icon === MCP_ICON_MARKER) {
    el.empty();
    appendSvg(el, MCP_ICON_SVG);
  } else {
    setIcon(el, icon);
  }
}

export function getToolName(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case TOOL_TODO_WRITE: {
      const todos = input.todos as Array<{ status: string }> | undefined;
      if (todos && Array.isArray(todos) && todos.length > 0) {
        const completed = todos.filter(t => t.status === 'completed').length;
        return `Tasks ${completed}/${todos.length}`;
      }
      return 'Tasks';
    }
    case TOOL_ENTER_PLAN_MODE:
      return 'Entering plan mode';
    case TOOL_EXIT_PLAN_MODE:
      return 'Plan complete';
    default: {
      if (name.startsWith('mcp__archivist__')) {
        const cleanName = name.replace('mcp__archivist__', '');
        switch (cleanName) {
          case 'generate_monster': return 'Generating Monster';
          case 'generate_spell': return 'Generating Spell';
          case 'generate_item': return 'Generating Item';
          case 'generate_encounter': return 'Generating Encounter';
          case 'generate_npc': return 'Generating NPC';
          case 'search_srd': return 'Searching SRD';
          case 'get_srd_entity': return 'Loading SRD Entity';
          default: return cleanName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
      }
      return name;
    }
  }
}

export function getToolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case TOOL_READ:
    case TOOL_WRITE:
    case TOOL_EDIT: {
      const filePath = (input.file_path as string) || '';
      return fileNameOnly(filePath);
    }
    case TOOL_BASH: {
      const cmd = (input.command as string) || '';
      return truncateText(cmd, 60);
    }
    case TOOL_GLOB:
    case TOOL_GREP:
      return (input.pattern as string) || '';
    case TOOL_WEB_SEARCH:
      return truncateText((input.query as string) || '', 60);
    case TOOL_WEB_FETCH:
      return truncateText((input.url as string) || '', 60);
    case TOOL_LS:
      return fileNameOnly((input.path as string) || '.');
    case TOOL_SKILL:
      return (input.skill as string) || '';
    case TOOL_TOOL_SEARCH:
      return truncateText(parseToolSearchQuery(input.query as string | undefined), 60);
    case TOOL_TODO_WRITE:
      return '';
    default: {
      if (name.startsWith('mcp__archivist__')) {
        const getEntityName = (key: string): string => {
          const entity = input[key];
          if (entity && typeof entity === 'object' && 'name' in entity && typeof entity.name === 'string') {
            return entity.name;
          }
          return '';
        };
        return getEntityName('monster') || getEntityName('spell') || getEntityName('item');
      }
      return '';
    }
  }
}

/** Combined name+summary for ARIA labels (collapsible regions need a single descriptive phrase). */
export function getToolLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case TOOL_READ:
      return `Read: ${shortenPath(input.file_path as string) || 'file'}`;
    case TOOL_WRITE:
      return `Write: ${shortenPath(input.file_path as string) || 'file'}`;
    case TOOL_EDIT:
      return `Edit: ${shortenPath(input.file_path as string) || 'file'}`;
    case TOOL_BASH: {
      const cmd = (input.command as string) || 'command';
      return `Bash: ${cmd.length > 40 ? cmd.substring(0, 40) + '...' : cmd}`;
    }
    case TOOL_GLOB:
      return `Glob: ${typeof input.pattern === 'string' && input.pattern ? input.pattern : 'files'}`;
    case TOOL_GREP:
      return `Grep: ${typeof input.pattern === 'string' && input.pattern ? input.pattern : 'pattern'}`;
    case TOOL_WEB_SEARCH: {
      const query = (input.query as string) || 'search';
      return `WebSearch: ${query.length > 40 ? query.substring(0, 40) + '...' : query}`;
    }
    case TOOL_WEB_FETCH: {
      const url = (input.url as string) || 'url';
      return `WebFetch: ${url.length > 40 ? url.substring(0, 40) + '...' : url}`;
    }
    case TOOL_LS:
      return `LS: ${shortenPath(input.path as string) || '.'}`;
    case TOOL_TODO_WRITE: {
      const todos = input.todos as Array<{ status: string }> | undefined;
      if (todos && Array.isArray(todos)) {
        const completed = todos.filter(t => t.status === 'completed').length;
        return `Tasks (${completed}/${todos.length})`;
      }
      return 'Tasks';
    }
    case TOOL_SKILL: {
      const skillName = (input.skill as string) || 'skill';
      return `Skill: ${skillName}`;
    }
    case TOOL_TOOL_SEARCH: {
      const tools = parseToolSearchQuery(input.query as string | undefined);
      return `ToolSearch: ${tools || 'tools'}`;
    }
    case TOOL_ENTER_PLAN_MODE:
      return 'Entering plan mode';
    case TOOL_EXIT_PLAN_MODE:
      return 'Plan complete';
    default:
      return name;
  }
}

export function fileNameOnly(filePath: string): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? normalized;
}

function shortenPath(filePath: string | undefined): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length <= 3) return normalized;
  return '.../' + parts.slice(-2).join('/');
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function parseToolSearchQuery(query: string | undefined): string {
  if (!query) return '';
  const selectPrefix = 'select:';
  const body = query.startsWith(selectPrefix) ? query.slice(selectPrefix.length) : query;
  return body.split(',').map(s => s.trim()).filter(Boolean).join(', ');
}

interface WebSearchLink {
  title: string;
  url: string;
}

function parseWebSearchResult(result: string): { links: WebSearchLink[]; summary: string } | null {
  const linksMatch = result.match(/Links:\s*(\[[\s\S]*?\])(?:\n|$)/);
  if (!linksMatch) return null;

  try {
    const parsed = JSON.parse(linksMatch[1]) as WebSearchLink[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const linksEndIndex = result.indexOf(linksMatch[0]) + linksMatch[0].length;
    const summary = result.slice(linksEndIndex).trim();
    return { links: parsed.filter(l => l.title && l.url), summary };
  } catch {
    return null;
  }
}

function renderWebSearchExpanded(container: HTMLElement, result: string): void {
  const parsed = parseWebSearchResult(result);
  if (!parsed || parsed.links.length === 0) {
    renderLinesExpanded(container, result, 20);
    return;
  }

  const linksEl = container.createDiv({ cls: 'claudian-tool-lines' });
  for (const link of parsed.links) {
    const linkEl = linksEl.createEl('a', { cls: 'claudian-tool-link' });
    linkEl.setAttribute('href', link.url);
    linkEl.setAttribute('target', '_blank');
    linkEl.setAttribute('rel', 'noopener noreferrer');

    const iconEl = linkEl.createSpan({ cls: 'claudian-tool-link-icon' });
    setIcon(iconEl, 'external-link');

    linkEl.createSpan({ cls: 'claudian-tool-link-title', text: link.title });
  }

  if (parsed.summary) {
    const summaryEl = container.createDiv({ cls: 'claudian-tool-web-summary' });
    summaryEl.setText(parsed.summary.length > 800 ? parsed.summary.slice(0, 800) + '...' : parsed.summary);
  }
}

function renderFileSearchExpanded(container: HTMLElement, result: string): void {
  const lines = result.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    container.createDiv({ cls: 'claudian-tool-empty', text: 'No matches found' });
    return;
  }
  renderLinesExpanded(container, result, 15, true);
}

function renderLinesExpanded(
  container: HTMLElement,
  result: string,
  maxLines: number,
  hoverable = false
): void {
  const lines = result.split(/\r?\n/);
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;

  const linesEl = container.createDiv({ cls: 'claudian-tool-lines' });
  for (const line of displayLines) {
    const stripped = line.replace(/^\s*\d+→/, '');
    const lineEl = linesEl.createDiv({ cls: 'claudian-tool-line' });
    if (hoverable) lineEl.addClass('hoverable');
    lineEl.setText(stripped || ' ');
  }

  if (truncated) {
    linesEl.createDiv({
      cls: 'claudian-tool-truncated',
      text: `... ${lines.length - maxLines} more lines`,
    });
  }
}

function renderToolSearchExpanded(container: HTMLElement, result: string): void {
  let toolNames: string[] = [];
  try {
    const parsed = JSON.parse(result) as Array<{ type: string; tool_name: string }>;
    if (Array.isArray(parsed)) {
      toolNames = parsed
        .filter(item => item.type === 'tool_reference' && item.tool_name)
        .map(item => item.tool_name);
    }
  } catch {
    // Fall back to showing raw result
  }

  if (toolNames.length === 0) {
    renderLinesExpanded(container, result, 20);
    return;
  }

  for (const name of toolNames) {
    const lineEl = container.createDiv({ cls: 'claudian-tool-search-item' });
    const iconEl = lineEl.createSpan({ cls: 'claudian-tool-search-icon' });
    setToolIcon(iconEl, name);
    lineEl.createSpan({ text: name });
  }
}

function renderWebFetchExpanded(container: HTMLElement, result: string): void {
  const maxChars = 500;
  const linesEl = container.createDiv({ cls: 'claudian-tool-lines' });
  const lineEl = linesEl.createDiv({ cls: 'claudian-tool-line claudian-tool-line-wrap' });

  if (result.length > maxChars) {
    lineEl.setText(result.slice(0, maxChars));
    linesEl.createDiv({
      cls: 'claudian-tool-truncated',
      text: `... ${result.length - maxChars} more characters`,
    });
  } else {
    lineEl.setText(result);
  }
}

export function renderExpandedContent(
  container: HTMLElement,
  toolName: string,
  result: string | undefined,
  dndCopyAndSaveCallback?: CopyAndSaveCallback
): void {
  if (!result) {
    container.createDiv({ cls: 'claudian-tool-empty', text: 'No result' });
    return;
  }

  switch (toolName) {
    case TOOL_BASH:
      renderLinesExpanded(container, result, 20);
      break;
    case TOOL_READ:
      renderLinesExpanded(container, result, 15);
      break;
    case TOOL_GLOB:
    case TOOL_GREP:
    case TOOL_LS:
      renderFileSearchExpanded(container, result);
      break;
    case TOOL_WEB_SEARCH:
      renderWebSearchExpanded(container, result);
      break;
    case TOOL_WEB_FETCH:
      renderWebFetchExpanded(container, result);
      break;
    case TOOL_TOOL_SEARCH:
      renderToolSearchExpanded(container, result);
      break;
    default:
      renderLinesExpanded(container, result, 20);
      break;
  }
}

function getTodos(input: Record<string, unknown>): TodoItem[] | undefined {
  const todos = input.todos;
  if (!todos || !Array.isArray(todos)) return undefined;
  return todos as TodoItem[];
}

function getCurrentTask(input: Record<string, unknown>): TodoItem | undefined {
  const todos = getTodos(input);
  if (!todos) return undefined;
  return todos.find(t => t.status === 'in_progress');
}

function areAllTodosCompleted(input: Record<string, unknown>): boolean {
  const todos = getTodos(input);
  if (!todos || todos.length === 0) return false;
  return todos.every(t => t.status === 'completed');
}

function resetStatusElement(statusEl: HTMLElement, statusClass: string, ariaLabel: string): void {
  statusEl.className = 'claudian-tool-status';
  statusEl.empty();
  statusEl.addClass(statusClass);
  statusEl.setAttribute('aria-label', ariaLabel);
}

const STATUS_ICONS: Record<string, string> = {
  completed: 'check',
  error: 'x',
  blocked: 'shield-off',
};

function setTodoWriteStatus(statusEl: HTMLElement, input: Record<string, unknown>): void {
  const isComplete = areAllTodosCompleted(input);
  const status = isComplete ? 'completed' : 'running';
  const ariaLabel = isComplete ? 'Status: completed' : 'Status: in progress';
  resetStatusElement(statusEl, `status-${status}`, ariaLabel);
  if (isComplete) setIcon(statusEl, 'check');
}

function setToolStatus(statusEl: HTMLElement, status: ToolCallInfo['status']): void {
  resetStatusElement(statusEl, `status-${status}`, `Status: ${status}`);
  const icon = STATUS_ICONS[status];
  if (icon) setIcon(statusEl, icon);
}

export function renderTodoWriteResult(
  container: HTMLElement,
  input: Record<string, unknown>
): void {
  container.empty();
  container.addClass('claudian-todo-panel-content');
  container.addClass('claudian-todo-list-container');

  const todos = input.todos as TodoItem[] | undefined;
  if (!todos || !Array.isArray(todos)) {
    const item = container.createSpan({ cls: 'claudian-tool-result-item' });
    item.setText('Tasks updated');
    return;
  }

  renderTodoItems(container, todos);
}

export function isBlockedToolResult(content: string, isError?: boolean): boolean {
  const lower = content.toLowerCase();
  if (lower.includes('blocked by blocklist')) return true;
  if (lower.includes('outside the vault')) return true;
  if (lower.includes('access denied')) return true;
  if (lower.includes('user denied')) return true;
  if (lower.includes('approval')) return true;
  if (isError && lower.includes('deny')) return true;
  return false;
}

interface ToolElementStructure {
  toolEl: HTMLElement;
  header: HTMLElement;
  iconEl: HTMLElement;
  nameEl: HTMLElement;
  summaryEl: HTMLElement;
  statusEl: HTMLElement;
  content: HTMLElement;
  currentTaskEl: HTMLElement | null;
}

function createToolElementStructure(
  parentEl: HTMLElement,
  toolCall: ToolCallInfo
): ToolElementStructure {
  const toolEl = parentEl.createDiv({ cls: 'claudian-tool-call' });

  const header = toolEl.createDiv({ cls: 'claudian-tool-header' });
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');

  const iconEl = header.createSpan({ cls: 'claudian-tool-icon' });
  iconEl.setAttribute('aria-hidden', 'true');
  setToolIcon(iconEl, toolCall.name);

  const nameEl = header.createSpan({ cls: 'claudian-tool-name' });
  nameEl.setText(getToolName(toolCall.name, toolCall.input));

  const summaryEl = header.createSpan({ cls: 'claudian-tool-summary' });
  summaryEl.setText(getToolSummary(toolCall.name, toolCall.input));

  const currentTaskEl = toolCall.name === TOOL_TODO_WRITE
    ? createCurrentTaskPreview(header, toolCall.input)
    : null;

  const statusEl = header.createSpan({ cls: 'claudian-tool-status' });

  const content = toolEl.createDiv({ cls: 'claudian-tool-content' });

  return { toolEl, header, iconEl, nameEl, summaryEl, statusEl, content, currentTaskEl };
}

function formatAnswer(raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string') return raw;
  return '';
}

function resolveAskUserAnswers(toolCall: ToolCallInfo): Record<string, unknown> | undefined {
  if (toolCall.resolvedAnswers) return toolCall.resolvedAnswers;

  const parsed = extractResolvedAnswersFromResultText(toolCall.result);
  if (parsed) {
    toolCall.resolvedAnswers = parsed;
    return parsed;
  }

  return undefined;
}

function renderAskUserQuestionResult(container: HTMLElement, toolCall: ToolCallInfo): boolean {
  container.empty();
  const questions = toolCall.input.questions as Array<{ question: string }> | undefined;
  const answers = resolveAskUserAnswers(toolCall);
  if (!questions || !Array.isArray(questions) || !answers) return false;

  const reviewEl = container.createDiv({ cls: 'claudian-ask-review' });
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = formatAnswer(answers[q.question]);
    const pairEl = reviewEl.createDiv({ cls: 'claudian-ask-review-pair' });
    pairEl.createDiv({ text: `${i + 1}.`, cls: 'claudian-ask-review-num' });
    const bodyEl = pairEl.createDiv({ cls: 'claudian-ask-review-body' });
    bodyEl.createDiv({ text: q.question, cls: 'claudian-ask-review-q-text' });
    bodyEl.createDiv({
      text: answer || 'Not answered',
      cls: answer ? 'claudian-ask-review-a-text' : 'claudian-ask-review-empty',
    });
  }

  return true;
}

function renderAskUserQuestionFallback(container: HTMLElement, toolCall: ToolCallInfo, initialText?: string): void {
  contentFallback(container, initialText || toolCall.result || 'Waiting for answer...');
}

function contentFallback(container: HTMLElement, text: string): void {
  const resultRow = container.createDiv({ cls: 'claudian-tool-result-row' });
  const resultText = resultRow.createSpan({ cls: 'claudian-tool-result-text' });
  resultText.setText(text);
}

function createCurrentTaskPreview(
  header: HTMLElement,
  input: Record<string, unknown>
): HTMLElement {
  const currentTaskEl = header.createSpan({ cls: 'claudian-tool-current' });
  const currentTask = getCurrentTask(input);
  if (currentTask) {
    currentTaskEl.setText(currentTask.activeForm);
  }
  return currentTaskEl;
}

function createTodoToggleHandler(
  currentTaskEl: HTMLElement | null,
  statusEl: HTMLElement | null,
  onExpandChange?: (expanded: boolean) => void
): (expanded: boolean) => void {
  return (expanded: boolean) => {
    if (onExpandChange) onExpandChange(expanded);
    if (currentTaskEl) {
      currentTaskEl.style.display = expanded ? 'none' : '';
    }
    if (statusEl) {
      statusEl.style.display = expanded ? 'none' : '';
    }
  };
}

function renderToolContent(
  content: HTMLElement,
  toolCall: ToolCallInfo,
  initialText?: string,
  dndCopyAndSaveCallback?: CopyAndSaveCallback
): void {
  if (toolCall.name === TOOL_TODO_WRITE) {
    content.addClass('claudian-tool-content-todo');
    renderTodoWriteResult(content, toolCall.input);
  } else if (toolCall.name === TOOL_ASK_USER_QUESTION) {
    content.addClass('claudian-tool-content-ask');
    if (initialText) {
      renderAskUserQuestionFallback(content, toolCall, 'Waiting for answer...');
    } else if (!renderAskUserQuestionResult(content, toolCall)) {
      renderAskUserQuestionFallback(content, toolCall);
    }
  } else if (initialText) {
    contentFallback(content, initialText);
  } else {
    renderExpandedContent(content, toolCall.name, toolCall.result, dndCopyAndSaveCallback);
  }
}

export function renderToolCall(
  parentEl: HTMLElement,
  toolCall: ToolCallInfo,
  toolCallElements: Map<string, HTMLElement>,
  dndCopyAndSaveCallback?: CopyAndSaveCallback
): HTMLElement {
  const { toolEl, header, statusEl, content, currentTaskEl } =
    createToolElementStructure(parentEl, toolCall);

  toolEl.dataset.toolId = toolCall.id;
  toolCallElements.set(toolCall.id, toolEl);

  statusEl.addClass(`status-${toolCall.status}`);
  statusEl.setAttribute('aria-label', `Status: ${toolCall.status}`);

  renderToolContent(content, toolCall, 'Running...', dndCopyAndSaveCallback);

  const state = { isExpanded: false };
  toolCall.isExpanded = false;
  const todoStatusEl = toolCall.name === TOOL_TODO_WRITE ? statusEl : null;
  setupCollapsible(toolEl, header, content, state, {
    initiallyExpanded: false,
    onToggle: createTodoToggleHandler(currentTaskEl, todoStatusEl, (expanded) => {
      toolCall.isExpanded = expanded;
    }),
    baseAriaLabel: getToolLabel(toolCall.name, toolCall.input)
  });

  return toolEl;
}

export function updateToolCallResult(
  toolId: string,
  toolCall: ToolCallInfo,
  toolCallElements: Map<string, HTMLElement>,
  dndCopyAndSaveCallback?: CopyAndSaveCallback
) {
  const toolEl = toolCallElements.get(toolId);
  if (!toolEl) return;

  if (toolCall.name === TOOL_TODO_WRITE) {
    const statusEl = toolEl.querySelector('.claudian-tool-status') as HTMLElement;
    if (statusEl) {
      setTodoWriteStatus(statusEl, toolCall.input);
    }
    const content = toolEl.querySelector('.claudian-tool-content') as HTMLElement;
    if (content) {
      renderTodoWriteResult(content, toolCall.input);
    }
    const nameEl = toolEl.querySelector('.claudian-tool-name') as HTMLElement;
    if (nameEl) {
      nameEl.setText(getToolName(toolCall.name, toolCall.input));
    }
    const currentTaskEl = toolEl.querySelector('.claudian-tool-current') as HTMLElement;
    if (currentTaskEl) {
      const currentTask = getCurrentTask(toolCall.input);
      currentTaskEl.setText(currentTask ? currentTask.activeForm : '');
    }
    return;
  }

  const statusEl = toolEl.querySelector('.claudian-tool-status') as HTMLElement;
  if (statusEl) {
    setToolStatus(statusEl, toolCall.status);
  }

  if (toolCall.name === TOOL_ASK_USER_QUESTION) {
    const content = toolEl.querySelector('.claudian-tool-content') as HTMLElement;
    if (content) {
      content.addClass('claudian-tool-content-ask');
      if (!renderAskUserQuestionResult(content, toolCall)) {
        renderAskUserQuestionFallback(content, toolCall);
      }
    }
    return;
  }

  const content = toolEl.querySelector('.claudian-tool-content') as HTMLElement;
  if (content) {
    content.empty();
    renderExpandedContent(content, toolCall.name, toolCall.result, dndCopyAndSaveCallback);
  }
}

/**
 * Renders a D&D entity stat block as a SIBLING element after the tool call block.
 * Returns true if it rendered, false otherwise.
 */
export function renderDndEntityAfterToolCall(
  parentEl: HTMLElement,
  toolCall: ToolCallInfo,
  dndCopyAndSaveCallback?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
  dndUpdateCallback?: UpdateEntityCallback,
): boolean {
  const entityType = getDndEntityType(toolCall.name);
  if (!entityType || !toolCall.result) return false;

  try {
    const parsed: unknown = JSON.parse(toolCall.result);
    if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data) {
      const yamlStr = yaml.dump(parsed.data);
      const fenceResult = parseDndCodeFence(entityType, yamlStr);
      if (fenceResult) {
        renderDndEntityBlock(parentEl, fenceResult, dndCopyAndSaveCallback, entityRegistry, app, dndUpdateCallback);
        return true;
      }
    }
  } catch { /* fall through */ }

  return false;
}

/** For stored (non-streaming) tool calls — collapsed by default. */
export function renderStoredToolCall(
  parentEl: HTMLElement,
  toolCall: ToolCallInfo,
  dndCopyAndSaveCallback?: CopyAndSaveCallback
): HTMLElement {
  const { toolEl, header, statusEl, content, currentTaskEl } =
    createToolElementStructure(parentEl, toolCall);

  if (toolCall.name === TOOL_TODO_WRITE) {
    setTodoWriteStatus(statusEl, toolCall.input);
  } else {
    setToolStatus(statusEl, toolCall.status);
  }

  renderToolContent(content, toolCall, undefined, dndCopyAndSaveCallback);

  const state = { isExpanded: false };
  const todoStatusEl = toolCall.name === TOOL_TODO_WRITE ? statusEl : null;
  setupCollapsible(toolEl, header, content, state, {
    initiallyExpanded: false,
    onToggle: createTodoToggleHandler(currentTaskEl, todoStatusEl),
    baseAriaLabel: getToolLabel(toolCall.name, toolCall.input)
  });

  return toolEl;
}
