"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthCompanyRelationship } from "@/lib/growth/market-intelligence/market-intelligence-types"
import { GROWTH_MARKET_INTELLIGENCE_QA_MARKER } from "@/lib/growth/market-intelligence/market-intelligence-types"

function strengthTone(strength: number): "healthy" | "medium" | "neutral" {
  if (strength >= 80) return "healthy"
  if (strength >= 65) return "medium"
  return "neutral"
}

function relationshipLabel(type: GrowthCompanyRelationship["relationship_type"]): string {
  return type.replace(/_/g, " ")
}

export function RelatedCompaniesPanel({
  relatedCompanies,
  companyName,
}: {
  relatedCompanies: GrowthCompanyRelationship[]
  companyName: string
}) {
  const topFive = relatedCompanies.slice(0, 5)

  return (
    <GrowthEngineCard title="Related Companies">
      <p className="mb-3 text-xs text-muted-foreground">
        Market graph for {companyName} · {GROWTH_MARKET_INTELLIGENCE_QA_MARKER}
      </p>
      {topFive.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No related companies with evidence-backed relationships in the current result set.
        </p>
      ) : (
        <ul className="space-y-3">
          {topFive.map((relationship) => (
            <li
              key={`${relationship.related_company_id}-${relationship.relationship_type}`}
              className="rounded-lg border border-border/80 bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{relationship.related_company_name}</p>
                <GrowthBadge
                  label={`${relationship.relationship_strength}% confidence`}
                  tone={strengthTone(relationship.relationship_strength)}
                />
              </div>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {relationshipLabel(relationship.relationship_type)}
              </p>
              <p className="mt-1 text-xs text-foreground/90">{relationship.evidence_excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
