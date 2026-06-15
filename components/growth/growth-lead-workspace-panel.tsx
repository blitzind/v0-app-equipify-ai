"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthCommandCenterTimelinePanel } from "@/components/growth/growth-command-center-timeline-panel"
import {
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  WORKSPACE_STATUS_LABELS,
  type GrowthCommandCenterLeadWorkspace,
  type GrowthCommandCenterSection,
} from "@/lib/growth/command-center-unification/command-center-unification-types"

function sectionTone(status: GrowthCommandCenterSection["status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_attention":
      return "attention" as const
    case "waiting_for_review":
      return "neutral" as const
    default:
      return "healthy" as const
  }
}

export function GrowthLeadWorkspacePanel({
  leadId,
  title = "Lead Workspace",
  compact = false,
}: {
  leadId: string
  title?: string
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [workspace, setWorkspace] = useState<GrowthCommandCenterLeadWorkspace | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lead_id: leadId })
      const res = await fetch(`/api/platform/growth/command-center-unification/lead?${params.toString()}`)
      const data = (await res.json()) as { ok?: boolean; workspace?: GrowthCommandCenterLeadWorkspace }
      setWorkspace(res.ok && data.workspace ? data.workspace : null)
    } catch {
      setWorkspace(null)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(action: "mark_reviewed" | "view_details", navigationTarget?: string) {
    if (!workspace) return
    setActing(true)
    try {
      await fetch("/api/platform/growth/command-center-unification/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "mark_reviewed" ? "mark_reviewed" : "view_details",
          workspace,
          navigation_target: navigationTarget ?? null,
        }),
      })
      if (action === "mark_reviewed") await load()
    } finally {
      setActing(false)
    }
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<UserRound className="h-4 w-4" />}
      data-qa-marker={COMMAND_CENTER_UNIFICATION_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Unified lead workspace — signals, readiness, playbooks, policies, previews, builder, agent plan, inbox, and
        timeline. Human-gated navigation only.
      </p>

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh workspace
      </Button>

      {loading && !workspace ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading lead workspace…</p>
      ) : null}

      {workspace ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <GrowthBadge tone={sectionTone(workspace.workspace_status)}>
              {WORKSPACE_STATUS_LABELS[workspace.workspace_status]}
            </GrowthBadge>
            {workspace.company_name ? (
              <GrowthBadge tone="neutral">{workspace.company_name}</GrowthBadge>
            ) : null}
          </div>

          <div className="space-y-2">
            {workspace.sections
              .filter((s) => s.section_type !== "audit_timeline")
              .map((section) => (
                <div key={section.section_id} className="rounded-lg border border-border bg-muted/20 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.summary}</p>
                    </div>
                    <GrowthBadge tone={sectionTone(section.status)}>{section.item_count}</GrowthBadge>
                  </div>
                  {section.related_href ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      asChild
                      onClick={() => void runAction("view_details", section.related_href ?? undefined)}
                    >
                      <Link href={section.related_href}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Navigate to {section.source_panel.replace(/Growth|Panel/g, "").trim()}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))}
          </div>

          {!compact ? (
            <GrowthCommandCenterTimelinePanel
              timeline={workspace.timeline}
              onNavigate={(item) => void runAction("view_details", item.related_href ?? undefined)}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={acting} onClick={() => void runAction("mark_reviewed")}>
              Mark Reviewed
            </Button>
          </div>
        </div>
      ) : !loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Lead workspace unavailable.</p>
      ) : null}
    </GrowthEngineCard>
  )
}
