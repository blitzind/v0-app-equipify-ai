"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import {
  SEQUENCE_PREVIEW_FILTERS,
  SEQUENCE_PREVIEW_QA_MARKER,
  SEQUENCE_PREVIEW_STATUS_LABELS,
  type SequencePreview,
  type SequencePreviewFilter,
  type SequencePreviewStudioResponse,
} from "@/lib/growth/sequence-preview/sequence-preview-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"
import { GrowthAgentOrchestrationPanel } from "@/components/growth/growth-agent-orchestration-panel"

function statusTone(status: SequencePreview["sequence_status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_review":
      return "attention" as const
    case "ready_for_human_approval":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

function channelTone(status: SequencePreview["steps"][number]["channel_status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "conditional":
      return "attention" as const
    default:
      return "healthy" as const
  }
}

export function GrowthSequencePreviewStudioPanel({
  title = "Sequence Preview Studio",
  patternId,
  leadId,
  compact = false,
  includeOrchestrationSurfaces = false,
  useInboxConcurrencyLimit = false,
  enableRealtimeRefresh = true,
  loadOnMount = true,
}: {
  title?: string
  patternId?: string | null
  leadId?: string | null
  compact?: boolean
  includeOrchestrationSurfaces?: boolean
  useInboxConcurrencyLimit?: boolean
  enableRealtimeRefresh?: boolean
  loadOnMount?: boolean
}) {
  const [filter, setFilter] = useState<SequencePreviewFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [studio, setStudio] = useState<SequencePreviewStudioResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (patternId) params.set("pattern_id", patternId)
      if (leadId) params.set("lead_id", leadId)
      params.set("filter", filter)
      params.set("limit", compact ? "5" : "15")

      const res = await fetchPlatformGrowthClient(`/api/platform/growth/sequence-preview?${params.toString()}`, {
        useInboxConcurrencyLimit,
      })
      const data = (await res.json()) as SequencePreviewStudioResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Sequence preview request failed")
        setStudio(null)
        return
      }
      setStudio(data)
    } catch {
      setError("Sequence preview unavailable")
      setStudio(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId, patternId, useInboxConcurrencyLimit])

  useEffect(() => {
    if (!loadOnMount) return
    void load()
  }, [load, loadOnMount])

  useGrowthRealtimeRefresh({
    subscriber: "sequence_preview",
    onRefresh: () => void load(),
    enabled: enableRealtimeRefresh,
  })

  async function runAction(preview: SequencePreview, action: "mark_reviewed" | "dismiss") {
    setActingId(preview.preview_id)
    try {
      await fetch("/api/platform/growth/sequence-preview/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, preview }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  async function viewPreview(preview: SequencePreview) {
    setExpandedId(preview.preview_id)
    await fetch("/api/platform/growth/sequence-preview/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view_details", preview }),
    }).catch(() => null)
  }

  return (
    <>
    <GrowthEngineCard
      title={title}
      icon={<GitBranch className="h-4 w-4" />}
      data-qa-marker={SEQUENCE_PREVIEW_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Planned sequence preview — step timeline, channels, timing gaps, and approval requirements. Preview and review
        only. No enrollment, send, or autonomous execution.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {SEQUENCE_PREVIEW_FILTERS.map((value) => (
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
        Refresh previews
      </Button>

      {studio ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{studio.total} previews</GrowthBadge>
          <GrowthBadge tone="critical">{studio.blocked_count} blocked</GrowthBadge>
          <GrowthBadge tone="attention">{studio.needs_review_count} needs review</GrowthBadge>
          <GrowthBadge tone="healthy">{studio.ready_count} ready for approval</GrowthBadge>
        </div>
      ) : null}

      <GrowthEnginePanelResilience
        loading={loading && !studio}
        error={error}
        isEmpty={!loading && (studio?.previews.length ?? 0) === 0}
        emptyKind="no_sequence_previews"
        onRetry={() => void load()}
        partialData={Boolean(studio)}
      >
        {studio?.previews.map((preview) => (
          <div key={preview.preview_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{preview.pattern_label}</p>
                <p className="text-xs text-muted-foreground">
                  {SEQUENCE_PREVIEW_STATUS_LABELS[preview.sequence_status]}
                  {preview.company_name ? ` · ${preview.company_name}` : ""}
                  {preview.step_count ? ` · ${preview.step_count} steps` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={statusTone(preview.sequence_status)}>
                  {preview.sequence_status.replace(/_/g, " ")}
                </GrowthBadge>
                <GrowthBadge tone="neutral">{preview.review_status}</GrowthBadge>
                <GrowthBadge tone="neutral">Score {preview.preview_score}</GrowthBadge>
              </div>
            </div>

            {expandedId === preview.preview_id ? (
              <div className="mb-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium">Step timeline</p>
                  <div className="space-y-2">
                    {preview.steps.map((step) => (
                      <div key={step.step_id} className="rounded border border-border p-2 text-xs">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium">{step.label}</span>
                          <GrowthBadge tone={channelTone(step.channel_status)}>{step.channel_status}</GrowthBadge>
                          <GrowthBadge tone="neutral">{step.scheduled_window_label}</GrowthBadge>
                          {step.timing_gap_days > 0 ? (
                            <GrowthBadge tone="neutral">+{step.timing_gap_days}d gap</GrowthBadge>
                          ) : null}
                        </div>
                        {step.notes.length > 0 ? (
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {step.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        ) : null}
                        {step.blockers.length > 0 ? (
                          <p className="mt-1 text-muted-foreground">{step.blockers.join(" · ")}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {preview.risks.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Risks</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {preview.risks.map((risk) => (
                        <li key={risk.risk_id}>
                          [{risk.severity}] {risk.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {preview.approval_requirements.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Approval requirements</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {preview.approval_requirements.map((req) => (
                        <li key={req.requirement_id}>
                          {req.label} ({req.status})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!compact && preview.recommendations.length > 0 ? (
                  <div className="space-y-1">
                    {preview.recommendations.map((rec) => (
                      <div key={rec.recommendation_id} className="rounded border border-border p-2 text-xs">
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap gap-2">
                {preview.steps.slice(0, compact ? 3 : 6).map((step) => (
                  <GrowthBadge key={step.step_id} tone={channelTone(step.channel_status)}>
                    {step.step_order}. {step.channel.replace(/_/g, " ")}
                  </GrowthBadge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void viewPreview(preview)}>
                View Preview
              </Button>
              {preview.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={preview.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related Asset
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === preview.preview_id}
                onClick={() => void runAction(preview, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === preview.preview_id}
                onClick={() => void runAction(preview, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
    {includeOrchestrationSurfaces ? (
      <GrowthCampaignBuilderWizardPanel
        title="Campaign Builder Wizard"
        leadId={leadId}
        patternId={patternId}
        compact={compact}
      />
    ) : null}
    {includeOrchestrationSurfaces ? (
      <GrowthAgentOrchestrationPanel
        title="Agent Orchestration"
        leadId={leadId}
        patternId={patternId}
        compact={compact}
      />
    ) : null}
    </>
  )
}
