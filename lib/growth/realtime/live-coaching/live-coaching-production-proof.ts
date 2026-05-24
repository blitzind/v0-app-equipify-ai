/** Client-safe production verification markers (Growth Engine slice 6.14A). */

export const LIVE_COACHING_QA_PROOF_VERSION = "6.14A" as const

export const LIVE_COACHING_QA_PROOF_MARKER = "live-coaching-qa-v1" as const

export const LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER = "live-coaching-timeline-v1" as const

export const LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER = "live-coaching-insights-v1" as const

export const LIVE_COACHING_TRENDS_QA_PROOF_MARKER = "live-coaching-trends-v1" as const

export const LIVE_COACHING_DASHBOARD_QA_PROOF_MARKER = "live-coaching-dashboard-v1" as const

export const LIVE_COACHING_CLEANUP_QA_PROOF_MARKER = "live-coaching-cleanup-v1" as const

export const LIVE_COACHING_QA_PROOF_LABEL = "Live Coaching QA ready" as const

export function buildLiveCoachingQaProofMarker(input: {
  providerCount: number
  readyProviderCount: number
}): {
  marker: typeof LIVE_COACHING_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  const verified = input.providerCount > 0 && input.readyProviderCount > 0
  return {
    marker: LIVE_COACHING_QA_PROOF_MARKER,
    label: verified ? LIVE_COACHING_QA_PROOF_LABEL : "Live Coaching QA pending provider setup",
    verified,
  }
}

export function buildLiveCoachingSessionTimelineQaProofMarker(input: {
  eventCount: number
}): {
  marker: typeof LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  const verified = input.eventCount > 0
  return {
    marker: LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER,
    label: verified ? "Session timeline diagnostics ready" : "Session timeline pending events",
    verified,
  }
}

export function buildLiveCoachingSessionInsightsQaProofMarker(input: {
  hasRollup: boolean
}): {
  marker: typeof LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  return {
    marker: LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER,
    label: input.hasRollup ? "Session insights rollup ready" : "Session insights pending timeline data",
    verified: input.hasRollup,
  }
}

export function buildLiveCoachingTrendsQaProofMarker(input: {
  sessionCount: number
  truncated?: boolean
}): {
  marker: typeof LIVE_COACHING_TRENDS_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  const verified = input.sessionCount > 0 && !input.truncated
  return {
    marker: LIVE_COACHING_TRENDS_QA_PROOF_MARKER,
    label: verified
      ? "Coaching trends ready"
      : input.truncated
        ? "Coaching trends truncated — narrow filters or range"
        : "Coaching trends pending session insights",
    verified,
  }
}

export function buildLiveCoachingDashboardQaProofMarker(input: {
  completedSessions: number
}): {
  marker: typeof LIVE_COACHING_DASHBOARD_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  const verified = input.completedSessions > 0
  return {
    marker: LIVE_COACHING_DASHBOARD_QA_PROOF_MARKER,
    label: verified ? "Live coaching dashboard ready" : "Live coaching dashboard pending completed sessions",
    verified,
  }
}

export function buildLiveCoachingCleanupQaProofMarker(input: {
  staleStreamsClosed: number
  orphanSessionsDetached: number
  stuckStreamsDetected: number
}): {
  marker: typeof LIVE_COACHING_CLEANUP_QA_PROOF_MARKER
  label: string
  verified: boolean
} {
  const actionsTaken =
    input.staleStreamsClosed + input.orphanSessionsDetached + input.stuckStreamsDetected
  return {
    marker: LIVE_COACHING_CLEANUP_QA_PROOF_MARKER,
    label:
      actionsTaken > 0
        ? `Cleanup completed (${actionsTaken} action${actionsTaken === 1 ? "" : "s"})`
        : "Cleanup ready — no stale sessions detected",
    verified: true,
  }
}
