"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, ExternalLink, Lightbulb, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  KNOWLEDGE_RECOMMENDATION_QA_MARKER,
  KNOWLEDGE_RECOMMENDATION_TYPE_LABELS,
  type KnowledgeRecommendation,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-types"
import {
  KNOWLEDGE_CONSUMER_LABELS,
  type KnowledgeConsumer,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

function priorityTone(priority: KnowledgeRecommendation["priority"]) {
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

export function GrowthKnowledgeRecommendationsSection({
  consumer,
  title,
  leadId,
  companyId,
  industry,
  defaultQuery,
  compact = false,
}: {
  consumer: KnowledgeConsumer
  title: string
  leadId?: string | null
  companyId?: string | null
  industry?: string | null
  defaultQuery?: string
  compact?: boolean
}) {
  const [query, setQuery] = useState(defaultQuery ?? "")
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<KnowledgeRecommendation[]>([])
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/knowledge/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer,
          query: query.trim() || undefined,
          lead_id: leadId ?? undefined,
          company_id: companyId ?? undefined,
          industry: industry ?? undefined,
          include_private: Boolean(leadId),
          limit: compact ? 4 : 8,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        recommendations?: KnowledgeRecommendation[]
      }
      setRecommendations(res.ok && data.recommendations ? data.recommendations : [])
    } catch {
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [companyId, compact, consumer, industry, leadId, query])

  useEffect(() => {
    void load()
  }, [load])

  function markReviewed(recommendationId: string) {
    setReviewedIds((current) => new Set(current).add(recommendationId))
  }

  function viewDocument(documentId: string) {
    window.open(`/admin/growth/knowledge?document=${encodeURIComponent(documentId)}`, "_blank", "noopener,noreferrer")
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<Lightbulb className="h-4 w-4" />}
      data-qa-marker={KNOWLEDGE_RECOMMENDATION_QA_MARKER}
      data-knowledge-consumer={consumer}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Citation-backed recommendations for {KNOWLEDGE_CONSUMER_LABELS[consumer]} — review only, no autonomous
        execution.
      </p>

      {!compact ? (
        <div className="mb-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Query keywords (e.g. ServiceTitan migration concerns)"
          />
        </div>
      ) : null}

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh recommendations
      </Button>

      {loading && recommendations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Generating recommendations…</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {recommendations.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No citation-backed recommendations matched active knowledge.</p>
        ) : (
          recommendations.map((recommendation) => {
            const reviewed = reviewedIds.has(recommendation.recommendation_id)
            const typeLabel =
              KNOWLEDGE_RECOMMENDATION_TYPE_LABELS[recommendation.recommendation_type] ??
              recommendation.recommendation_type

            return (
              <div
                key={recommendation.recommendation_id}
                className="rounded-xl border border-border bg-muted/20 p-3"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{recommendation.title}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <GrowthBadge tone={priorityTone(recommendation.priority)}>{recommendation.priority}</GrowthBadge>
                    <GrowthBadge tone="neutral">Confidence {recommendation.confidence}</GrowthBadge>
                    {reviewed ? (
                      <GrowthBadge tone="healthy">
                        <CheckCircle2 className="mr-1 inline h-3 w-3" />
                        Reviewed
                      </GrowthBadge>
                    ) : null}
                  </div>
                </div>

                <p className="mb-2 text-sm text-muted-foreground">{recommendation.description}</p>

                {recommendation.reasoning.length > 0 ? (
                  <ul className="mb-2 list-disc pl-4 text-xs text-muted-foreground">
                    {recommendation.reasoning.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mb-3 space-y-1">
                  {recommendation.citations.map((citation) => (
                    <p key={citation.document_id} className="text-xs text-muted-foreground">
                      Citation: {citation.title} ({citation.category})
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {recommendation.citations[0] ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewDocument(recommendation.citations[0].document_id)}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View Document
                    </Button>
                  ) : null}
                  {!reviewed ? (
                    <Button size="sm" variant="secondary" onClick={() => markReviewed(recommendation.recommendation_id)}>
                      Mark Reviewed
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </GrowthEngineCard>
  )
}
