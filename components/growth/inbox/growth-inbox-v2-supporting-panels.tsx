"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { GrowthInboxTeamQueuePanel } from "@/components/growth/growth-inbox-team-queue-panel"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

/** Secondary admin surfaces — collapsed by default so the workspace shell stays primary. */
export function GrowthInboxV2SupportingPanels() {
  const { selectedThread, actionLoading, setSelectedThreadId, loadThreadDetail, intelligence } =
    useGrowthInboxWorkspace()

  return (
    <Collapsible defaultOpen={false} className="rounded-lg border border-border/50 bg-muted/5">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/15"
        data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
      >
        <span>Supporting intelligence &amp; team operations</span>
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-border/50 px-4 py-4">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Budget signals: {intelligence?.budget ?? 0}</span>
          <span>Meeting intent: {intelligence?.meeting_intent ?? 0}</span>
          <span>Positive interest: {intelligence?.positive_interest ?? 0}</span>
          <span>Competitor: {intelligence?.competitor ?? 0}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Primary workflow lives in the Action Center above.{" "}
          <Link href="/admin/growth/replies/workflow" className="font-medium text-indigo-600 hover:underline">
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
          <p className="text-xs text-muted-foreground">Select a thread to view team queue and ownership tools.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
