function isAbortSignalLike(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const t = target as Record<string, unknown>;

  return typeof t.aborted === 'boolean' &&
    typeof t.addEventListener === 'function' &&
    typeof t.removeEventListener === 'function';
}

interface SetMaxListenersFn {
  (n: number, ...targets: unknown[]): void;
  __electronPatched?: boolean;
}

interface EventsModule {
  setMaxListeners: SetMaxListenersFn;
}

/**
 * In Obsidian's Electron renderer, `new AbortController()` creates a browser-realm
 * AbortSignal that lacks Node.js's internal `kIsEventTarget` symbol. The SDK calls
 * `events.setMaxListeners(n, signal)` which throws because Node.js doesn't recognize
 * the browser AbortSignal as a valid EventTarget.
 *
 * Since setMaxListeners on AbortSignal only suppresses MaxListenersExceededWarning,
 * silently catching the error is safe.
 *
 * See: #143, #239, #284, #339, #342, #370, #374, #387
 */
export function patchSetMaxListenersForElectron(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node's `events` module is only available in the desktop (Electron) runtime; require keeps this out of the static dependency graph so it is lazily resolved.
  const events = require('events') as EventsModule;

  if (events.setMaxListeners.__electronPatched) return;

  const original = events.setMaxListeners;

  const patched: SetMaxListenersFn = function patchedSetMaxListeners(
    this: unknown,
    n: number,
    ...targets: unknown[]
  ): void {
    try {
      original.apply(this, [n, ...targets]);
    } catch (error) {
      // Only swallow the Electron cross-realm AbortSignal error.
      // Duck-type check avoids depending on Node.js internal error message text.
      if (targets.length > 0 && targets.every(isAbortSignalLike)) {
        return;
      }
      throw error;
    }
  };
  patched.__electronPatched = true;

  events.setMaxListeners = patched;
}
