/** Client-safe production verification markers (Growth Engine slice 6.12F). */

export const LIVE_COACHING_QA_PROOF_VERSION = "6.13B" as const

export const LIVE_COACHING_QA_PROOF_MARKER = "live-coaching-qa-v1" as const

export const LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER = "live-coaching-timeline-v1" as const

export const LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER = "live-coaching-insights-v1" as const

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
  const verified = input.eventCount >= 0
  return {
    marker: LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER,
    label: verified ? "Session timeline diagnostics ready" : "Session timeline pending",
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
