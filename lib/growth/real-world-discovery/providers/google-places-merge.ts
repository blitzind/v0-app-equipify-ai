import type { GrowthRealWorldDiscoveryProviderRawCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { computeGooglePlacesIcpFitScore } from "@/lib/growth/real-world-discovery/providers/google-places-query-expansion"

function mergeKey(row: GrowthRealWorldDiscoveryProviderRawCandidate): string {
  const placeId = row.raw_payload_server_only?.google_place_id
  if (typeof placeId === "string" && placeId.trim()) return `place:${placeId.trim()}`
  return [
    row.company_name.trim().toLowerCase(),
    row.city?.trim().toLowerCase() ?? "",
    row.state?.trim().toLowerCase() ?? "",
  ].join("|")
}

export function mergeGooglePlacesCandidates(
  rows: GrowthRealWorldDiscoveryProviderRawCandidate[],
  inputs: GrowthRealWorldDiscoverySearchInputs,
): GrowthRealWorldDiscoveryProviderRawCandidate[] {
  const byKey = new Map<string, GrowthRealWorldDiscoveryProviderRawCandidate>()

  for (const row of rows) {
    const key = mergeKey(row)
    const matchedQueries = Array.isArray(row.raw_payload_server_only?.matched_queries)
      ? (row.raw_payload_server_only!.matched_queries as string[])
      : typeof row.raw_payload_server_only?.matched_query === "string"
        ? [row.raw_payload_server_only.matched_query as string]
        : []

    const existing = byKey.get(key)
    if (!existing) {
      const icp_fit_score = computeGooglePlacesIcpFitScore(row, inputs, matchedQueries)
      byKey.set(key, {
        ...row,
        raw_payload_server_only: {
          ...row.raw_payload_server_only,
          matched_queries: matchedQueries,
          icp_fit_score,
        },
      })
      continue
    }

    const combinedQueries = uniqueStrings([
      ...(Array.isArray(existing.raw_payload_server_only?.matched_queries)
        ? (existing.raw_payload_server_only!.matched_queries as string[])
        : []),
      ...matchedQueries,
    ])

    const icp_fit_score = Math.max(
      typeof existing.raw_payload_server_only?.icp_fit_score === "number"
        ? existing.raw_payload_server_only.icp_fit_score
        : 0,
      computeGooglePlacesIcpFitScore(row, inputs, combinedQueries),
    )

    const keepExistingRank =
      typeof existing.source_rank === "number" &&
      typeof row.source_rank === "number" &&
      existing.source_rank <= row.source_rank

    byKey.set(key, {
      ...(keepExistingRank ? existing : row),
      evidence: uniqueEvidence([...existing.evidence, ...row.evidence]).slice(0, 4),
      source_attribution: uniqueAttribution([
        ...existing.source_attribution,
        ...row.source_attribution,
      ]).slice(0, 3),
      confidence: Math.max(existing.confidence ?? 0, row.confidence ?? 0),
      raw_payload_server_only: {
        ...(keepExistingRank ? existing.raw_payload_server_only : row.raw_payload_server_only),
        matched_queries: combinedQueries,
        icp_fit_score,
      },
    })
  }

  return [...byKey.values()].sort((a, b) => {
    const aScore =
      typeof a.raw_payload_server_only?.icp_fit_score === "number"
        ? a.raw_payload_server_only.icp_fit_score
        : 0
    const bScore =
      typeof b.raw_payload_server_only?.icp_fit_score === "number"
        ? b.raw_payload_server_only.icp_fit_score
        : 0
    if (bScore !== aScore) return bScore - aScore
    return (a.source_rank ?? 999) - (b.source_rank ?? 999)
  })
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const v = value.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function uniqueEvidence<T extends { evidence: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = row.evidence.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function uniqueAttribution<T extends { evidence: string }>(rows: T[]): T[] {
  return uniqueEvidence(rows)
}
