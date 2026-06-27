"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, LayoutDashboard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthCommandCenterMetricsPanel } from "@/components/growth/growth-command-center-metrics-panel"
import { GrowthCommandCenterTimelinePanel } from "@/components/growth/growth-command-center-timeline-panel"
import { GrowthLeadWorkspacePanel } from "@/components/growth/growth-lead-workspace-panel"
import {
  COMMAND_CENTER_UNIFICATION_FILTERS,
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  VIEW_LABELS,
  WORKSPACE_STATUS_LABELS,
  type CommandCenterUnificationFilter,
  type GrowthCommandCenterUnificationResponse,
  type GrowthCommandCenterViewId,
} from "@/lib/growth/command-center-unification/command-center-unification-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"

function viewTone(viewId: GrowthCommandCenterViewId) {
  switch (viewId) {
    case "campaign_blocked":
      return "critical" as const
    case "needs_attention":
    case "high_intent":
      return "attention" as const
    case "ready_for_outreach":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

export function GrowthCommandCenterUnifiedWorkspace({
  title = "Unified Command Center",
  leadId,
  compact = false,
}: {
  title?: string
  leadId?: string | null
  compact?: boolean
}) {
  const [filter, setFilter] = useState<CommandCenterUnificationFilter>("all")
  const [activeView, setActiveView] = useState<GrowthCommandCenterViewId>("needs_attention")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [workspace, setWorkspace] = useState<GrowthCommandCenterUnificationResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      params.set("filter", filter)
      params.set("limit", compact ? "10" : "20")

      const res = await fetch(`/api/platform/growth/command-center-unification?${params.toString()}`)
      const data = (await res.json()) as GrowthCommandCenterUnificationResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Command Center request failed")
        setWorkspace(null)
        return
      }
      setWorkspace(data)
    } catch {
      setError("Command Center unavailable")
      setWorkspace(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId])

  useEffect(() => {
    void load()
  }, [load])

  useGrowthRealtimeRefresh({
    subscriber: "command_center",
    onRefresh: () => void load(),
    enabled: !compact,
  })

  async function runAction(action: "mark_reviewed" | "view_details" | "navigate_to_source", navigationTarget?: string) {
    if (!workspace) return
    setActing(true)
    try {
      await fetch("/api/platform/growth/command-center-unification/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "navigate_to_source" ? "navigate_to_source" : action,
          workspace,
          navigation_target: navigationTarget ?? null,
        }),
      })
      if (action === "mark_reviewed") await load()
    } finally {
      setActing(false)
    }
  }

  const selectedView = workspace?.views.find((v) => v.view_id === activeView)

  return (
    <div className="space-y-4" data-qa-marker={COMMAND_CENTER_UNIFICATION_QA_MARKER}>
      <GrowthEngineCard title={title} icon={<LayoutDashboard className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-muted-foreground">
          Read-only aggregation across all AI OS subsystems. Visibility and operator workflow optimization only —
          no send, launch, enroll, or autonomous execution.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {COMMAND_CENTER_UNIFICATION_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {value.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Refresh workspace
        </Button>

        {workspace ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <GrowthBadge tone="neutral">{WORKSPACE_STATUS_LABELS[workspace.workspace_status]}</GrowthBadge>
            <GrowthBadge tone="attention">{workspace.attention_queue.length} attention</GrowthBadge>
            <GrowthBadge tone="neutral">{workspace.approval_queue.length} approvals</GrowthBadge>
            <GrowthBadge tone="healthy">{workspace.metrics.ready_for_outreach_count} ready</GrowthBadge>
            <GrowthBadge tone="critical">{workspace.metrics.blocked_campaigns} blocked</GrowthBadge>
          </div>
        ) : null}
      </GrowthEngineCard>

      {workspace ? (
        <>
          <GrowthCommandCenterMetricsPanel
            metrics={workspace.metrics}
            workspaceStatus={workspace.workspace_status}
            compact={compact}
          />

          <GrowthEngineCard title="Global Command Views">
            <div className="mb-3 flex flex-wrap gap-2">
              {workspace.views.map((view) => (
                <button
                  key={view.view_id}
                  type="button"
                  onClick={() => setActiveView(view.view_id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeView === view.view_id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {VIEW_LABELS[view.view_id]} ({view.item_count})
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {(selectedView?.items.length ?? 0) === 0 ? (
                <GrowthEngineHonestEmptyState kind="no_command_center_items" />
              ) : (
                selectedView?.items.map((item) => (
                  <div key={item.item_id} className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <GrowthBadge tone={viewTone(item.view_id)}>{item.priority}</GrowthBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.related_href ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={item.related_href}
                            onClick={() => void runAction("navigate_to_source", item.related_href ?? undefined)}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Open Related Item
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void runAction("view_details", item.related_href ?? undefined)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GrowthEngineCard>

          {!compact ? (
            <GrowthCommandCenterTimelinePanel
              timeline={workspace.timeline}
              onNavigate={(item) => void runAction("navigate_to_source", item.related_href ?? undefined)}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={acting} onClick={() => void runAction("mark_reviewed")}>
              Mark Reviewed
            </Button>
          </div>
        </>
      ) : (
        <GrowthEnginePanelResilience
          loading={loading}
          error={error}
          isEmpty={!workspace}
          emptyKind="no_command_center_items"
          onRetry={() => void load()}
        >
          {null}
        </GrowthEnginePanelResilience>
      )}

      {leadId ? <GrowthLeadWorkspacePanel leadId={leadId} compact={compact} /> : null}
    </div>
  )
}
