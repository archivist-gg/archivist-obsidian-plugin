/**
 * Minimal write surface the generators package needs to create compendia.
 *
 * This decouples `@archivist/generators` from the obsidian-layer
 * `CompendiumManager`: the obsidian layer supplies an implementation (the
 * manager is structurally close, but its `readonly` param is required, so the
 * caller passes a thin adapter).
 *
 * The 4-arg shape mirrors the real `CompendiumManager.create`; the return is
 * `Promise<unknown>` so the manager's `Promise<Compendium>` is assignable.
 */
export interface CompendiumWritePort {
  create(
    name: string,
    description: string,
    homebrew: boolean,
    isReadonly?: boolean,
  ): Promise<unknown>;
}
