"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthAiOsHumanApprovalCenterSection } from "@/components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section"
import type { GrowthAiOsOperatorApprovalSummary } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { AI_OS_APPROVALS_SECTION_SUBTITLE, AI_OS_APPROVALS_SECTION_TITLE } from "@/lib/workspace/ai-os-outcome-first-terminology"

import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"

type Props = {
  summary: GrowthAiOsOperatorApprovalSummary | null
  humanApprovalCenter?: GrowthHumanApprovalCenterReadModel
}

export function GrowthAiOsOperatorApprovalsSummary({ summary, humanApprovalCenter }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!summary || summary.totalPending === 0) return null

  return (
    <section data-qa-section="operator-exceptions-approvals" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{AI_OS_APPROVALS_SECTION_TITLE}</h2>
        <p className="mt-1 text-muted-foreground">{AI_OS_APPROVALS_SECTION_SUBTITLE}</p>
      </div>

      <article className="rounded-2xl border border-border/70 bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {(summary.groups.length > 0
            ? summary.groups
            : [{ id: "all", label: "All pending", count: summary.totalPending }]
          ).map((group) => (
            <div key={group.id} className="rounded-xl bg-muted/30 px-4 py-3">
              <p className="text-2xl font-semibold tabular-nums">{group.count}</p>
              <p className="text-sm text-muted-foreground">{group.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" disabled title="Bulk approve remains gated per item">
            Approve All Eligible
          </Button>
          <Button asChild>
            <Link href={summary.approvalCenterHref}>Review exceptions</Link>
          </Button>
        </div>
      </article>

      {humanApprovalCenter ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide individual records" : "Show individual records"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <GrowthAiOsHumanApprovalCenterSection humanApprovalCenter={humanApprovalCenter} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
