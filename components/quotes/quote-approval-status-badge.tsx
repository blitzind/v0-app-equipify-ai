"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { QuoteStatus } from "@/lib/mock-data"
import { quoteUiAwaitingCustomerDecision } from "@/lib/org-quotes-invoices/quote-approval"
import {
  Ban,
  CheckCircle2,
  Clock,
  FilePen,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react"

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  Draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    icon: FilePen,
  },
  Sent: {
    label: "Sent",
    className:
      "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
    icon: Send,
  },
  "Pending Approval": {
    label: "Pending approval",
    className:
      "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
    icon: Clock,
  },
  Approved: {
    label: "Approved",
    className:
      "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
    icon: CheckCircle2,
  },
  Declined: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    icon: XCircle,
  },
  Expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
    icon: Ban,
  },
}

export function QuoteApprovalStatusBadge({
  status,
  showIcon = false,
  className,
}: {
  status: QuoteStatus
  showIcon?: boolean
  className?: string
}) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  const hint = quoteUiAwaitingCustomerDecision(status) ? "Awaiting customer" : null

  return (
    <div className={cn("inline-flex flex-col gap-0.5", className)}>
      <Badge variant="outline" className={cn("w-fit text-[10px] font-semibold gap-1", cfg.className)}>
        {showIcon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {cfg.label}
      </Badge>
      {hint ? (
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  )
}
