/** Workflow/operations lazy panel instrumentation (Phase 8F.2). */

export const GROWTH_INBOX_WORKFLOW_LAZY_INSTRUMENTATION_QA_MARKER =
  "growth-inbox-workflow-lazy-instrumentation-v1" as const

export const GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT = "growth-inbox-lazy-panel-activated" as const
export const GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT = "growth-inbox-lazy-panel-fetch" as const

export type GrowthInboxLazyPanelFetchPhase = "start" | "complete"

export function emitGrowthInboxLazyPanelActivated(panelId: string): void {
  if (typeof document === "undefined") return
  document.dispatchEvent(
    new CustomEvent(GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT, { detail: { panelId } }),
  )
}

export function emitGrowthInboxLazyPanelFetch(panelId: string, phase: GrowthInboxLazyPanelFetchPhase): void {
  if (typeof document === "undefined") return
  document.dispatchEvent(
    new CustomEvent(GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT, { detail: { panelId, phase } }),
  )
}
