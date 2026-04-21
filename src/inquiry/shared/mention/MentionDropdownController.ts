import type { TFile } from 'obsidian';
import { setIcon } from 'obsidian';

import { buildExternalContextDisplayEntries } from '../../utils/externalContext';
import { type ExternalContextFile, externalContextScanner } from '../../utils/externalContextScanner';
import { extractMcpMentions } from '../../utils/mcp';
import { SelectableDropdown } from '../components/SelectableDropdown';
import { appendSvg, MCP_ICON_SVG } from '../icons';
import {
  type AgentMentionProvider,
  type FolderMentionItem,
  type MentionItem,
} from './types';

export type { AgentMentionProvider };

export interface MentionDropdownOptions {
  fixed?: boolean;
}

export interface MentionDropdownCallbacks {
  onAttachFile: (path: string) => void;
  onMcpMentionChange?: (servers: Set<string>) => void;
  onAgentMentionSelect?: (agentId: string) => void;
  getMentionedMcpServers: () => Set<string>;
  setMentionedMcpServers: (mentions: Set<string>) => boolean;
  addMentionedMcpServer: (name: string) => void;
  getExternalContexts: () => string[];
  getCachedVaultFolders: () => Array<Pick<FolderMentionItem, 'name' | 'path'>>;
  getCachedVaultFiles: () => TFile[];
  normalizePathForVault: (path: string | undefined | null) => string | null;
}

export interface McpMentionProvider {
  getContextSavingServers: () => Array<{ name: string }>;
}

/** Minimal structural shape of EntityRegistry the mention dropdown needs. */
interface EntityRegistryEntry {
  slug: string;
  name: string;
  entityType: string;
  source: string;
}

interface EntityRegistryLike {
  search(query: string): EntityRegistryEntry[];
}

/**
 * Minimal interface for input elements the mention dropdown can work with.
 * Works with both HTMLTextAreaElement/HTMLInputElement and RichInput.
 */
export interface MentionInputLike {
  /** The underlying DOM element. */
  readonly el: HTMLElement;
  /** Get text before cursor. */
  getTextBeforeCursor(): string;
  /** Remove count characters before cursor. */
  removeTextBeforeCursor(count: number): void;
  /** Get plain text value. */
  readonly value: string;
  /** Focus the input. */
  focus(): void;
  /** Insert a file chip (optional, only for RichInput). */
  insertFileChip?(path: string, displayName: string): void;
  /** Insert a mention chip (optional, only for RichInput). */
  insertMentionChip?(id: string, displayName: string, icon: string, chipType: 'mcp' | 'agent'): void;
}

/**
 * Wraps a standard HTMLTextAreaElement or HTMLInputElement as a MentionInputLike.
 */
export function wrapNativeInput(inputEl: HTMLTextAreaElement | HTMLInputElement): MentionInputLike {
  return {
    get el() { return inputEl; },
    getTextBeforeCursor() {
      const pos = inputEl.selectionStart || 0;
      return inputEl.value.substring(0, pos);
    },
    removeTextBeforeCursor(count: number) {
      const pos = inputEl.selectionStart || 0;
      const text = inputEl.value;
      inputEl.value = text.substring(0, pos - count) + text.substring(pos);
      inputEl.selectionStart = inputEl.selectionEnd = pos - count;
    },
    get value() { return inputEl.value; },
    focus() { inputEl.focus(); },
  };
}

export class MentionDropdownController {
  private containerEl: HTMLElement;
  private input: MentionInputLike;
  private callbacks: MentionDropdownCallbacks;
  private dropdown: SelectableDropdown<MentionItem>;
  private mentionStartIndex = -1;
  private selectedMentionIndex = 0;
  private filteredMentionItems: MentionItem[] = [];
  private filteredContextFiles: ExternalContextFile[] = [];
  private activeContextFilter: { folderName: string; contextRoot: string } | null = null;
  private activeAgentFilter = false;
  private mcpManager: McpMentionProvider | null = null;
  private agentService: AgentMentionProvider | null = null;
  private entityRegistry: EntityRegistryLike | null = null;
  private fixed: boolean;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    containerEl: HTMLElement,
    input: MentionInputLike,
    callbacks: MentionDropdownCallbacks,
    options: MentionDropdownOptions = {}
  ) {
    this.containerEl = containerEl;
    this.input = input;
    this.callbacks = callbacks;
    this.fixed = options.fixed ?? false;

    this.dropdown = new SelectableDropdown<MentionItem>(this.containerEl, {
      listClassName: 'claudian-mention-dropdown',
      itemClassName: 'claudian-mention-item',
      emptyClassName: 'claudian-mention-empty',
      fixed: this.fixed,
      fixedClassName: 'claudian-mention-dropdown-fixed',
    });
  }

  setMcpManager(manager: McpMentionProvider | null): void {
    this.mcpManager = manager;
  }

  setAgentService(service: AgentMentionProvider | null): void {
    this.agentService = service;
  }

  setEntityRegistry(registry: EntityRegistryLike | null): void {
    this.entityRegistry = registry;
  }

  preScanExternalContexts(): void {
    const externalContexts = this.callbacks.getExternalContexts() || [];
    if (externalContexts.length === 0) return;

    setTimeout(() => {
      try {
        externalContextScanner.scanPaths(externalContexts);
      } catch {
        // Pre-scan is best-effort, ignore failures
      }
    }, 0);
  }

  isVisible(): boolean {
    return this.dropdown.isVisible();
  }

  hide(): void {
    this.dropdown.hide();
    this.mentionStartIndex = -1;
  }

  containsElement(el: Node): boolean {
    return this.dropdown.getElement()?.contains(el) ?? false;
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.dropdown.destroy();
  }

  updateMcpMentionsFromText(text: string): void {
    if (!this.mcpManager) return;

    const validNames = new Set(
      this.mcpManager.getContextSavingServers().map(s => s.name)
    );

    const newMentions = extractMcpMentions(text, validNames);
    const changed = this.callbacks.setMentionedMcpServers(newMentions);

    if (changed) {
      this.callbacks.onMcpMentionChange?.(newMentions);
    }
  }

  handleInputChange(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const text = this.input.value;
      this.updateMcpMentionsFromText(text);

      const textBeforeCursor = this.input.getTextBeforeCursor();
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex === -1) {
        this.hide();
        return;
      }

      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (!/\s/.test(charBeforeAt) && lastAtIndex !== 0) {
        this.hide();
        return;
      }

      const searchText = textBeforeCursor.substring(lastAtIndex + 1);

      if (/\s/.test(searchText)) {
        this.hide();
        return;
      }

      this.mentionStartIndex = lastAtIndex;
      this.showMentionDropdown(searchText);
    }, 200);
  }

  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.dropdown.isVisible()) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.dropdown.moveSelection(1);
      this.selectedMentionIndex = this.dropdown.getSelectedIndex();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.dropdown.moveSelection(-1);
      this.selectedMentionIndex = this.dropdown.getSelectedIndex();
      return true;
    }
    // Check !e.isComposing for IME support (Chinese, Japanese, Korean, etc.)
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing) {
      e.preventDefault();
      this.selectMentionItem();
      return true;
    }
    if (e.key === 'Escape' && !e.isComposing) {
      e.preventDefault();
      // If in secondary menu, return to first level instead of closing
      if (this.activeContextFilter || this.activeAgentFilter) {
        this.returnToFirstLevel();
        return true;
      }
      this.hide();
      return true;
    }

    return false;
  }

  private showMentionDropdown(searchText: string): void {
    const searchLower = searchText.toLowerCase();
    this.filteredMentionItems = [];
    this.filteredContextFiles = [];

    const externalContexts = this.callbacks.getExternalContexts() || [];
    const contextEntries = buildExternalContextDisplayEntries(externalContexts);

    const isFilterSearch = searchText.includes('/');
    let fileSearchText = searchLower;

    if (isFilterSearch && searchLower.startsWith('agents/')) {
      this.activeAgentFilter = true;
      this.activeContextFilter = null;
      const agentSearchText = searchText.substring('agents/'.length).toLowerCase();

      if (this.agentService) {
        const matchingAgents = this.agentService.searchAgents(agentSearchText);
        for (const agent of matchingAgents) {
          this.filteredMentionItems.push({
            type: 'agent',
            id: agent.id,
            name: agent.name,
            description: agent.description,
            source: agent.source,
          });
        }
      }

      this.selectedMentionIndex = 0;
      this.renderMentionDropdown();
      return;
    }

    if (isFilterSearch) {
      const matchingContext = contextEntries
        .filter(entry => searchLower.startsWith(`${entry.displayNameLower}/`))
        .sort((a, b) => b.displayNameLower.length - a.displayNameLower.length)[0];

      if (matchingContext) {
        const prefixLength = matchingContext.displayName.length + 1;
        fileSearchText = searchText.substring(prefixLength).toLowerCase();
        this.activeContextFilter = {
          folderName: matchingContext.displayName,
          contextRoot: matchingContext.contextRoot,
        };
      } else {
        this.activeContextFilter = null;
      }
    }

    if (this.activeContextFilter && isFilterSearch) {
      const contextFiles = externalContextScanner.scanPaths([this.activeContextFilter.contextRoot]);
      this.filteredContextFiles = contextFiles
        .filter(file => {
          const relativePath = file.relativePath.replace(/\\/g, '/');
          const pathLower = relativePath.toLowerCase();
          const nameLower = file.name.toLowerCase();
          return pathLower.includes(fileSearchText) || nameLower.includes(fileSearchText);
        })
        .sort((a, b) => {
          const aNameMatch = a.name.toLowerCase().startsWith(fileSearchText);
          const bNameMatch = b.name.toLowerCase().startsWith(fileSearchText);
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
          return b.mtime - a.mtime;
        });

      for (const file of this.filteredContextFiles) {
        const relativePath = file.relativePath.replace(/\\/g, '/');
        this.filteredMentionItems.push({
          type: 'context-file',
          name: relativePath,
          absolutePath: file.path,
          contextRoot: file.contextRoot,
          folderName: this.activeContextFilter.folderName,
        });
      }

      const firstVaultItemIndex = this.filteredMentionItems.length;
      const vaultItemCount = this.appendVaultItems(searchLower);

      if (this.filteredContextFiles.length === 0 && vaultItemCount > 0) {
        this.selectedMentionIndex = firstVaultItemIndex;
      } else {
        this.selectedMentionIndex = 0;
      }

      this.renderMentionDropdown();
      return;
    }

    this.activeContextFilter = null;
    this.activeAgentFilter = false;

    if (this.mcpManager) {
      const mcpServers = this.mcpManager.getContextSavingServers();

      for (const server of mcpServers) {
        if (server.name.toLowerCase().includes(searchLower)) {
          this.filteredMentionItems.push({
            type: 'mcp-server',
            name: server.name,
          });
        }
      }
    }

    if (this.agentService) {
      const hasAgents = this.agentService.searchAgents('').length > 0;
      if (hasAgents && 'agents'.includes(searchLower)) {
        this.filteredMentionItems.push({
          type: 'agent-folder',
          name: 'Agents',
        });
      }
    }

    if (contextEntries.length > 0) {
      const matchingFolders = new Set<string>();
      for (const entry of contextEntries) {
        if (entry.displayNameLower.includes(searchLower) && !matchingFolders.has(entry.displayName)) {
          matchingFolders.add(entry.displayName);
          this.filteredMentionItems.push({
            type: 'context-folder',
            name: entry.displayName,
            contextRoot: entry.contextRoot,
            folderName: entry.displayName,
          });
        }
      }
    }

    const firstVaultItemIndex = this.filteredMentionItems.length;
    const vaultItemCount = this.appendVaultItems(searchLower);

    if (this.entityRegistry) {
      const entities = this.entityRegistry.search(searchLower);
      for (const entity of entities.slice(0, 10)) {
        this.filteredMentionItems.push({
          type: 'entity',
          name: entity.name,
          entityType: entity.entityType,
          slug: entity.slug,
          source: entity.source,
        });
      }
    }

    this.selectedMentionIndex = vaultItemCount > 0 ? firstVaultItemIndex : 0;

    this.renderMentionDropdown();
  }

  private appendVaultItems(searchLower: string): number {
    type ScoredItem =
      | { type: 'folder'; name: string; path: string; startsWithQuery: boolean; mtime: number }
      | { type: 'file'; name: string; path: string; file: TFile; startsWithQuery: boolean; mtime: number };

    const compare = (a: ScoredItem, b: ScoredItem): number => {
      if (a.startsWithQuery !== b.startsWithQuery) return a.startsWithQuery ? -1 : 1;
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      if (a.type !== b.type) return a.type === 'file' ? -1 : 1;
      return a.path.localeCompare(b.path);
    };

    const allFiles = this.callbacks.getCachedVaultFiles();

    // Derive folder mtime from the most recently modified file within each folder
    const folderMtimeMap = new Map<string, number>();
    for (const f of allFiles) {
      const parts = f.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        const existing = folderMtimeMap.get(folderPath) ?? 0;
        if (f.stat.mtime > existing) {
          folderMtimeMap.set(folderPath, f.stat.mtime);
        }
      }
    }

    const scoredFolders: ScoredItem[] = this.callbacks.getCachedVaultFolders()
      .map(f => ({
        name: f.name,
        path: f.path.replace(/\\/g, '/').replace(/\/+$/, ''),
      }))
      .filter(f =>
        f.path.length > 0 &&
        (f.path.toLowerCase().includes(searchLower) || f.name.toLowerCase().includes(searchLower))
      )
      .map(f => ({
        type: 'folder' as const,
        name: f.name,
        path: f.path,
        startsWithQuery: f.name.toLowerCase().startsWith(searchLower),
        mtime: folderMtimeMap.get(f.path) ?? 0,
      }))
      .sort(compare)
      .slice(0, 50);

    const scoredFiles: ScoredItem[] = allFiles
      .filter(f =>
        f.path.toLowerCase().includes(searchLower) || f.name.toLowerCase().includes(searchLower)
      )
      .map(f => ({
        type: 'file' as const,
        name: f.name,
        path: f.path,
        file: f,
        startsWithQuery: f.name.toLowerCase().startsWith(searchLower),
        mtime: f.stat.mtime,
      }))
      .sort(compare)
      .slice(0, 100);

    const merged = [...scoredFolders, ...scoredFiles].sort(compare);

    for (const item of merged) {
      if (item.type === 'folder') {
        this.filteredMentionItems.push({ type: 'folder', name: item.name, path: item.path });
      } else {
        this.filteredMentionItems.push({ type: 'file', name: item.name, path: item.path, file: item.file });
      }
    }

    return merged.length;
  }

  private renderMentionDropdown(): void {
    this.dropdown.render({
      items: this.filteredMentionItems,
      selectedIndex: this.selectedMentionIndex,
      emptyText: 'No matches',
      getItemClass: (item) => {
        switch (item.type) {
          case 'mcp-server': return 'mcp-server';
          case 'folder': return 'vault-folder';
          case 'agent': return 'agent';
          case 'agent-folder': return 'agent-folder';
          case 'context-file': return 'context-file';
          case 'context-folder': return 'context-folder';
          case 'entity': return 'entity';
          default: return undefined;
        }
      },
      renderItem: (item, itemEl) => {
        const iconEl = itemEl.createSpan({ cls: 'claudian-mention-icon' });
        switch (item.type) {
          case 'mcp-server':
            appendSvg(iconEl, MCP_ICON_SVG);
            break;
          case 'agent':
          case 'agent-folder':
            setIcon(iconEl, 'bot');
            break;
          case 'context-file':
            setIcon(iconEl, 'folder-open');
            break;
          case 'entity':
            setIcon(iconEl, 'scroll-text');
            break;
          case 'folder':
          case 'context-folder':
            setIcon(iconEl, 'folder');
            break;
          default:
            setIcon(iconEl, 'file-text');
        }

        const textEl = itemEl.createSpan({ cls: 'claudian-mention-text' });

        switch (item.type) {
          case 'mcp-server':
            textEl.createSpan({ cls: 'claudian-mention-name' }).setText(`@${item.name}`);
            break;
          case 'agent-folder':
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-agent-folder',
            }).setText(`@${item.name}/`);
            break;
          case 'agent': {
            // Show ID (which is namespaced for plugin agents) for consistency with inserted text
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-agent',
            }).setText(`@${item.id}`);
            if (item.description) {
              textEl.createSpan({ cls: 'claudian-mention-agent-desc' }).setText(item.description);
            }
            break;
          }
          case 'context-folder':
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-folder',
            }).setText(`@${item.name}/`);
            break;
          case 'context-file':
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-context',
            }).setText(item.name);
            break;
          case 'entity':
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-entity',
            }).setText(`@${item.name}`);
            textEl.createSpan({ cls: 'claudian-mention-entity-type' }).setText(item.entityType);
            break;
          case 'folder':
            textEl.createSpan({
              cls: 'claudian-mention-name claudian-mention-name-folder',
            }).setText(`@${item.path}/`);
            break;
          default:
            textEl.createSpan({ cls: 'claudian-mention-path' }).setText(item.path || item.name);
        }
      },
      onItemClick: (item, index, e) => {
        // Stop propagation for folder items to prevent document click handler
        // from hiding dropdown (since dropdown is re-rendered with new DOM)
        if (item.type === 'context-folder' || item.type === 'agent-folder') {
          e.stopPropagation();
        }
        this.selectedMentionIndex = index;
        this.selectMentionItem();
      },
      onItemHover: (_item, index) => {
        this.selectedMentionIndex = index;
      },
    });

    if (this.fixed) {
      this.positionFixed();
    }
  }

  private positionFixed(): void {
    const dropdownEl = this.dropdown.getElement();
    if (!dropdownEl) return;

    const inputRect = this.input.el.getBoundingClientRect();
    dropdownEl.addClass('claudian-mention-dropdown-fixed');
    dropdownEl.style.bottom = `${window.innerHeight - inputRect.top + 4}px`;
    dropdownEl.style.left = `${inputRect.left}px`;
    dropdownEl.style.width = `${Math.max(inputRect.width, 280)}px`;
  }

  /**
   * Remove the @query text from cursor back to the mention start,
   * then optionally insert replacement text.
   */
  private replaceAtMention(replacement: string): void {
    const textBeforeCursor = this.input.getTextBeforeCursor();
    const charsToRemove = textBeforeCursor.length - this.mentionStartIndex;
    this.input.removeTextBeforeCursor(charsToRemove);
    if (replacement) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- only reliable way to insert text while preserving undo stack in contenteditable inputs
      document.execCommand('insertText', false, replacement);
    }
  }

  private returnToFirstLevel(): void {
    // Remove everything from @... to cursor, then re-insert just @
    const textBeforeCursor = this.input.getTextBeforeCursor();
    const charsToRemove = textBeforeCursor.length - this.mentionStartIndex;
    this.input.removeTextBeforeCursor(charsToRemove);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- only reliable way to insert text while preserving undo stack in contenteditable inputs
    document.execCommand('insertText', false, '@');

    this.activeContextFilter = null;
    this.activeAgentFilter = false;

    this.showMentionDropdown('');
  }

  private selectMentionItem(): void {
    if (this.filteredMentionItems.length === 0) return;

    const selectedIndex = this.dropdown.getSelectedIndex();
    this.selectedMentionIndex = selectedIndex;
    const selectedItem = this.filteredMentionItems[selectedIndex];
    if (!selectedItem) return;

    switch (selectedItem.type) {
      case 'mcp-server': {
        if (this.input.insertMentionChip) {
          // Insert inline MCP chip
          this.replaceAtMention('');
          this.input.insertMentionChip(selectedItem.name, `@${selectedItem.name}`, 'server', 'mcp');
        } else {
          this.replaceAtMention(`@${selectedItem.name} `);
        }
        this.callbacks.addMentionedMcpServer(selectedItem.name);
        this.callbacks.onMcpMentionChange?.(this.callbacks.getMentionedMcpServers());
        break;
      }
      case 'agent-folder':
        // Don't modify input text - just show agents submenu
        this.activeAgentFilter = true;
        this.input.focus();
        this.showMentionDropdown('Agents/');
        return;
      case 'agent': {
        if (this.input.insertMentionChip) {
          // Insert inline agent chip
          this.replaceAtMention('');
          this.input.insertMentionChip(selectedItem.id, `@${selectedItem.id}`, 'bot', 'agent');
        } else {
          this.replaceAtMention(`@${selectedItem.id} (agent) `);
        }
        this.callbacks.onAgentMentionSelect?.(selectedItem.id);
        break;
      }
      case 'entity': {
        this.replaceAtMention(`@${selectedItem.name} `);
        break;
      }
      case 'context-folder': {
        this.replaceAtMention(`@${selectedItem.name}/`);
        this.input.focus();
        this.handleInputChange();
        return;
      }
      case 'context-file': {
        if (selectedItem.absolutePath) {
          this.callbacks.onAttachFile(selectedItem.absolutePath);
        }
        if (this.input.insertFileChip && selectedItem.absolutePath) {
          // Insert inline file chip
          const displayName = selectedItem.folderName
            ? `${selectedItem.folderName}/${selectedItem.name}`
            : selectedItem.name;
          this.replaceAtMention('');
          this.input.insertFileChip(selectedItem.absolutePath, displayName);
        } else {
          // Remove @mention text -- file chip above represents it
          this.replaceAtMention('');
        }
        break;
      }
      case 'folder': {
        const normalizedPath = this.callbacks.normalizePathForVault(selectedItem.path);
        this.replaceAtMention(`@${normalizedPath ?? selectedItem.path}/ `);
        break;
      }
      default: {
        const rawPath = selectedItem.file?.path ?? selectedItem.path;
        const normalizedPath = this.callbacks.normalizePathForVault(rawPath);
        if (normalizedPath) {
          this.callbacks.onAttachFile(normalizedPath);
          if (this.input.insertFileChip) {
            // Insert inline file chip
            this.replaceAtMention('');
            this.input.insertFileChip(normalizedPath, selectedItem.name);
          } else {
            // Remove @mention text -- file chip above represents it
            this.replaceAtMention('');
          }
        } else {
          this.replaceAtMention(`@${selectedItem.name} `);
        }
        break;
      }
    }

    this.hide();
    this.input.focus();
  }
}
