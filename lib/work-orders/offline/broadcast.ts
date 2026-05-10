export const WORK_ORDER_OFFLINE_BUMP_EVENT = "equipify:work-order-offline-bump"

/** Cross-tab wake: `storage` fires in other tabs when this key changes. */
export const WORK_ORDER_OFFLINE_BUMP_LS_KEY = "equipify:wo-offline-broadcast-ts"

export function bumpWorkOrderOfflineListeners(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(WORK_ORDER_OFFLINE_BUMP_EVENT))
  try {
    localStorage.setItem(WORK_ORDER_OFFLINE_BUMP_LS_KEY, String(Date.now()))
  } catch {
    // private mode / quota — same-tab CustomEvent still runs
  }
}

/** Subscribe to offline outbox bumps in this tab and in other tabs (via `storage`). */
export function subscribeWorkOrderOfflineBump(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const onBump = () => handler()
  const onStorage = (e: StorageEvent) => {
    if (e.key === WORK_ORDER_OFFLINE_BUMP_LS_KEY) handler()
  }
  window.addEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
    window.removeEventListener("storage", onStorage)
  }
}
