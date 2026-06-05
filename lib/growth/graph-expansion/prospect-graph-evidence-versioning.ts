/** Phase 7.PS-HS — Evidence versioning for prospect graph expansion. Server-only. */

import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthProspectGraphEvidenceVersion,
  GrowthProspectGraphExpansionMetrics,
  GrowthProspectSourceType,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"
import { listLiveProspectSources } from "@/lib/growth/graph-expansion/prospect-source-registry"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function versionId(company_id: string, captured_at: string): string {
  return createHash("sha256").update(`${company_id}|${captured_at}`).digest("hex").slice(0, 16)
}

export function buildProspectGraphEvidenceVersion(input: {
  company_id: string
  metrics_snapshot: GrowthProspectGraphExpansionMetrics
  source_types_observed: GrowthProspectSourceType[]
  evidence_count: number
  captured_at?: string
}): GrowthProspectGraphEvidenceVersion {
  const captured_at = input.captured_at ?? new Date().toISOString()
  return {
    version_id: versionId(input.company_id, captured_at),
    captured_at,
    company_id: input.company_id,
    source_types_observed: input.source_types_observed,
    evidence_count: input.evidence_count,
    metrics_snapshot: input.metrics_snapshot,
    evidence: [
      {
        claim: "Graph expansion evidence version captured",
        evidence: `sources=${input.source_types_observed.join(",")} evidence_count=${input.evidence_count}`,
        source: "prospect_graph_expansion",
      },
    ],
  }
}

export async function persistProspectGraphEvidenceVersion(
  admin: SupabaseClient,
  version: GrowthProspectGraphEvidenceVersion,
): Promise<{ ok: boolean; version_id: string }> {
  const { data: row } = await admin
    .schema("growth")
    .from("companies")
    .select("metadata")
    .eq("id", version.company_id)
    .maybeSingle()

  const metadata =
    row?.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {}

  const existing = Array.isArray(metadata.prospect_graph_evidence_versions)
    ? (metadata.prospect_graph_evidence_versions as GrowthProspectGraphEvidenceVersion[])
    : []

  const nextVersions = [version, ...existing].slice(0, 12)

  const { error } = await admin
    .schema("growth")
    .from("companies")
    .update({
      metadata: {
        ...metadata,
        prospect_graph_expansion: {
          last_version_id: version.version_id,
          last_captured_at: version.captured_at,
          source_types_observed: version.source_types_observed,
          registry_qa_marker: "growth-prospect-source-registry-7-ps-hs-v1",
        },
        prospect_graph_evidence_versions: nextVersions,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", version.company_id)

  return { ok: !error, version_id: version.version_id }
}

export function resolveObservedProspectSourcesFromContactMetadata(input: {
  source_type?: string | null
  metadata?: Record<string, unknown> | null
  source_evidence?: Array<{ source?: string }> | null
}): GrowthProspectSourceType[] {
  const observed = new Set<GrowthProspectSourceType>()
  const sourceType = asString(input.source_type)
  if (sourceType === "team_page") {
    observed.add("team_page")
  } else if (sourceType === "contact_page") {
    observed.add("contact_page")
  } else if (sourceType === "website") {
    observed.add("website")
  } else if (sourceType === "public_record") {
    observed.add("directory")
  }

  const pageType = asString(input.metadata?.source_page_type)
  if (pageType === "leadership") observed.add("leadership_page")
  if (pageType === "team" || pageType === "staff") observed.add("team_page")
  if (pageType === "contact") observed.add("contact_page")

  for (const row of input.source_evidence ?? []) {
    const source = asString(row.source)
    if (source.includes("schema")) observed.add("schema_org")
  }

  if (observed.size === 0) {
    for (const live of listLiveProspectSources()) {
      if (live.requires_public_url) continue
      // directory / association / conference are populated by discovery runs, not website crawl
    }
  }

  return [...observed]
}
