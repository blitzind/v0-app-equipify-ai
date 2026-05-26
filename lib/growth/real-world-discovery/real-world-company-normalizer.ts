import { createHash } from "node:crypto"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import {
  buildDefaultRealWorldAttribution,
  buildDefaultRealWorldEvidence,
} from "@/lib/growth/real-world-discovery/real-world-company-evidence"
import type {
  GrowthRealWorldDiscoveryAttribution,
  GrowthRealWorldDiscoveryEvidence,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type { GrowthRealWorldDiscoveryProviderRawCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function domainFromWebsite(website: string | null | undefined): string | null {
  const w = asString(website)
  if (!w) return null
  try {
    const host = new URL(w.includes("://") ? w : `https://${w}`).hostname
    return normalizeDomain(host)
  } catch {
    return normalizeDomain(w)
  }
}

export function buildRealWorldCompanyDedupeHash(input: {
  company_name: string
  domain: string | null
  city: string | null
  state: string | null
}): string {
  const key = [
    input.company_name.toLowerCase(),
    input.domain ?? "",
    input.city ?? "",
    input.state ?? "",
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export type NormalizedRealWorldCompanyCandidate = {
  company_name: string
  website: string | null
  domain: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  category: string | null
  description: string | null
  industry: string | null
  location: string | null
  rating: number | null
  review_count: number | null
  source_url: string | null
  source_rank: number | null
  confidence: number
  dedupe_hash: string
  evidence: GrowthRealWorldDiscoveryEvidence[]
  source_attribution: GrowthRealWorldDiscoveryAttribution[]
  raw_payload_server_only: Record<string, unknown> | null
}

export function dedupeNormalizedRealWorldCandidates(
  rows: NormalizedRealWorldCompanyCandidate[],
): NormalizedRealWorldCompanyCandidate[] {
  const seen = new Set<string>()
  const out: NormalizedRealWorldCompanyCandidate[] = []
  for (const row of rows) {
    if (seen.has(row.dedupe_hash)) continue
    seen.add(row.dedupe_hash)
    out.push(row)
  }
  return out
}

export function normalizeRealWorldCompanyCandidate(
  raw: GrowthRealWorldDiscoveryProviderRawCandidate,
  provider_name: string,
  provider_type: string,
  query: string,
): NormalizedRealWorldCompanyCandidate | null {
  const company_name = asString(raw.company_name)
  if (!company_name || company_name.length < 2) return null

  const domain = normalizeDomain(raw.domain) ?? domainFromWebsite(raw.website)
  const website = asString(raw.website) || (domain ? `https://${domain}` : null)
  const city = asString(raw.city) || null
  const state = asString(raw.state) || null
  const country = asString(raw.country) || null
  const location =
    asString(raw.location) ||
    [city, state, country].filter(Boolean).join(", ") ||
    null

  const evidence =
    raw.evidence.length > 0
      ? raw.evidence
      : buildDefaultRealWorldEvidence({
          company_name,
          provider_name,
          provider_type,
          query,
          source_url: raw.source_url,
        })

  const source_attribution =
    raw.source_attribution.length > 0
      ? raw.source_attribution
      : buildDefaultRealWorldAttribution({
          provider_name,
          provider_type,
          evidence: evidence[0]?.evidence ?? company_name,
          confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
        })

  const confidence =
    typeof raw.confidence === "number"
      ? Math.min(0.99, Math.max(0, raw.confidence))
      : Math.min(0.85, 0.45 + source_attribution[0]!.confidence * 0.4)

  return {
    company_name,
    website,
    domain,
    phone: asString(raw.phone) || null,
    address: asString(raw.address) || null,
    city,
    state,
    country,
    category: asString(raw.category) || null,
    description: asString(raw.description) || null,
    industry: asString(raw.industry) || null,
    location,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    review_count: typeof raw.review_count === "number" ? raw.review_count : null,
    source_url: asString(raw.source_url) || null,
    source_rank: typeof raw.source_rank === "number" ? raw.source_rank : null,
    confidence,
    dedupe_hash: buildRealWorldCompanyDedupeHash({
      company_name,
      domain,
      city,
      state,
    }),
    evidence,
    source_attribution,
    raw_payload_server_only:
      raw.raw_payload_server_only && typeof raw.raw_payload_server_only === "object"
        ? raw.raw_payload_server_only
        : null,
  }
}
