"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  GROWTH_AVA_COMPLETED_WORK_HREF,
  GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
  resolveCompletedWorkTitle,
} from "@/lib/growth/aios/approvals/ava-completed-work-contract"
import {
  categorizeAvaCompletedWorkItem,
  projectAvaCompletedWork,
} from "@/lib/growth/aios/approvals/ava-completed-work-projection"

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
  const { teammate } = useAiTeammateIdentity()

  if (humanApprovalCenter.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER) return null

  const projection = projectAvaCompletedWork({ items: humanApprovalCenter.items, teammateName: teammate.name })
  const items = compact ? humanApprovalCenter.topItems.slice(0, 5) : humanApprovalCenter.topItems

  return (
    <section
      data-qa-section="human-approval-center"
      data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{resolveCompletedWorkTitle(teammate)}</h3>
          <p className="text-xs text-muted-foreground">
            {teammate.name} finished these tasks and is waiting for your authorization. Package authorization is
            not permission to send.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {projection.totalCompleted} completed
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        {projection.categories
          .filter((category) => category.count > 0)
          .slice(0, 4)
          .map((category) => (
            <div key={category.id} className="rounded-md border px-3 py-2">
              <p className="text-muted-foreground">{category.label}</p>
              <p className="text-sm font-semibold">{category.count}</p>
            </div>
          ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{teammate.name} has no completed work waiting right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {teammate.name} recommends review · {categorizeAvaCompletedWorkItem(item).replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={riskVariant(item.riskLevel)}>{item.riskLevel}</Badge>
                  <Badge variant="outline">Waiting for you</Badge>
                </div>
              </div>
              {item.route ? (
                <Link href={item.route} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  Review {teammate.name}&apos;s work
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Link href={GROWTH_AVA_COMPLETED_WORK_HREF} className="inline-block text-xs font-medium text-primary hover:underline">
        Open {teammate.name}&apos;s completed work
      </Link>
    </section>
  )
}
