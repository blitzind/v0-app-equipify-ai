"use client"

import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER,
  GROWTH_PROSPECT_WORKFLOW_ACTION_GROUPS,
  buildProspectWorkflowLauncherActions,
  type GrowthProspectWorkflowActionGroup,
  type GrowthProspectWorkflowContinuityEventKind,
  type GrowthProspectWorkflowLauncherAction,
} from "@/lib/growth/prospect-search/prospect-pipeline-automation"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"
import { OutboundLaunchMotionPanel } from "@/components/growth/outbound-launch/outbound-launch-motion-panel"

const GROUP_LABELS: Record<GrowthProspectWorkflowActionGroup, string> = {
  qualification: "Qualification",
  outreach: "Outreach",
  meetings: "Meetings",
  revenue_execution: "Revenue Execution",
  relationship_expansion: "Relationship Expansion",
}

export function ProspectWorkflowLauncher({
  company,
  query,
  filters,
  discoveryMode,
  savedSearchId,
  compact = false,
  busy = false,
  onLaunch,
}: {
  company: GrowthProspectSearchCompanyResult
  query?: string
  filters?: GrowthProspectSearchFilters
  discoveryMode?: GrowthProspectSearchDiscoveryMode
  savedSearchId?: string | null
  compact?: boolean
  busy?: boolean
  onLaunch: (input: {
    action: GrowthProspectWorkflowLauncherAction
    launchUrl?: string | null
    serverAction?: string | null
    timelineEventKind?: GrowthProspectWorkflowContinuityEventKind | null
  }) => void | Promise<void>
}) {
  const actions = buildProspectWorkflowLauncherActions({
    company,
    query,
    filters,
    discoveryMode,
    savedSearchId,
  })
  const primary = actions.find((action) => action.is_primary) ?? actions.find((action) => action.enabled)

  return (
    <section
      className={cn("w-full min-w-0 space-y-3", compact ? "text-xs" : "text-sm")}
      data-qa-marker={GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER}
    >
      <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 dark:border-violet-900/40 dark:bg-violet-950/20">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Recommended next action
            </p>
            <p className="mt-0.5 font-semibold text-violet-950 dark:text-violet-100">
              {company.recommended_next_action ?? primary?.label ?? "Review prospect"}
            </p>
            {company.recommended_next_action_reason ? (
              <p className="mt-1 text-xs text-violet-900/90 dark:text-violet-200/90">
                {company.recommended_next_action_reason}
              </p>
            ) : null}
            {company.recommended_workflow_path ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{company.recommended_workflow_path}</p>
            ) : null}
          </div>
          {primary?.enabled ? (
            <Button
              size="sm"
              className="shrink-0"
              disabled={busy}
              onClick={() =>
                void onLaunch({
                  action: primary,
                  launchUrl: primary.launch_url,
                  serverAction: primary.server_action,
                  timelineEventKind: primary.timeline_event_kind,
                })
              }
            >
              {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ArrowRight className="mr-1 size-3.5" />}
              {primary.label}
            </Button>
          ) : null}
        </div>

        {company.recommended_sequence_label ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-violet-100/80 pt-2 dark:border-violet-900/30">
            <Badge variant="secondary" className="text-[10px]">
              Sequence: {company.recommended_sequence_label}
            </Badge>
            {company.recommended_sequence_confidence != null ? (
              <span className="text-[10px] text-muted-foreground">
                {company.recommended_sequence_confidence}% confidence
              </span>
            ) : null}
            {company.recommended_first_touch ? (
              <span className="text-[10px] text-muted-foreground">· First touch: {company.recommended_first_touch}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <OutboundLaunchMotionPanel
        company={company}
        query={query}
        savedSearchId={savedSearchId}
        compact={compact}
      />

      {GROWTH_PROSPECT_WORKFLOW_ACTION_GROUPS.map((group) => {
        const groupActions = actions.filter((action) => action.group === group)
        if (groupActions.length === 0) return null

        return (
          <div key={group} className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUP_LABELS[group]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {groupActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  size="sm"
                  variant={action.is_primary ? "default" : "outline"}
                  className="h-8 max-w-full shrink-0 text-xs"
                  disabled={!action.enabled || busy}
                  title={action.disabled_reason ?? undefined}
                  onClick={() =>
                    void onLaunch({
                      action,
                      launchUrl: action.launch_url,
                      serverAction: action.server_action,
                      timelineEventKind: action.timeline_event_kind,
                    })
                  }
                >
                  <span className="truncate">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
