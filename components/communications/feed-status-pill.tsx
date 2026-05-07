/**
 * Communications Center Phase 1 — delivery-status pill.
 *
 * Phase 1 status palette:
 *   - sent / delivered  → green
 *   - queued / pending  → amber
 *   - failed / bounced  → red
 *   - simulated         → violet (synthetic, derived from metadata)
 *   - draft             → gray (synthetic, derived from metadata)
 *   - skipped           → gray
 */

import { cn } from "@/lib/utils"

type AnyStatus =
  | "sent"
  | "delivered"
  | "queued"
  | "pending"
  | "failed"
  | "bounced"
  | "skipped"
  | "simulated"
  | "draft"
  | string

export function FeedStatusPill({
  status,
  className,
}: {
  status: AnyStatus
  className?: string
}) {
  const meta = pillMeta(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        meta.classes,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  )
}

function pillMeta(status: AnyStatus): { label: string; classes: string; dot: string } {
  switch (status) {
    case "sent":
    case "delivered":
      return {
        label: status,
        classes:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dot: "bg-emerald-500",
      }
    case "queued":
    case "pending":
      return {
        label: status,
        classes:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        dot: "bg-amber-500",
      }
    case "failed":
    case "bounced":
      return {
        label: status,
        classes: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
        dot: "bg-red-500",
      }
    case "simulated":
      return {
        label: "simulated",
        classes:
          "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        dot: "bg-violet-500",
      }
    case "draft":
      return {
        label: "draft",
        classes:
          "border-zinc-400/30 bg-zinc-400/10 text-zinc-700 dark:text-zinc-300",
        dot: "bg-zinc-400",
      }
    default:
      return {
        label: status,
        classes:
          "border-border bg-muted/40 text-muted-foreground",
        dot: "bg-muted-foreground/60",
      }
  }
}
