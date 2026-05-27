"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { buildProspectSearchGetRequestParams } from "@/lib/growth/prospect-search/prospect-search-client-request"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

const DEBOUNCE_MS = 500

export function useProspectSearchLiveEstimation(input: {
  query: string
  filters: GrowthProspectSearchFilters
  discoveryMode: GrowthProspectSearchDiscoveryMode
  enabled?: boolean
}) {
  const [estimate, setEstimate] = useState<GrowthProspectSearchLiveEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const filtersKey = useMemo(() => JSON.stringify(input.filters), [input.filters])

  useEffect(() => {
    if (input.enabled === false) return

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

      void fetch(`/api/platform/growth/prospect-search/estimate?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as {
            ok?: boolean
            estimate?: GrowthProspectSearchLiveEstimate
          }
          if (requestId !== requestIdRef.current) return
          if (!res.ok || !json.ok || !json.estimate) {
            setEstimate(null)
            return
          }
          setEstimate(json.estimate)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          if (requestId !== requestIdRef.current) return
          setEstimate(null)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [input.query, filtersKey, input.discoveryMode, input.enabled, input.filters])

  const displayState = loading
    ? ("estimating" as const)
    : (estimate?.state ?? "ready")

  return {
    estimate,
    loading,
    displayState,
  }
}
