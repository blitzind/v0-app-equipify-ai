/**
 * Shared BlitzPay UI formatters — human labels + consistent status visuals.
 * Business logic and API payloads stay unchanged; this module is display-only.
 */
import { cn } from "@/lib/utils"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

export { formatBlitzpayUiLabel }

/** Audit / activity / workflow type keys → friendly copy */
export const formatBlitzpayAuditLabel = formatBlitzpayUiLabel
export const formatBlitzpayWorkflowLabel = formatBlitzpayUiLabel
export const formatBlitzpayCollectionsLabel = formatBlitzpayUiLabel

const PILL_BASE =
  "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-normal text-left break-words"

/** Workflow execution row — status chip for observability / queue UIs */
export function blitzpayWorkflowExecutionPillClass(statusRaw: string | null | undefined): string {
  const s = (statusRaw ?? "").trim().toLowerCase()
  if (s === "completed" || s === "succeeded") {
    return cn(PILL_BASE, "border-emerald-500/30 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100")
  }
  if (s === "failed") {
    return cn(PILL_BASE, "border-destructive/35 bg-destructive/10 text-destructive")
  }
  if (s === "processing" || s === "queued" || s === "running") {
    return cn(PILL_BASE, "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100")
  }
  if (s === "canceled" || s === "cancelled" || s === "skipped") {
    return cn(PILL_BASE, "border-border bg-muted/50 text-muted-foreground")
  }
  return cn(PILL_BASE, "border-border/80 bg-background/80 text-foreground")
}

/** Neutral advisory / “healthy enough” states */
export function blitzpayAdvisoryScorePillClass(warn: boolean): string {
  return cn(
    PILL_BASE,
    warn ? "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50" : "border-border/70 bg-muted/30 text-foreground",
  )
}
