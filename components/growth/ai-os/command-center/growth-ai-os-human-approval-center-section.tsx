"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"

type Props = {
  humanApprovalCenter: GrowthHumanApprovalCenterReadModel
  compact?: boolean
}

function riskVariant(level: string) {
  if (level === "high") return "destructive" as const
  if (level === "medium") return "secondary" as const
  return "outline" as const
}

export function GrowthAiOsHumanApprovalCenterSection({ humanApprovalCenter, compact = false }: Props) {
  if (humanApprovalCenter.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER) return null

  const summary = humanApprovalCenter.summary
  const items = compact ? humanApprovalCenter.topItems.slice(0, 5) : humanApprovalCenter.topItems

  return (
    <section data-qa-section="human-approval-center" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Human Approval Center</h3>
          <p className="text-xs text-muted-foreground">
            Unified read-only inbox — review and route to existing approval surfaces. No send or approve here.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {summary.totalPending} pending
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">SMS</p>
          <p className="text-sm font-semibold">{summary.smsPending}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Email</p>
          <p className="text-sm font-semibold">{summary.emailPending}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Voice</p>
          <p className="text-sm font-semibold">{summary.voicePending}</p>
        </div>
      </div>

      {summary.highestRiskTitle ? (
        <p className="text-xs text-muted-foreground">
          Highest risk: {summary.highestRiskTitle}
          {summary.highestRiskLevel ? ` (${summary.highestRiskLevel})` : ""}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending approvals in the current read model.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source.replaceAll("_", " ")} · {item.actionType.replaceAll("_", " ")}
                    {item.channel ? ` · ${item.channel}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={riskVariant(item.riskLevel)}>{item.riskLevel}</Badge>
                  <Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{item.evidence.length} evidence item(s)</p>
              {item.route ? (
                <Link href={item.route} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  Open approval surface
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Link href={summary.approvalCenterHref} className="inline-block text-xs font-medium text-primary hover:underline">
        Open full Approval Center
      </Link>
    </section>
  )
}
