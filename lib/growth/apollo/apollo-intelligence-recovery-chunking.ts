/** Apollo intelligence recovery chunking — client-safe pagination for production-safe execute. */

import type {
  ApolloIntelligenceRecoveryChunkMeta,
  ApolloIntelligenceRecoveryMode,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"

export const APOLLO_INTELLIGENCE_RECOVERY_CHUNKING_QA_MARKER =
  "apollo-intelligence-recovery-chunking-v14-2c" as const

export const APOLLO_INTELLIGENCE_RECOVERY_DEFAULT_CHUNK_LIMIT = 5 as const
export const APOLLO_INTELLIGENCE_RECOVERY_MAX_CHUNK_LIMIT = 25 as const

export type ApolloIntelligenceRecoveryChunkInput = {
  offset?: number
  limit?: number
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return null
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = parseNonNegativeInt(value)
  if (parsed == null || parsed < 1) return null
  return parsed
}

export function resolveApolloIntelligenceRecoveryChunkLimit(
  mode: ApolloIntelligenceRecoveryMode,
  limit: number | null | undefined,
  total_discovered_companies?: number,
): number {
  if (limit != null && limit > 0) {
    return Math.min(APOLLO_INTELLIGENCE_RECOVERY_MAX_CHUNK_LIMIT, Math.floor(limit))
  }
  if (mode === "recover_missing_intelligence") {
    return APOLLO_INTELLIGENCE_RECOVERY_DEFAULT_CHUNK_LIMIT
  }
  if (total_discovered_companies != null) {
    return total_discovered_companies
  }
  return APOLLO_INTELLIGENCE_RECOVERY_MAX_CHUNK_LIMIT
}

export function parseApolloIntelligenceRecoveryChunk(
  record: Record<string, unknown>,
  mode: ApolloIntelligenceRecoveryMode,
): { offset: number; limit?: number } {
  const offset = parseNonNegativeInt(record.offset) ?? 0
  const explicitLimit = parsePositiveInt(record.limit)
  if (explicitLimit != null) {
    return {
      offset,
      limit: Math.min(APOLLO_INTELLIGENCE_RECOVERY_MAX_CHUNK_LIMIT, explicitLimit),
    }
  }
  if (mode === "recover_missing_intelligence") {
    return { offset, limit: APOLLO_INTELLIGENCE_RECOVERY_DEFAULT_CHUNK_LIMIT }
  }
  return { offset }
}

export function buildApolloIntelligenceRecoveryChunkMeta(input: {
  offset: number
  limit: number
  total_discovered_companies: number
  processed_count: number
}): ApolloIntelligenceRecoveryChunkMeta {
  const chunkEnd = input.offset + input.processed_count
  const has_more = chunkEnd < input.total_discovered_companies
  return {
    offset: input.offset,
    limit: input.limit,
    total_discovered_companies: input.total_discovered_companies,
    processed_count: input.processed_count,
    has_more,
    next_offset: has_more ? chunkEnd : null,
  }
}
