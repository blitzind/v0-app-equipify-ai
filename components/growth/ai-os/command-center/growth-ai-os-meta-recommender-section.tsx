"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { GrowthMetaRecommenderReadModel } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import { GROWTH_META_RECOMMENDER_QA_MARKER } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"

type Props = {
  metaRecommender: GrowthMetaRecommenderReadModel
}

export function GrowthAiOsMetaRecommenderSection({ metaRecommender }: Props) {
  if (metaRecommender.qaMarker !== GROWTH_META_RECOMMENDER_QA_MARKER) return null

  return (
    <section data-qa-section="meta-recommender" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Meta-Recommender</h3>
          <p className="text-xs text-muted-foreground">
            Unified read-only recommendations from existing intelligence signals — no execution.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {metaRecommender.summary.total} ranked
        </Badge>
      </div>

      {metaRecommender.topRecommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ranked recommendations in the current read model.</p>
      ) : (
        <ul className="space-y-3">
          {metaRecommender.topRecommendations.map((recommendation) => (
            <li key={recommendation.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{recommendation.title}</p>
                  <p className="text-xs text-muted-foreground">{recommendation.summary}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">Score {recommendation.score}</Badge>
                  <Badge variant="outline">Conf {recommendation.confidence}</Badge>
                  {recommendation.policy.requiresHumanApproval ? (
                    <Badge variant="destructive">Approval required</Badge>
                  ) : null}
                </div>
              </div>
              {recommendation.suggestedAction?.route ? (
                <Link
                  href={recommendation.suggestedAction.route}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  {recommendation.suggestedAction.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {metaRecommender.sourcesFailed.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Partial read — {metaRecommender.sourcesFailed.length} source(s) skipped without failing the read model.
        </p>
      ) : null}
    </section>
  )
}
