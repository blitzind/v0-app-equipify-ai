"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MapPin, RefreshCw, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthTerritoryIntelligenceSummary } from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

function scoreTone(score: number): "attention" | "healthy" | "medium" | "neutral" {
  if (score >= 80) return "attention"
  if (score >= 60) return "healthy"
  if (score >= 35) return "medium"
  return "neutral"
}

export function TerritoryIntelligencePanel({
  summary,
  filters,
  query,
  loading,
  onSaveTerritory,
  onRefreshTerritory,
  onPushTopProspects,
}: {
  summary: GrowthTerritoryIntelligenceSummary | null | undefined
  filters: GrowthProspectSearchFilters
  query: string
  loading?: boolean
  onSaveTerritory: (name: string) => Promise<void>
  onRefreshTerritory: () => Promise<void>
  onPushTopProspects: () => Promise<void>
}) {
  const [territoryName, setTerritoryName] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (summary?.territory_name && summary.territory_id !== "ephemeral") {
      setTerritoryName(summary.territory_name)
    }
  }, [summary?.territory_id, summary?.territory_name])

  const runAction = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setActionLoading(key)
      try {
        await fn()
      } finally {
        setActionLoading(null)
      }
    },
    [],
  )

  const hasTerritoryContext = Boolean(summary || filters.territory_filter)

  if (!hasTerritoryContext) {
    return (
      <section
        className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground"
        data-qa-marker="growth-territory-intelligence-v1"
      >
        Add a territory filter (state, city, ZIP, or radius) to see opportunity maps and whitespace scoring.
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
      data-qa-marker="growth-territory-intelligence-v1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MapPin className="size-4 text-emerald-800" />
          <h4 className="text-sm font-semibold text-emerald-950">
            Territory intelligence{summary?.territory_name ? ` — ${summary.territory_name}` : ""}
          </h4>
          {summary ? (
            <GrowthBadge
              label={`${summary.territory_opportunity_score}/100 opportunity`}
              tone={scoreTone(summary.territory_opportunity_score)}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(loading || actionLoading)}
            onClick={() => void runAction("refresh", onRefreshTerritory)}
          >
            {actionLoading === "refresh" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3.5" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(loading || actionLoading)}
            onClick={() => void runAction("push", onPushTopProspects)}
          >
            {actionLoading === "push" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 size-3.5" />
            )}
            Push top prospects
          </Button>
        </div>
      </div>

      {summary ? (
        <>
          <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <span>{summary.company_count} companies · {summary.mapped_company_count} mapped</span>
            <span>{summary.high_fit_count} high-fit prospects</span>
            <span>Contact coverage {summary.contact_coverage_avg}%</span>
            <span>Growth signal density {summary.growth_signal_density}%</span>
            <span>Whitespace score {summary.whitespace_score}</span>
            <span>{summary.cluster_count} clusters</span>
            <span>
              Existing overlap {summary.existing_customer_count + summary.existing_prospect_count}
              {summary.suppressed_count ? ` · ${summary.suppressed_count} suppressed` : ""}
            </span>
            {summary.last_computed_at ? (
              <span>Updated {new Date(summary.last_computed_at).toLocaleDateString()}</span>
            ) : null}
          </div>

          {summary.top_signal_companies.length ? (
            <ul className="mt-3 space-y-1.5">
              {summary.top_signal_companies.slice(0, 5).map((company) => (
                <li key={`${company.source_type}:${company.company_id}`} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                  <span className="font-medium">{company.company_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {company.score_bucket}
                    {company.growth_signal_score != null ? ` · signal ${company.growth_signal_score}` : ""}
                    {!company.is_mapped ? " · unmapped" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Run search to compute territory opportunity from current results.</p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-emerald-100 pt-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          Territory name
          <input
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            value={territoryName}
            onChange={(e) => setTerritoryName(e.target.value)}
            placeholder={query ? `Territory for ${query}` : "Named territory"}
          />
        </label>
        <Button
          size="sm"
          disabled={Boolean(loading || actionLoading) || !territoryName.trim()}
          onClick={() => void runAction("save", () => onSaveTerritory(territoryName.trim()))}
        >
          {actionLoading === "save" ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 size-3.5" />
          )}
          Save territory
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Map points use indexed coordinates only. Companies without lat/lng appear as unmapped — coordinates are never guessed.
      </p>
    </section>
  )
}
