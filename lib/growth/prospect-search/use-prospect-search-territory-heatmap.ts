"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { buildProspectSearchGetRequestParams } from "@/lib/growth/prospect-search/prospect-search-client-request"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthTerritoryOpportunityHeatmapResult } from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import { shouldShowTerritoryOpportunityPanel } from "@/lib/growth/prospect-search/territory-opportunity-heatmap"

const DEBOUNCE_MS = 500

export function useProspectSearchTerritoryHeatmap(input: {
  query: string
  filters: GrowthProspectSearchFilters
  discoveryMode: GrowthProspectSearchDiscoveryMode
  savedSearchRestored?: boolean
  enabled?: boolean
}) {
  const [heatmap, setHeatmap] = useState<GrowthTerritoryOpportunityHeatmapResult | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const filtersKey = useMemo(() => JSON.stringify(input.filters), [input.filters])

  const panelVisible = shouldShowTerritoryOpportunityPanel({
    filters: input.filters,
    savedSearchRestored: input.savedSearchRestored === true,
    heatmap,
  })

  useEffect(() => {
    if (input.enabled === false || input.discoveryMode === "discover_external" || !panelVisible) {
      setHeatmap(null)
      setLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)

      const params = buildProspectSearchGetRequestParams({
        query: input.query,
        filters: input.filters,
        discoveryMode: input.discoveryMode,
        page: 1,
        pageSize: 1,
        includeMeta: false,
      })
      params.delete("meta")
      params.delete("page")
      params.delete("page_size")
      params.delete("sort_by")
      if (input.savedSearchRestored) params.set("saved", "1")

      void fetch(`/api/platform/growth/prospect-search/territory-heatmap?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as {
            ok?: boolean
            heatmap?: GrowthTerritoryOpportunityHeatmapResult | null
          }
          if (requestId !== requestIdRef.current) return
          if (!res.ok || !json.ok || !json.heatmap) {
            setHeatmap(null)
            return
          }
          setHeatmap(json.heatmap)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          if (requestId !== requestIdRef.current) return
          setHeatmap(null)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [
    input.query,
    filtersKey,
    input.discoveryMode,
    input.enabled,
    input.filters,
    input.savedSearchRestored,
    panelVisible,
  ])

  return {
    heatmap,
    loading,
    panelVisible,
  }
}
