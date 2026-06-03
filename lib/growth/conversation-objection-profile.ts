/** Client-safe normalization for cached conversation objection profiles on leads. */

import type {
  GrowthConversationObjectionCluster,
  GrowthConversationObjectionKey,
  GrowthConversationObjectionProfile,
} from "@/lib/growth/conversation-types"

const EMPTY_PROFILE: GrowthConversationObjectionProfile = {
  clusters: [],
  totalSeverityScore: 0,
}

function isObjectionKey(value: unknown): value is GrowthConversationObjectionKey {
  return typeof value === "string" && value.length > 0
}

function normalizeCluster(entry: unknown): GrowthConversationObjectionCluster | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  if (!isObjectionKey(record.key)) return null
  return {
    key: record.key,
    count: typeof record.count === "number" && Number.isFinite(record.count) ? record.count : 0,
    severityWeight:
      typeof record.severityWeight === "number" && Number.isFinite(record.severityWeight)
        ? record.severityWeight
        : 0,
    lastAt: typeof record.lastAt === "string" ? record.lastAt : null,
  }
}

export function normalizeGrowthConversationObjectionProfile(
  raw: unknown,
): GrowthConversationObjectionProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_PROFILE }
  }

  const record = raw as Record<string, unknown>
  const clusters = Array.isArray(record.clusters)
    ? record.clusters
        .map(normalizeCluster)
        .filter((cluster): cluster is GrowthConversationObjectionCluster => cluster !== null)
    : []

  const totalSeverityScore =
    typeof record.totalSeverityScore === "number" && Number.isFinite(record.totalSeverityScore)
      ? record.totalSeverityScore
      : clusters.reduce((sum, cluster) => sum + cluster.severityWeight * cluster.count, 0)

  return { clusters, totalSeverityScore }
}
