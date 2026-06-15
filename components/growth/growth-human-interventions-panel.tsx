"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  HUMAN_INTERVENTION_FILTERS,
  HUMAN_INTERVENTION_QA_MARKER,
  HUMAN_INTERVENTION_TYPE_LABELS,
  type HumanIntervention,
  type HumanInterventionFilter,
  type HumanInterventionsResponse,
} from "@/lib/growth/human-interventions/human-intervention-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"
import { GrowthSequencePreviewStudioPanel } from "@/components/growth/growth-sequence-preview-studio-panel"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"

function priorityTone(priority: HumanIntervention["priority"]) {
  switch (priority) {
    case "urgent":
      return "critical" as const
    case "high":
      return "attention" as const
    case "medium":
      return "neutral" as const
    default:
      return "healthy" as const
  }
}

export function GrowthHumanInterventionsPanel({
  title = "Human Interventions",
  leadId,
  compact = false,
}: {
  title?: string
  leadId?: string | null
  compact?: boolean
}) {
  const [filter, setFilter] = useState<HumanInterventionFilter>("all")
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [queue, setQueue] = useState<HumanInterventionsResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      params.set("filter", filter)
      params.set("limit", compact ? "8" : "25")

      const res = await fetch(`/api/platform/growth/human-interventions?${params.toString()}`)
      const data = (await res.json()) as HumanInterventionsResponse & { ok?: boolean }
      setQueue(res.ok ? data : null)
    } catch {
      setQueue(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId])

  useEffect(() => {
    void load()
  }, [load])

  useGrowthRealtimeRefresh({ subscriber: "human_interventions", onRefresh: () => void load() })

  async function runAction(intervention: HumanIntervention, action: "mark_reviewed" | "dismiss") {
    setActingId(intervention.intervention_id)
    try {
      await fetch("/api/platform/growth/human-interventions/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, intervention }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
    <GrowthEngineCard
      title={title}
      icon={<AlertTriangle className="h-4 w-4" />}
      data-qa-marker={HUMAN_INTERVENTION_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Operator intervention queue — prioritizes replies, approvals, risks, and opportunities. Routing and
        recommendations only. No autonomous execution.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {HUMAN_INTERVENTION_FILTERS.map((value) => (
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
        Refresh interventions
      </Button>

      {queue ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{queue.total} interventions</GrowthBadge>
          <GrowthBadge tone="attention">{queue.urgent_count} urgent/high</GrowthBadge>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading && !queue ? (
          <p className="text-sm text-muted-foreground">Loading human interventions…</p>
        ) : null}

        {!loading && (queue?.interventions.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No human interventions matched this filter.</p>
        ) : null}

        {queue?.interventions.map((item) => (
          <div key={item.intervention_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {HUMAN_INTERVENTION_TYPE_LABELS[item.intervention_type]}
                  {item.company_name ? ` · ${item.company_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={priorityTone(item.priority)}>{item.priority}</GrowthBadge>
                <GrowthBadge tone="neutral">{item.resolution.resolution_status}</GrowthBadge>
              </div>
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>
            <p className="mb-2 text-xs text-muted-foreground">
              <span className="font-medium">Trigger:</span> {item.trigger.reason}
            </p>

            {expandedId === item.intervention_id && !compact ? (
              <div className="mb-3 space-y-2">
                {item.supporting_context.length > 0 ? (
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {item.supporting_context.map((ctx) => (
                      <li key={ctx}>{ctx}</li>
                    ))}
                  </ul>
                ) : null}
                {item.recommendations.map((rec) => (
                  <div key={rec.recommendation_id} className="rounded border border-border p-2 text-xs">
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setExpandedId(item.intervention_id)}>
                View Details
              </Button>
              {item.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={item.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related Item
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === item.intervention_id}
                onClick={() => void runAction(item, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === item.intervention_id}
                onClick={() => void runAction(item, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GrowthEngineCard>
    {leadId ? (
      <GrowthSequencePreviewStudioPanel title="Sequence Preview Studio" leadId={leadId} compact={compact} />
    ) : null}
    {leadId ? (
      <GrowthCampaignBuilderWizardPanel title="Campaign Builder Wizard" leadId={leadId} compact={compact} />
    ) : null}
    </>
  )
}
