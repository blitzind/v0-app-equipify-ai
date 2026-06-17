/**
 * Shared workspace sidebar section collapse — mirrors Core AppSidebar group behavior.
 */

export const WORKSPACE_CORE_NAV_GROUP_STORAGE_KEY = "equipify:nav:groups:collapsed/v1" as const

export const WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY =
  "equipify:growth-workspace:sidebar-sections/v1" as const

export function readWorkspaceSidebarCollapsedSections(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === "string"))
    return new Set()
  } catch {
    return new Set()
  }
}

export function writeWorkspaceSidebarCollapsedSections(storageKey: string, collapsed: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(collapsed)))
  } catch {
    // localStorage may be unavailable (private mode); collapse state stays in memory.
  }
}

export function toggleWorkspaceSidebarCollapsedSection(
  storageKey: string,
  collapsed: Set<string>,
  groupId: string,
): Set<string> {
  const next = new Set(collapsed)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  writeWorkspaceSidebarCollapsedSections(storageKey, next)
  return next
}
