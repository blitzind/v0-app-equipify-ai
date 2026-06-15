"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import {
  CAMPAIGN_READINESS_QA_MARKER,
  type CampaignReadinessAssessment,
  type CampaignReadinessStatus,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"

function statusTone(status: CampaignReadinessStatus): "healthy" | "attention" | "critical" | "neutral" {
  switch (status) {
    case "ready":
      return "healthy"
    case "partially_ready":
      return "attention"
    default:
      return "critical"
  }
}

function statusLabel(status: CampaignReadinessStatus): string {
  return status.replace(/_/g, " ")
}

function dimensionLevelTone(level: string): "healthy" | "attention" | "critical" | "neutral" {
  switch (level) {
    case "ready":
      return "healthy"
    case "partial":
      return "attention"
    case "blocked":
      return "critical"
    default:
      return "neutral"
  }
}

export function GrowthCampaignReadinessPanel({
  title = "Campaign Readiness",
  leadId,
  executionRunId,
  searchPlanId,
  subjectType,
  subjectRef,
  compact = false,
}: {
  title?: string
  leadId?: string | null
  executionRunId?: string | null
  searchPlanId?: string | null
  subjectType?: "prospect" | "account" | "cohort"
  subjectRef?: string | null
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [acting, setActing] = useState(false)
  const [assessment, setAssessment] = useState<CampaignReadinessAssessment | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      if (executionRunId) params.set("execution_run_id", executionRunId)
      if (searchPlanId) params.set("search_plan_id", searchPlanId)
      if (subjectType) params.set("subject_type", subjectType)
      if (subjectRef) params.set("subject_ref", subjectRef)

      const res = await fetch(`/api/platform/growth/campaign-readiness?${params.toString()}`)
      const data = (await res.json()) as { ok?: boolean; assessment?: CampaignReadinessAssessment }
      setAssessment(res.ok && data.assessment ? data.assessment : null)
    } catch {
      setAssessment(null)
    } finally {
      setLoading(false)
    }
  }, [executionRunId, leadId, searchPlanId, subjectRef, subjectType])

  useEffect(() => {
    void load()
  }, [load])

  async function generateAssessment() {
    setGenerating(true)
    try {
      const res = await fetch("/api/platform/growth/campaign-readiness/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId ?? undefined,
          execution_run_id: executionRunId ?? undefined,
          search_plan_id: searchPlanId ?? undefined,
          subject_type: subjectType,
          subject_ref: subjectRef ?? leadId ?? executionRunId,
          persist_audit: true,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; assessment?: CampaignReadinessAssessment }
      if (res.ok && data.assessment) setAssessment(data.assessment)
    } finally {
      setGenerating(false)
    }
  }

  async function markReviewed() {
    if (!assessment) return
    setActing(true)
    try {
      await fetch("/api/platform/growth/campaign-readiness/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_reviewed",
          assessment_id: assessment.assessment_id,
          assessment,
        }),
      })
      setAssessment({ ...assessment, review_status: "reviewed" })
    } finally {
      setActing(false)
    }
  }

  return (
    <>
    <GrowthEngineCard
      title={title}
      icon={<ClipboardCheck className="h-4 w-4" />}
      data-qa-marker={CAMPAIGN_READINESS_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Advisory campaign readiness assessment — identifies gaps before outreach. Human review required. No autonomous
        execution.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
        <Button size="sm" variant="secondary" disabled={generating} onClick={() => void generateAssessment()}>
          {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Regenerate Assessment
        </Button>
        {assessment ? (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "View Details"}
          </Button>
        ) : null}
      </div>

      {loading && !assessment ? (
        <p className="text-sm text-muted-foreground">Evaluating campaign readiness…</p>
      ) : null}

      {assessment ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <GrowthBadge tone={statusTone(assessment.readiness_status)}>
              {statusLabel(assessment.readiness_status)}
            </GrowthBadge>
            <GrowthBadge tone="neutral">Score {assessment.readiness_score}/100</GrowthBadge>
            {assessment.review_status === "reviewed" ? (
              <GrowthBadge tone="healthy">Reviewed</GrowthBadge>
            ) : (
              <GrowthBadge tone="attention">Pending review</GrowthBadge>
            )}
            {assessment.company_name ? (
              <span className="text-xs text-muted-foreground">{assessment.company_name}</span>
            ) : null}
          </div>

          {expanded ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dimensions</p>
                <div className="space-y-2">
                  {assessment.dimensions.map((dimension) => (
                    <div key={dimension.dimension_id} className="rounded-lg border border-border bg-muted/20 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{dimension.label}</span>
                        <div className="flex gap-2">
                          <GrowthBadge tone={dimensionLevelTone(dimension.level)}>{dimension.level}</GrowthBadge>
                          <GrowthBadge tone="neutral">{dimension.score}/100</GrowthBadge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{dimension.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {assessment.blockers.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers</p>
                  <ul className="space-y-2">
                    {assessment.blockers.map((blocker) => (
                      <li key={blocker.blocker_id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-sm">
                        <GrowthBadge tone={blocker.severity === "critical" ? "critical" : "attention"}>
                          {blocker.severity}
                        </GrowthBadge>
                        <p className="mt-1">{blocker.message}</p>
                        <p className="text-xs text-muted-foreground">{blocker.resolution_hint}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {assessment.recommendations.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recommendations
                  </p>
                  <ul className="space-y-2">
                    {assessment.recommendations.map((rec) => (
                      <li key={rec.recommendation_id} className="rounded-lg border border-border p-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <GrowthBadge tone={rec.priority === "high" ? "attention" : "neutral"}>
                            {rec.priority}
                          </GrowthBadge>
                          <span className="font-medium">{rec.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                        {rec.related_asset_href ? (
                          <Button size="sm" variant="link" className="h-auto px-0" asChild>
                            <Link href={rec.related_asset_href}>
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Open Related Asset
                            </Link>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(assessment.missing_assets.length > 0 || assessment.missing_channels.length > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assessment.missing_assets.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Missing assets
                      </p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {assessment.missing_assets.map((asset) => (
                          <li key={asset}>{asset}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {assessment.missing_channels.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Missing channels
                      </p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {assessment.missing_channels.map((channel) => (
                          <li key={channel}>{channel.replace(/_/g, " ")}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {assessment.required_approvals.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Required approvals
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {assessment.required_approvals.map((approval) => (
                      <li key={approval}>{approval}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {assessment.required_human_actions.length > 0 && !compact ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Required human actions
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {assessment.required_human_actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              View Details
            </Button>
            {assessment.review_status !== "reviewed" ? (
              <Button size="sm" variant="secondary" disabled={acting} onClick={() => void markReviewed()}>
                Mark Reviewed
              </Button>
            ) : null}
            {assessment.lead_id ? (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/admin/growth/leads/${assessment.lead_id}`}>
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open Lead
                </Link>
              </Button>
            ) : null}
          </div>
        </>
      ) : !loading ? (
        <p className="text-sm text-muted-foreground">No campaign readiness assessment available.</p>
      ) : null}
    </GrowthEngineCard>
    {leadId ? <GrowthHumanInterventionsPanel title="Human Interventions" leadId={leadId} compact={compact} /> : null}
    </>
  )
}
