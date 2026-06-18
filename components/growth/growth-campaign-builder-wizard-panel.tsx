"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Layers, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import {
  CAMPAIGN_BUILDER_FILTERS,
  CAMPAIGN_BUILDER_QA_MARKER,
  CAMPAIGN_BUILDER_STATUS_LABELS,
  type CampaignBuilderFilter,
  type CampaignBuilderWizard,
  type CampaignBuilderWizardResponse,
} from "@/lib/growth/campaign-builder/campaign-builder-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"
import { withGrowthFeatureShellGate } from "@/components/growth/runtime/with-growth-feature-shell-gate"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"

function statusTone(status: CampaignBuilderWizard["wizard_status"]) {
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

function stepTone(status: CampaignBuilderWizard["steps"][number]["status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_review":
      return "attention" as const
    case "complete":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

function GrowthCampaignBuilderWizardPanelInner({
  title = "Campaign Builder Wizard",
  leadId,
  patternId,
  compact = false,
  useInboxConcurrencyLimit = false,
  enableRealtimeRefresh = true,
  loadOnMount = true,
}: {
  title?: string
  leadId?: string | null
  patternId?: string | null
  compact?: boolean
  useInboxConcurrencyLimit?: boolean
  enableRealtimeRefresh?: boolean
  loadOnMount?: boolean
}) {
  const [filter, setFilter] = useState<CampaignBuilderFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [studio, setStudio] = useState<CampaignBuilderWizardResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      if (patternId) params.set("pattern_id", patternId)
      params.set("filter", filter)
      params.set("limit", compact ? "3" : "10")

      const res = await fetchPlatformGrowthClient(`/api/platform/growth/campaign-builder?${params.toString()}`, {
        useInboxConcurrencyLimit,
      })
      const data = (await res.json()) as CampaignBuilderWizardResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Campaign builder request failed")
        setStudio(null)
        return
      }
      setStudio(data)
    } catch {
      setError("Campaign builder unavailable")
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
    subscriber: "campaign_builder",
    onRefresh: () => void load(),
    enabled: enableRealtimeRefresh,
  })

  async function runAction(wizard: CampaignBuilderWizard, action: "mark_reviewed" | "dismiss") {
    setActingId(wizard.wizard_id)
    try {
      await fetch("/api/platform/growth/campaign-builder/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, wizard }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  async function viewWizard(wizard: CampaignBuilderWizard) {
    setExpandedId(wizard.wizard_id)
    await fetch("/api/platform/growth/campaign-builder/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view_details", wizard }),
    }).catch(() => null)
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<Layers className="h-4 w-4" />}
      data-qa-marker={CAMPAIGN_BUILDER_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Assembles campaign configuration from readiness, sequences, follow-up policies, and interventions.
        Planning only — no launch, enrollment, or autonomous execution.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {CAMPAIGN_BUILDER_FILTERS.map((value) => (
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
        Refresh wizard
      </Button>

      {studio ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{studio.total} wizards</GrowthBadge>
          <GrowthBadge tone="critical">{studio.blocked_count} blocked</GrowthBadge>
          <GrowthBadge tone="attention">{studio.needs_review_count} needs review</GrowthBadge>
          <GrowthBadge tone="healthy">{studio.ready_count} ready</GrowthBadge>
        </div>
      ) : null}

      <GrowthEnginePanelResilience
        loading={loading && !studio}
        error={error}
        isEmpty={!loading && (studio?.wizards.length ?? 0) === 0}
        emptyKind="no_campaign_builders"
        onRetry={() => void load()}
        partialData={Boolean(studio)}
      >
        {studio?.wizards.map((wizard) => (
          <div key={wizard.wizard_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {wizard.configuration.suggested_pattern_label ?? "Campaign configuration"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {CAMPAIGN_BUILDER_STATUS_LABELS[wizard.wizard_status]}
                  {wizard.company_name ? ` · ${wizard.company_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={statusTone(wizard.wizard_status)}>
                  {wizard.wizard_status.replace(/_/g, " ")}
                </GrowthBadge>
                <GrowthBadge tone="neutral">Score {wizard.configuration_score}</GrowthBadge>
                <GrowthBadge tone="neutral">{wizard.review_status}</GrowthBadge>
              </div>
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              {wizard.configuration.recommended_channels.map((channel) => (
                <GrowthBadge key={channel} tone="attention">
                  {channel.replace(/_/g, " ")}
                </GrowthBadge>
              ))}
            </div>

            {expandedId === wizard.wizard_id ? (
              <div className="mb-3 space-y-3">
                <div>
                  <p className="text-xs font-medium">Wizard steps</p>
                  <div className="mt-1 space-y-1">
                    {wizard.steps.map((step) => (
                      <div key={step.step_id} className="flex flex-wrap items-center gap-2 text-xs">
                        <GrowthBadge tone={stepTone(step.status)}>{step.status}</GrowthBadge>
                        <span className="font-medium">{step.label}</span>
                        <span className="text-muted-foreground">{step.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!compact ? (
                  <>
                    <div>
                      <p className="text-xs font-medium">Suggested sequence structure</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {wizard.configuration.suggested_sequence_structure.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Timing recommendations</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {wizard.configuration.timing_recommendations.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}

                {wizard.risks.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Risks</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {wizard.risks.map((risk) => (
                        <li key={risk.risk_id}>
                          [{risk.severity}] {risk.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {wizard.approval_requirements.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Approval requirements</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {wizard.approval_requirements.map((req) => (
                        <li key={req.requirement_id}>
                          {req.label} ({req.status})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void viewWizard(wizard)}>
                View Wizard
              </Button>
              {wizard.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={wizard.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related Asset
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === wizard.wizard_id}
                onClick={() => void runAction(wizard, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === wizard.wizard_id}
                onClick={() => void runAction(wizard, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
  )
}

export const GrowthCampaignBuilderWizardPanel = withGrowthFeatureShellGate(
  "campaignBuilder",
  GrowthCampaignBuilderWizardPanelInner,
  "GrowthCampaignBuilderWizardPanel",
)
