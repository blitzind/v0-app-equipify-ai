"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildProspectSearchGetRequestParams } from "@/lib/growth/prospect-search/prospect-search-client-request"
import {
  buildProspectSearchEstimateCriteriaKey,
  hasProspectSearchEstimateCriteria,
  isProspectSearchLiveEstimateStale,
} from "@/lib/growth/prospect-search/prospect-search-estimate-visibility"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

const DEBOUNCE_MS = 400

export function useProspectSearchLiveEstimation(input: {
  query: string
  filters: GrowthProspectSearchFilters
  discoveryMode: GrowthProspectSearchDiscoveryMode
  enabled?: boolean
}) {
  const [estimate, setEstimate] = useState<GrowthProspectSearchLiveEstimate | null>(null)
  const [matchedCriteriaKey, setMatchedCriteriaKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const criteriaKey = useMemo(
    () => buildProspectSearchEstimateCriteriaKey(input.query, input.filters),
    [input.query, input.filters],
  )
  const hasCriteria = useMemo(
    () => hasProspectSearchEstimateCriteria(input.query, input.filters),
    [input.query, input.filters],
  )

  const isStale = isProspectSearchLiveEstimateStale(criteriaKey, matchedCriteriaKey)

  useEffect(() => {
    if (input.enabled === false || !hasCriteria) {
      abortRef.current?.abort()
      requestIdRef.current += 1
      setEstimate(null)
      setMatchedCriteriaKey(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      const fetchCriteriaKey = criteriaKey

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
            estimate?: GrowthProspectSearchLiveEstimate | null
          }
          if (requestId !== requestIdRef.current) return
          if (fetchCriteriaKey !== buildProspectSearchEstimateCriteriaKey(input.query, input.filters)) {
            return
          }
          if (!res.ok || !json.ok || !json.estimate || json.estimate.estimate_visible === false) {
            setEstimate(null)
            setMatchedCriteriaKey(fetchCriteriaKey)
            return
          }
          setEstimate(json.estimate)
          setMatchedCriteriaKey(fetchCriteriaKey)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          if (requestId !== requestIdRef.current) return
          setEstimate(null)
          setMatchedCriteriaKey(fetchCriteriaKey)
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
    criteriaKey,
    hasCriteria,
    input.discoveryMode,
    input.enabled,
    input.filters,
    input.query,
  ])

  const displayState = !hasCriteria
    ? ("awaiting_filters" as const)
    : loading || isStale
      ? ("estimating" as const)
      : (estimate?.state ?? "ready")

  const visibleEstimate =
    hasCriteria && !isStale && estimate?.estimate_visible !== false ? estimate : null

  const resetEstimate = useCallback(() => {
    abortRef.current?.abort()
    requestIdRef.current += 1
    setEstimate(null)
    setMatchedCriteriaKey(null)
    setLoading(false)
  }, [])

  return {
    estimate: visibleEstimate,
    loading: hasCriteria && (loading || isStale),
    displayState,
    hasCriteria,
    isStale,
    resetEstimate,
  }
}
