"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import type { RelationshipLeadSnapshotMap } from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import {
  enrichGrowthHomeWaitingOnYouItems,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  formatLivingWaitingSummary,
  GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER,
  HOME_LIVING_WAITING_EMPTY_MESSAGE,
} from "@/lib/growth/home/growth-home-living-experience-18e"
import {
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { reviewCompletedWork } from "@/lib/workspace/ai-teammate-voice"

export const AVA_HOME_WAITING_ON_YOU_TITLE = "What I need from you" as const

type Props = {
  aiOsUx: GrowthHomeAiOsUxViewModel
  relationshipSnapshotsById?: RelationshipLeadSnapshotMap
  waitingCompanyByLeadId?: Record<string, string | null>
}

export function GrowthHomeAiOsWaitingOnYouSection({
  aiOsUx,
  relationshipSnapshotsById,
  waitingCompanyByLeadId,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const waitingOnYou = enrichGrowthHomeWaitingOnYouItems(
    aiOsUx.waitingOnYou,
    relationshipSnapshotsById,
    waitingCompanyByLeadId,
  )
  const { waitingOnYouOverflow, approveItemsHref, approveItemsCount } = aiOsUx
  const replyCount = waitingOnYou.filter((item) => /reply/i.test(item.label)).length
  const hasItems = approveItemsCount > 0 || replyCount > 0
  const waitingSummary = formatLivingWaitingSummary({
    approvalCount: approveItemsCount,
    replyCount,
  })

  return (
    <section
      data-qa-section="home-needs-your-attention"
      data-home-experience-2b={GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}
      data-qa-marker-18e={GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER}
      data-qa-marker-16x={GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card p-4 space-y-3 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{AVA_HOME_WAITING_ON_YOU_TITLE}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasItems ? waitingSummary : HOME_LIVING_WAITING_EMPTY_MESSAGE}
          </p>
        </div>
        {approveItemsHref && approveItemsCount > 0 ? (
          <Button asChild size="sm">
            <Link href={approveItemsHref}>
              {reviewCompletedWork(teammate)}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      {!hasItems ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-sm font-medium text-foreground">{HOME_LIVING_WAITING_EMPTY_MESSAGE}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {waitingOnYou.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
                  ) : null}
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-900 hover:underline dark:text-amber-100"
                  >
                    Review
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {waitingOnYouOverflow > 0 ? (
        <p className="text-xs text-muted-foreground">
          {waitingOnYouOverflow} more in additional tools below.
        </p>
      ) : null}
    </section>
  )
}
