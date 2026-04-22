import type { Plugin } from "obsidian";
import type { ArchivistModule, CoreAPI } from "../../core/module-api";
import { InquiryModule } from "./InquiryModule";

export class InquiryArchivistModule implements ArchivistModule {
  readonly id = "inquiry";
  // No entityType, no codeBlockType — inquiry has no entity/code block
  private inquiry: InquiryModule | null = null;

  register(core: CoreAPI): void {
    // TODO(phase0-task13): narrow core.plugin typing (currently `unknown`).
    // InquiryModule accepts any `Plugin` instance for Obsidian-API delegation;
    // the concrete host plugin shape is only consulted via soft optional fields
    // (see ArchivistHostPlugin inside InquiryModule.ts).
    const plugin = core.plugin as Plugin;
    this.inquiry = new InquiryModule(plugin, plugin.app, core.entities, core.srd);
  }

  /** Access the underlying InquiryModule instance (present after register()). */
  getInquiry(): InquiryModule | null {
    return this.inquiry;
  }

  async destroy(): Promise<void> {
    await this.inquiry?.destroy?.();
  }
}
