/** Phase 7.PS-HS — Continuous prospect graph acquisition framework. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS } from "@/lib/growth/discovery-engine/discovery-segments"
import {
  processDiscoveryRefreshQueue,
  queueNightlyDiscoverySegments,
  runContinuousDiscoverySegment,
} from "@/lib/growth/discovery-engine/discovery-repository"
import {
  GROWTH_PROSPECT_CONTINUOUS_ACQUISITION_QA_MARKER,
  GROWTH_PROSPECT_SOURCE_TYPES,
  type GrowthProspectSourceType,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"
import {
  buildProspectGraphEvidenceVersion,
  persistProspectGraphEvidenceVersion,
  resolveObservedProspectSourcesFromContactMetadata,
} from "@/lib/growth/graph-expansion/prospect-graph-evidence-versioning"
import { loadProspectGraphExpansionMetrics } from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import {
  listLiveProspectSources,
  sortProspectSourcesByPriority,
} from "@/lib/growth/graph-expansion/prospect-source-registry"
import { runProspectSearchHumanAcquisitionPipeline } from "@/lib/growth/prospect-search/prospect-search-human-acquisition"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ProspectGraphAnchorCompany = {
  company_candidate_id: string
  canonical_company_id: string
  company_name: string
  search_query: string
}

export const GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS = [
  {
    key: "graph_biomedical",
    label: "Graph expansion — biomedical",
    query: "biomedical equipment service companies",
    industry: "biomedical equipment service",
    discovery_source_type: "industry_expansion" as const,
  },
  {
    key: "graph_medical_repair",
    label: "Graph expansion — medical repair",
    query: "medical equipment repair companies",
    industry: "medical equipment repair",
    discovery_source_type: "industry_expansion" as const,
  },
] as const

export async function queueProspectGraphAcquisitionJobs(
  admin: SupabaseClient,
  input: {
    anchor_companies: ProspectGraphAnchorCompany[]
    include_discovery_segments?: boolean
  },
): Promise<number> {
  let queued = 0

  for (const anchor of input.anchor_companies) {
    const segmentKey = `graph_acq:${anchor.canonical_company_id}`
    const { error } = await admin.schema("growth").from("discovery_refresh_queue").upsert(
      {
        segment_key: segmentKey,
        reason: "graph_expansion",
        status: "pending",
        scheduled_for: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "segment_key,reason" },
    )
    if (!error) queued += 1
  }

  if (input.include_discovery_segments !== false) {
    for (const segment of GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS) {
      const { error } = await admin.schema("growth").from("discovery_refresh_queue").upsert(
        {
          segment_key: segment.key,
          reason: "graph_expansion",
          status: "pending",
          scheduled_for: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "segment_key,reason" },
      )
      if (!error) queued += 1
    }
    queued += await queueNightlyDiscoverySegments(admin)
  }

  return queued
}

async function loadCompanyWebsite(admin: SupabaseClient, company_id: string): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("companies")
    .select("website, primary_domain")
    .eq("id", company_id)
    .maybeSingle()
  const website = asString(data?.website) || asString(data?.primary_domain)
  if (!website) return null
  return website.startsWith("http") ? website : `https://${website}`
}

export async function runProspectGraphAcquisitionForCompany(
  admin: SupabaseClient,
  anchor: ProspectGraphAnchorCompany,
): Promise<{
  ok: boolean
  website_contacts_synced: number
  discovery_contacts: number
  persons_linked: number
  evidence_version_id: string | null
  source_types_observed: GrowthProspectSourceType[]
  messages: string[]
}> {
  const messages: string[] = []
  const source_types = sortProspectSourcesByPriority(
    listLiveProspectSources()
      .filter((s) => s.requires_public_url)
      .map((s) => s.source_type),
  )

  const website = await loadCompanyWebsite(admin, anchor.canonical_company_id)
  let website_contacts_synced = 0

  if (website) {
    const snapshot = await runWebsiteContactDiscoveryForCompany(admin, {
      company_id: anchor.canonical_company_id,
      website,
    })
    website_contacts_synced = snapshot.contacts.length
    messages.push(`website_acquisition: ${website_contacts_synced} contact row(s) after multi-page crawl`)
  } else {
    messages.push("website_acquisition: skipped — no website on canonical company")
  }

  const acquisition = await runProspectSearchHumanAcquisitionPipeline(admin, {
    company_candidate_id: anchor.company_candidate_id,
    canonical_company_id: anchor.canonical_company_id,
    run_discovery: true,
    search_query: anchor.search_query,
  })

  messages.push(...(acquisition.provider_messages ?? []).slice(0, 4))

  const { data: contactRows } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("source_type, source_evidence, metadata")
    .eq("company_id", anchor.canonical_company_id)
    .neq("contact_status", "archived")

  const observed = new Set<GrowthProspectSourceType>()
  let evidence_count = 0
  for (const row of contactRows ?? []) {
    evidence_count += Array.isArray(row.source_evidence) ? row.source_evidence.length : 0
    for (const source of resolveObservedProspectSourcesFromContactMetadata({
      source_type: asString(row.source_type),
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
      source_evidence: Array.isArray(row.source_evidence)
        ? (row.source_evidence as Array<{ source?: string }>)
        : [],
    })) {
      observed.add(source)
    }
  }

  const { metrics } = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: [anchor.canonical_company_id],
  })

  const version = buildProspectGraphEvidenceVersion({
    company_id: anchor.canonical_company_id,
    metrics_snapshot: metrics,
    source_types_observed: [...observed],
    evidence_count,
  })
  const persisted = await persistProspectGraphEvidenceVersion(admin, version)

  return {
    ok: acquisition.ok || website_contacts_synced > 0,
    website_contacts_synced,
    discovery_contacts: acquisition.discovery_contacts,
    persons_linked: acquisition.backfill_persons_linked,
    evidence_version_id: persisted.ok ? version.version_id : null,
    source_types_observed: [...observed],
    messages,
  }
}

export async function processProspectGraphAcquisitionQueue(
  admin: SupabaseClient,
  input: {
    anchor_companies: ProspectGraphAnchorCompany[]
    limit?: number
  },
): Promise<{
  qa_marker: typeof GROWTH_PROSPECT_CONTINUOUS_ACQUISITION_QA_MARKER
  processed: number
  failed: number
  discovery_new_companies: number
  evidence_versions_created: number
  messages: string[]
}> {
  const limit = input.limit ?? 8
  const anchorByCompanyId = new Map(
    input.anchor_companies.map((a) => [a.canonical_company_id, a]),
  )

  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("id, segment_key, reason")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0
  let discovery_new_companies = 0
  let evidence_versions_created = 0
  const messages: string[] = []

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    const segmentKey = asString((row as Record<string, unknown>).segment_key)
    const reason = asString((row as Record<string, unknown>).reason)
    if (!queueId || !segmentKey) continue

    await admin.schema("growth").from("discovery_refresh_queue").update({ status: "running" }).eq("id", queueId)

    try {
      if (segmentKey.startsWith("graph_acq:")) {
        const companyId = segmentKey.replace("graph_acq:", "")
        const anchor = anchorByCompanyId.get(companyId)
        if (!anchor) throw new Error("Anchor company not registered for graph acquisition job")
        const result = await runProspectGraphAcquisitionForCompany(admin, anchor)
        if (result.evidence_version_id) evidence_versions_created += 1
        messages.push(...result.messages.slice(0, 2))
      } else if (GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS.some((s) => s.key === segmentKey)) {
        const segment = GROWTH_PROSPECT_GRAPH_EXPANSION_SEGMENTS.find((s) => s.key === segmentKey)
        if (!segment) throw new Error("Graph expansion segment missing")
        const result = await runContinuousDiscoverySegment(admin, segment)
        discovery_new_companies += result.run?.new_companies_found ?? 0
        messages.push(
          `discovery_segment:${segment.key} new_companies=${result.run?.new_companies_found ?? 0}`,
        )
      } else if (reason === "nightly" || GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.some((s) => s.key === segmentKey)) {
        const segment = GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.find((s) => s.key === segmentKey)
        if (segment) {
          const result = await runContinuousDiscoverySegment(admin, segment)
          discovery_new_companies += result.run?.new_companies_found ?? 0
        } else {
          const batch = await processDiscoveryRefreshQueue(admin, 1)
          discovery_new_companies += batch.new_companies
        }
      }

      await admin
        .schema("growth")
        .from("discovery_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("discovery_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 240) : "Graph acquisition failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return {
    qa_marker: GROWTH_PROSPECT_CONTINUOUS_ACQUISITION_QA_MARKER,
    processed,
    failed,
    discovery_new_companies,
    evidence_versions_created,
    messages,
  }
}

export function listProspectGraphExpansionSourceTypes(): readonly GrowthProspectSourceType[] {
  return GROWTH_PROSPECT_SOURCE_TYPES
}
