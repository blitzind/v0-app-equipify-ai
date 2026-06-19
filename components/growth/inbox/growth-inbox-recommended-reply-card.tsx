"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { resolveInboxNextBestAction } from "@/lib/growth/inbox/inbox-message-display-utils"
import { growthWorkspaceInboxWorkflowHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_RECOMMENDED_REPLY_CARD_QA_MARKER = "growth-inbox-recommended-reply-card-v2" as const

type GrowthInboxRecommendedReplyCardProps = {
  className?: string
  compact?: boolean
}

export function GrowthInboxRecommendedReplyCard({ className, compact = false }: GrowthInboxRecommendedReplyCardProps) {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { copilot, loading } = useGrowthInboxLeadContext()

  if (!selectedThread) return null

  const confidence = copilot?.confidenceTier ?? "Medium"
  const summary = copilot?.summary ?? "Review the latest inbound message for context."
  const suggestedAction = copilot?.suggestedNextStep ?? resolveInboxNextBestAction(selectedThread)
  const workflowHref = growthWorkspaceInboxWorkflowHref(selectedThread.lead_id)

  return (
    <section
      aria-labelledby="inbox-recommended-reply-heading"
      className={cn(
        "rounded-md border border-indigo-200/70 bg-indigo-50/40 p-2 dark:border-indigo-900/40 dark:bg-indigo-950/20",
        className,
      )}
      data-qa-marker={GROWTH_INBOX_RECOMMENDED_REPLY_CARD_QA_MARKER}
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-indigo-700 dark:text-indigo-300" aria-hidden />
        <h3 id="inbox-recommended-reply-heading" className="text-xs font-semibold text-foreground">
          Recommended Reply
        </h3>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Confidence: <GrowthBadge label={confidence} tone="medium" />
      </p>
      {loading && !copilot ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Loading reply intelligence…</p>
      ) : (
        <>
          <p className={cn("mt-1 text-[11px] leading-snug text-foreground", compact && "line-clamp-2")}>{summary}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">Suggested:</span> {suggestedAction}
          </p>
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="default" className="h-7 text-xs" asChild>
          <a href="#inbox-reply-draft">Generate Draft</a>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={workflowHref}>Reply Manually</Link>
        </Button>
      </div>
    </section>
  )
}
