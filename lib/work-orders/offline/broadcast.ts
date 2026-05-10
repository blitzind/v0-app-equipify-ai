export const WORK_ORDER_OFFLINE_BUMP_EVENT = "equipify:work-order-offline-bump"

export function bumpWorkOrderOfflineListeners(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(WORK_ORDER_OFFLINE_BUMP_EVENT))
}
