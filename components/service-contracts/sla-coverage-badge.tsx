import { cn } from "@/lib/utils"
import type { SlaCoverageLabel } from "@/lib/service-contracts/types"

export function formatSlaCoverageLabel(label: SlaCoverageLabel): string {
  switch (label) {
    case "covered":
      return "Covered"
    case "no_contract":
      return "No contract"
    case "sla_at_risk":
      return "SLA at risk"
    case "sla_overdue":
      return "SLA overdue"
    default:
      return label
  }
}

export function slaCoverageBadgeClass(label: SlaCoverageLabel): string {
  switch (label) {
    case "covered":
      return "border-[color:var(--status-success)]/45 bg-[color:var(--status-success)]/10 text-emerald-950 dark:text-emerald-100"
    case "no_contract":
      return "border-border bg-muted text-muted-foreground"
    case "sla_at_risk":
      return "border-[color:var(--status-warning)]/45 bg-[color:var(--status-warning)]/10 text-amber-950 dark:text-amber-100"
    case "sla_overdue":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    default:
      return "border-border bg-card"
  }
}

export function SlaCoverageBadge({
  label,
  className,
}: {
  label: SlaCoverageLabel
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
        slaCoverageBadgeClass(label),
        className,
      )}
    >
      {formatSlaCoverageLabel(label)}
    </span>
  )
}
