/** Transport health aggregation — client-safe. */

import type {
  GrowthDeliveryAttempt,
  GrowthProviderRateLimitRow,
  GrowthTransportHealthSnapshot,
} from "@/lib/growth/providers/adapters/provider-adapter-types"
import { GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER } from "@/lib/growth/providers/adapters/provider-adapter-types"
import { checkTransportRateLimit } from "@/lib/growth/providers/transport/transport-rate-limit"

export function buildTransportHealthSnapshot(input: {
  attempts: GrowthDeliveryAttempt[]
  rate_limits: GrowthProviderRateLimitRow[]
  connected_provider_count: number
}): GrowthTransportHealthSnapshot {
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000

  const recent = input.attempts.filter((attempt) => new Date(attempt.created_at).getTime() >= dayAgo)

  const rateLimitedProviders = input.rate_limits.filter((row) => !checkTransportRateLimit(row, 1).allowed).length

  return {
    qa_marker: GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER,
    queued_count: input.attempts.filter((attempt) => attempt.status === "queued").length,
    sent_count_24h: recent.filter((attempt) => attempt.status === "sent").length,
    failed_count_24h: recent.filter((attempt) => attempt.status === "failed").length,
    retry_scheduled_count: input.attempts.filter((attempt) => attempt.status === "retry_scheduled").length,
    rate_limited_providers: rateLimitedProviders,
    healthy_providers: Math.max(0, input.connected_provider_count - rateLimitedProviders),
  }
}

export function transportHealthLabel(snapshot: GrowthTransportHealthSnapshot): string {
  if (snapshot.failed_count_24h >= 5 || snapshot.rate_limited_providers > 0) return "Attention"
  if (snapshot.retry_scheduled_count > 0 || snapshot.queued_count > 10) return "Monitor"
  return "Healthy"
}
