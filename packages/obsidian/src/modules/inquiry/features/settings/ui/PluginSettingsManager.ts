import { Notice, setIcon } from 'obsidian';

import type { ClaudianPlugin as ClaudianPluginType } from '../../../core/types';
import type InquiryModule from '../../../InquiryModule';

export class PluginSettingsManager {
  private containerEl: HTMLElement;
  private plugin: InquiryModule;

  constructor(containerEl: HTMLElement, plugin: InquiryModule) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.render();
  }

  private render() {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: 'claudian-plugin-header' });
    headerEl.createSpan({ text: 'Claude Code Plugins', cls: 'claudian-plugin-label' });

    const refreshBtn = headerEl.createEl('button', {
      cls: 'claudian-settings-action-btn',
      attr: { 'aria-label': 'Refresh' },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => { void this.refreshPlugins(); });

    const plugins = this.plugin.pluginManager.getPlugins();

    if (plugins.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'claudian-plugin-empty' });
      emptyEl.setText('No plugins found.');
      return;
    }

    const projectPlugins = plugins.filter(p => p.scope === 'project');
    const userPlugins = plugins.filter(p => p.scope === 'user');

    const listEl = this.containerEl.createDiv({ cls: 'claudian-plugin-list' });

    if (projectPlugins.length > 0) {
      const sectionHeader = listEl.createDiv({ cls: 'claudian-plugin-section-header' });
      sectionHeader.setText('Project plugins');

      for (const plugin of projectPlugins) {
        this.renderPluginItem(listEl, plugin);
      }
    }

    if (userPlugins.length > 0) {
      const sectionHeader = listEl.createDiv({ cls: 'claudian-plugin-section-header' });
      sectionHeader.setText('User plugins');

      for (const plugin of userPlugins) {
        this.renderPluginItem(listEl, plugin);
      }
    }
  }

  private renderPluginItem(listEl: HTMLElement, plugin: ClaudianPluginType) {
    const itemEl = listEl.createDiv({ cls: 'claudian-plugin-item' });
    if (!plugin.enabled) {
      itemEl.addClass('claudian-plugin-item-disabled');
    }

    const statusEl = itemEl.createDiv({ cls: 'claudian-plugin-status' });
    if (plugin.enabled) {
      statusEl.addClass('claudian-plugin-status-enabled');
    } else {
      statusEl.addClass('claudian-plugin-status-disabled');
    }

    const infoEl = itemEl.createDiv({ cls: 'claudian-plugin-info' });

    const nameRow = infoEl.createDiv({ cls: 'claudian-plugin-name-row' });

    const nameEl = nameRow.createSpan({ cls: 'claudian-plugin-name' });
    nameEl.setText(plugin.name);

    const actionsEl = itemEl.createDiv({ cls: 'claudian-plugin-actions' });

    const toggleBtn = actionsEl.createEl('button', {
      cls: 'claudian-plugin-action-btn',
      attr: { 'aria-label': plugin.enabled ? 'Disable' : 'Enable' },
    });
    setIcon(toggleBtn, plugin.enabled ? 'toggle-right' : 'toggle-left');
    toggleBtn.addEventListener('click', () => { void this.togglePlugin(plugin.id); });
  }

  private async togglePlugin(pluginId: string) {
    const plugin = this.plugin.pluginManager.getPlugins().find(p => p.id === pluginId);
    const wasEnabled = plugin?.enabled ?? false;

    try {
      await this.plugin.pluginManager.togglePlugin(pluginId);
      await this.plugin.agentManager.loadAgents();

      const view = this.plugin.getView();
      const tabManager = view?.getTabManager();
      if (tabManager) {
        try {
          await tabManager.broadcastToAllTabs(
            async (service) => { await service.ensureReady({ force: true }); }
          );
        } catch {
          new Notice('Plugin toggled, but some tabs failed to restart.');
        }
      }

      new Notice(`Plugin "${pluginId}" ${wasEnabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      await this.plugin.pluginManager.togglePlugin(pluginId);
      const message = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Failed to toggle plugin: ${message}`);
    } finally {
      this.render();
    }
  }

  private async refreshPlugins() {
    try {
      await this.plugin.pluginManager.loadPlugins();
      await this.plugin.agentManager.loadAgents();

      new Notice('Plugin list refreshed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Failed to refresh plugins: ${message}`);
    } finally {
      this.render();
    }
  }

  public refresh() {
    this.render();
  }
}
