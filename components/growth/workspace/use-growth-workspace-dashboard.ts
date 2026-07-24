"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
} from "@/lib/growth/home/growth-home-workspace-api-contract"
import {
  readGrowthHomeExecutiveSessionCache,
  writeGrowthHomeExecutiveSessionCache,
} from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import {
  GROWTH_HOME_CRITICAL_EXECUTIVE_CLIENT_TIMEOUT_MS,
  GROWTH_HOME_SECONDARY_WORKSPACE_SUMMARY_TIMEOUT_MS,
  isGrowthHomeCriticalExecutiveLoadActionable,
  mergeGrowthHomeWorkspaceSummaryWithCriticalState,
  type GrowthHomeCriticalExecutiveStatePayload,
} from "@/lib/growth/home/growth-home-critical-executive-state-2b-1c"
import { logGrowthHomeMountStage } from "@/lib/growth/home/growth-home-mount-diagnostics-2b-1d"
import {
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

const EMPTY_SOURCES: GrowthWorkspaceDashboardSourcePayload = {
  briefing: null,
  leadInboxSections: [],
  cadenceSummary: null,
  pipelineDashboard: null,
  opportunityReadiness: null,
  sequenceFoundation: null,
  sequenceExecution: null,
  engagementWorkspace: null,
  conversationDashboard: null,
  relationshipDashboard: null,
  callsDashboard: null,
  dailyRevenueWorkQueueEnabled: false,
  dailyRevenueWorkQueue: null,
  dailyRevenueWorkQueueDisplay: null,
}

function applyWorkspaceSummaryPayload(
  payload: GrowthHomeWorkspaceSummaryPayload,
): {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload
  avaConsole: GrowthHomeWorkspaceSummaryPayload["avaConsole"]
} {
  const normalized = normalizeGrowthHomeWorkspaceSummaryPayload(payload)
  return {
    dashboard: normalized.dashboard ?? buildGrowthWorkspaceDashboardViewModel(normalized.sources),
    workspaceSummary: normalized,
    avaConsole: normalized.avaConsole ?? null,
  }
}

function applyCriticalExecutivePayload(input: {
  critical: GrowthHomeCriticalExecutiveStatePayload
  existing: GrowthHomeWorkspaceSummaryPayload | null
}): {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload
  avaConsole: GrowthHomeWorkspaceSummaryPayload["avaConsole"]
} {
  const merged = mergeGrowthHomeWorkspaceSummaryWithCriticalState({
    existing: input.existing,
    critical: input.critical,
  })
  return applyWorkspaceSummaryPayload(merged)
}

function readInitialExecutiveCache(): GrowthHomeWorkspaceSummaryPayload | null {
  return readGrowthHomeExecutiveSessionCache()
}

function buildInitialAppliedFromCache(): ReturnType<typeof applyWorkspaceSummaryPayload> | null {
  try {
    const cached = readInitialExecutiveCache()
    return cached ? applyWorkspaceSummaryPayload(cached) : null
  } catch (error) {
    logGrowthHomeMountStage("hook_initialized", {
      cache_apply_error: error instanceof Error ? error.message : "unknown",
    })
    return null
  }
}

async function fetchJsonWithTimeout<T>(input: {
  url: string
  timeoutMs: number
  externalSignal?: AbortSignal
}): Promise<
  | { ok: true; data: T; durationMs: number }
  | { ok: false; timedOut: boolean; errorMessage: string; durationMs: number }
> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort()
  input.externalSignal?.addEventListener("abort", onExternalAbort)
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const res = await fetch(input.url, {
      cache: "no-store",
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; message?: string }
    const durationMs = Date.now() - startedAt
    if (!res.ok || data.ok === false) {
      const message =
        typeof data === "object" && data && "message" in data && typeof data.message === "string"
          ? data.message
          : "Could not load Home executive state."
      return { ok: false, timedOut: false, errorMessage: message, durationMs }
    }
    return { ok: true, data, durationMs }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const timedOut = error instanceof Error && error.name === "AbortError"
    return {
      ok: false,
      timedOut,
      errorMessage: timedOut
        ? "Home is taking longer than expected. Please retry in a moment."
        : error instanceof Error
          ? error.message
          : "Could not load Home executive state.",
      durationMs,
    }
  } finally {
    clearTimeout(timeoutId)
    input.externalSignal?.removeEventListener("abort", onExternalAbort)
  }
}

function logHomeCriticalFetch(input: {
  requestGeneration: number
  retryAttempt: number
  critical: GrowthHomeCriticalExecutiveStatePayload | null
  durationMs: number | null
  timedOut: boolean
}): void {
  if (typeof window === "undefined") return
  console.info("[growth/home/critical-fetch]", {
    endpoint: GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
    request_generation: input.requestGeneration,
    retry_attempt: input.retryAttempt,
    duration_ms: input.durationMs,
    timed_out: input.timedOut,
    critical_availability: input.critical?.criticalLoad?.availability ?? null,
    pending_approvals: input.critical?.canonicalOperatorApproval?.pendingApprovalCount ?? null,
    executive_load: input.critical?.executiveLoad ?? null,
  })
}

function logHomeDashboardFetch(input: {
  requestGeneration: number
  payload: GrowthHomeWorkspaceSummaryPayload | null
  durationMs: number | null
  secondary: boolean
}): void {
  if (typeof window === "undefined") return
  console.info("[growth/home/dashboard-fetch]", {
    batch: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    endpoint: GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
    request_generation: input.requestGeneration,
    secondary: input.secondary,
    duration_ms: input.durationMs ?? input.payload?.optimization?.durationMs ?? null,
    executive_load: input.payload?.executiveLoad ?? null,
  })
}

/** Single canonical load — GET /home/workspace-summary (GE-SIMPLIFY-1B). */
export async function loadGrowthWorkspaceDashboardSources(): Promise<GrowthWorkspaceDashboardSourcePayload> {
  const cached = readGrowthHomeExecutiveSessionCache()
  return cached?.sources ?? EMPTY_SOURCES
}

export function useGrowthWorkspaceDashboard() {
  const [initialApplied] = useState(buildInitialAppliedFromCache)

  const [dashboard, setDashboard] = useState<GrowthWorkspaceDashboardViewModel | null>(
    initialApplied?.dashboard ?? null,
  )
  const [workspaceSummary, setWorkspaceSummary] = useState<GrowthHomeWorkspaceSummaryPayload | null>(
    initialApplied?.workspaceSummary ?? null,
  )
  const [avaConsole, setAvaConsole] = useState<GrowthHomeWorkspaceSummaryPayload["avaConsole"] | null>(
    initialApplied?.avaConsole ?? null,
  )
  const [loading, setLoading] = useState(!initialApplied)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [lastRetryOutcome, setLastRetryOutcome] = useState<string | null>(null)
  const [secondaryLoading, setSecondaryLoading] = useState(false)

  const requestGenerationRef = useRef(0)
  const retryAttemptRef = useRef(0)
  const criticalAbortRef = useRef<AbortController | null>(null)
  const secondaryAbortRef = useRef<AbortController | null>(null)
  const workspaceSummaryRef = useRef(workspaceSummary)
  workspaceSummaryRef.current = workspaceSummary

  const abortInflightRequests = useCallback((which: "critical" | "secondary" | "all") => {
    if (which === "critical" || which === "all") {
      criticalAbortRef.current?.abort()
      criticalAbortRef.current = null
    }
    if (which === "secondary" || which === "all") {
      secondaryAbortRef.current?.abort()
      secondaryAbortRef.current = null
    }
  }, [])

  const loadSecondaryWorkspaceSummary = useCallback(
    async (requestGeneration: number) => {
      abortInflightRequests("secondary")
      const controller = new AbortController()
      secondaryAbortRef.current = controller
      setSecondaryLoading(true)

      const url = `${GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH}?g=${requestGeneration}&secondary=1`
      const result = await fetchJsonWithTimeout<GrowthHomeWorkspaceSummaryPayload>({
        url,
        timeoutMs: GROWTH_HOME_SECONDARY_WORKSPACE_SUMMARY_TIMEOUT_MS,
        externalSignal: controller.signal,
      })

      if (requestGeneration !== requestGenerationRef.current) {
        return
      }

      logHomeDashboardFetch({
        requestGeneration,
        payload: result.ok ? normalizeGrowthHomeWorkspaceSummaryPayload(result.data) : null,
        durationMs: result.durationMs,
        secondary: true,
      })

      if (result.ok) {
        const fullApplied = applyWorkspaceSummaryPayload(result.data)
        writeGrowthHomeExecutiveSessionCache(fullApplied.workspaceSummary)
        setDashboard(fullApplied.dashboard)
        setWorkspaceSummary(fullApplied.workspaceSummary)
        setAvaConsole(fullApplied.avaConsole)
        setError(null)
        setLastRetryOutcome(null)
      }

      setSecondaryLoading(false)
    },
    [abortInflightRequests],
  )

  const reload = useCallback(async () => {
    abortInflightRequests("all")
    const requestGeneration = ++requestGenerationRef.current
    retryAttemptRef.current += 1
    const attempt = retryAttemptRef.current
    setRetryAttempt(attempt)

    logGrowthHomeMountStage("critical_request_started", {
      request_generation: requestGeneration,
      retry_attempt: attempt,
    })

    const hasConfirmedExecutiveState = Boolean(workspaceSummaryRef.current)
    if (hasConfirmedExecutiveState) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    setLastRetryOutcome(null)

    const criticalController = new AbortController()
    criticalAbortRef.current = criticalController

    const criticalUrl = `${GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH}?g=${requestGeneration}&retry=${attempt}&t=${Date.now()}`
    const criticalResult = await fetchJsonWithTimeout<GrowthHomeCriticalExecutiveStatePayload>({
      url: criticalUrl,
      timeoutMs: GROWTH_HOME_CRITICAL_EXECUTIVE_CLIENT_TIMEOUT_MS,
      externalSignal: criticalController.signal,
    })

    if (requestGeneration !== requestGenerationRef.current) {
      return
    }

    logHomeCriticalFetch({
      requestGeneration,
      retryAttempt: attempt,
      critical: criticalResult.ok ? criticalResult.data : null,
      durationMs: criticalResult.durationMs,
      timedOut: !criticalResult.ok && criticalResult.timedOut,
    })

    if (
      criticalResult.ok &&
      isGrowthHomeCriticalExecutiveLoadActionable(criticalResult.data.criticalLoad)
    ) {
      const applied = applyCriticalExecutivePayload({
        critical: criticalResult.data,
        existing: workspaceSummaryRef.current,
      })
      writeGrowthHomeExecutiveSessionCache(applied.workspaceSummary)
      setDashboard(applied.dashboard)
      setWorkspaceSummary(applied.workspaceSummary)
      setAvaConsole(applied.avaConsole)
      setError(null)
      setLastRetryOutcome(null)
      setLoading(false)
      setRefreshing(false)
      void loadSecondaryWorkspaceSummary(requestGeneration)
      return
    }

    const failureMessage = criticalResult.ok
      ? "Could not confirm Home executive state."
      : criticalResult.errorMessage

    setError(failureMessage)
    setLastRetryOutcome(
      criticalResult.ok
        ? "Home executive state is still unavailable."
        : criticalResult.timedOut
          ? "Retry timed out before the critical briefing could load."
          : "Retry could not load the critical briefing.",
    )

    const preserved = workspaceSummaryRef.current ?? readGrowthHomeExecutiveSessionCache()
    if (preserved) {
      const applied = applyWorkspaceSummaryPayload(preserved)
      setDashboard(applied.dashboard)
      setWorkspaceSummary(applied.workspaceSummary)
      setAvaConsole(applied.avaConsole)
    }

    setLoading(false)
    setRefreshing(false)
  }, [abortInflightRequests, loadSecondaryWorkspaceSummary])

  useEffect(() => {
    logGrowthHomeMountStage("hook_initialized", {
      has_cached_executive_state: Boolean(initialApplied),
    })
  }, [initialApplied])

  useEffect(() => {
    logGrowthHomeMountStage("critical_effect_registered")
    void reload()
    return () => {
      abortInflightRequests("all")
    }
  }, [reload, abortInflightRequests])

  return {
    dashboard,
    workspaceSummary,
    avaConsole,
    loading,
    refreshing,
    secondaryLoading,
    error,
    retryAttempt,
    lastRetryOutcome,
    reload,
    fetchBatchMarker: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    debugSourcePath: GROWTH_HOME_DEBUG_SOURCE_API_PATH,
    requestGeneration: requestGenerationRef.current,
  }
}
