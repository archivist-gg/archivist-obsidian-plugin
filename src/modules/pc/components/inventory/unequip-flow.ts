import type { App } from "obsidian";
import type { CharacterEditState } from "../../pc.edit-state";
import type { EquipmentEntry } from "../../pc.types";
import { confirm as confirmModal } from "../../../inquiry/shared/modals/ConfirmModal";

/**
 * Unequip an item, asking the user to also unattune if it's currently attuned.
 *
 * Why: SRD-wise, attunement requires keeping the item on you / wearing it; once
 * you unequip, attunement should not silently persist. We confirm because losing
 * attunement state can be undesirable (some items are hard to re-attune within
 * a session, and the slot count budget is tight).
 *
 * On confirm: unattune THEN unequip — two `onChange` fires, but the visible
 * state ends consistent and the toggle's `.on` class clears (since both
 * `attuned` and `equipped` are false).
 *
 * On cancel: no-op. The toggle remains lit.
 *
 * Non-attuned items unequip immediately without prompting.
 */
export async function unequipWithAttunementCheck(
  app: App,
  editState: CharacterEditState,
  entry: EquipmentEntry,
  index: number,
): Promise<void> {
  if (!entry.attuned) {
    editState.unequipItem(index);
    return;
  }
  const ok = await confirmModal(
    app,
    "This item is attuned. Unequipping will also break attunement. Continue?",
    "Unequip",
  );
  if (!ok) return;
  editState.unattuneItem(index);
  editState.unequipItem(index);
}
