/** Returns true when keyboard shortcuts should be suppressed (typing in a form control). */
export function isGrowthNavigationInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.closest("[contenteditable='true']")) return true
  if (target.closest("[cmdk-input-wrapper]")) return true
  return false
}
