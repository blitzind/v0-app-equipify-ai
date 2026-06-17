"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { GrowthInboxTeamQueuePanel } from "@/components/growth/growth-inbox-team-queue-panel"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { GrowthInboxCompactPanelState } from "@/components/growth/inbox/growth-inbox-compact-panel-state"
import { useOptionalGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

/** Secondary team/ownership surfaces — collapsed by default so Thread → Context → Action stays primary. */
export function GrowthInboxV2SupportingPanels() {
  const pathname = usePathname()
  const workspace = useOptionalGrowthInboxWorkspace()

  if (!workspace) {
    return (
      <GrowthInboxCompactPanelState
        title="Inbox workspace unavailable."
        state="error"
        message="Inbox workspace unavailable."
        onRetry={() => {
          if (typeof window !== "undefined") window.location.reload()
        }}
      />
    )
  }

  const { selectedThread, actionLoading, setSelectedThreadId, loadThreadDetail, intelligence } = workspace

  return (
    <Collapsible defaultOpen={false} className="rounded-lg border border-border/50 bg-muted/5">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/15"
        data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
      >
        <span>Team queue &amp; ownership</span>
        <ChevronDown className="size-4 shrink-0" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-border/50 px-4 py-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Budget signals: {intelligence?.budget ?? 0}</span>
          <span>Meeting intent: {intelligence?.meeting_intent ?? 0}</span>
          <span>Positive interest: {intelligence?.positive_interest ?? 0}</span>
          <span>Competitor: {intelligence?.competitor ?? 0}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Operator actions live in the Action Center.{" "}
          <Link href={growthFeaturePath(pathname, "inbox/workflow")} className="font-medium text-indigo-600 hover:underline">
            Open full workflow center
          </Link>
        </p>

        {selectedThread ? (
          <GrowthInboxWidgetErrorBoundary label="Team queue">
            <GrowthInboxTeamQueuePanel
              selectedThreadId={selectedThread.id}
              onSelectThread={(threadId) => {
                setSelectedThreadId(threadId)
                void loadThreadDetail(threadId)
              }}
              disabled={Boolean(actionLoading)}
            />
          </GrowthInboxWidgetErrorBoundary>
        ) : (
          <p className="text-[11px] text-muted-foreground">Select a thread to view team queue and ownership history.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
