/**
 * Shared workspace search interaction contract — certified in Phase 6B.1 parity audit.
 */

export const WORKSPACE_SEARCH_INTERACTION_QA_MARKER = "workspace-search-interaction-v1" as const

/** Debounced query threshold (matches GlobalSearchPanel + WorkspaceSearch). */
export { WORKSPACE_SEARCH_DEBOUNCE_MS } from "@/components/workspace/global-search-panel"

/** Cmd/Ctrl+K focuses workspace search on Core; Growth reserves Cmd+K for command palette. */
export const WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE = true as const
export const WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH = false as const
