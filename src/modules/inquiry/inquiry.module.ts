// TODO(phase0-task12): CoreAPI.plugin typing will flow through once main.ts wires modules
import type { ArchivistModule, CoreAPI } from "../../core/module-api";
import { InquiryModule } from "./InquiryModule";

export class InquiryArchivistModule implements ArchivistModule {
  readonly id = "inquiry";
  // No entityType, no codeBlockType — inquiry has no entity/code block
  private inquiry: InquiryModule | null = null;

  register(_core: CoreAPI): void {
    // Task 12 will wire plugin/app/entities/srd properly.
    // For now this method type-checks but isn't called.
  }

  async destroy(): Promise<void> {
    await this.inquiry?.destroy?.();
  }
}
