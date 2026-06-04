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

/** Reduced supporting surface for V2 — primary workflow lives in the workspace shell. */
export function GrowthInboxV2SupportingPanels() {
  const { selectedThread, actionLoading, setSelectedThreadId, loadThreadDetail, intelligence } =
    useGrowthInboxWorkspace()

  return (
    <div className="space-y-3 opacity-90" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}>
      <Collapsible defaultOpen={false} className="rounded-lg border border-border/60 bg-muted/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/20">
          Supporting intelligence summary
          <ChevronDown className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-3">
            <span>Budget signals: {intelligence?.budget ?? 0}</span>
            <span>Meeting intent: {intelligence?.meeting_intent ?? 0}</span>
            <span>Positive interest: {intelligence?.positive_interest ?? 0}</span>
            <span>Competitor: {intelligence?.competitor ?? 0}</span>
          </div>
          <p className="mt-2">
            Workflow, opportunity, booking, memory, and reply drafting are consolidated in the Action Center above.{" "}
            <Link href="/admin/growth/replies/workflow" className="font-medium text-indigo-600 hover:underline">
              Open full workflow center
            </Link>
          </p>
        </CollapsibleContent>
      </Collapsible>

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
      ) : null}
    </div>
  )
}
