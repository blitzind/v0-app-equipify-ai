/**
 * Serialize offline replay per work-order scope across tabs (Navigator Locks API when available).
 */
export async function withWorkOrderOfflineReplayLock<T>(scopeKey: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && typeof navigator.locks?.request === "function") {
    return navigator.locks.request(`equipify:wo-offline-replay:${scopeKey}`, { mode: "exclusive" }, fn)
  }
  return fn()
}
