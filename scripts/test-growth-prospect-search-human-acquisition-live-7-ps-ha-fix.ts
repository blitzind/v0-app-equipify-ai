/**
 * Phase 7.PS-HA-FIX — Live human acquisition QA (requires Supabase + discovery providers).
 * Run: NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' pnpm test:growth-prospect-search-human-acquisition-live-7-ps-ha-fix
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-human-acquisition-types"
import { hasProspectSearchReachableHumans } from "../lib/growth/prospect-search/prospect-search-reachable-human-scoring"
import { buildProspectSearchActionableResearchPlan } from "../lib/growth/prospect-search/prospect-search-actionable-research"
import {
  buildProspectSearchOperatorWorkspace,
  planProspectSearchWorkspaceBulkAction,
  prospectSearchWorkspaceCompanyNeedsHumanAcquisition,
} from "../lib/growth/prospect-search/prospect-search-workspace"
import { runProspectSearchHumanAcquisitionPipeline } from "../lib/growth/prospect-search/prospect-search-human-acquisition"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

for (const path of [".env.local", ".env.local.active"]) loadEnvFile(path)

const jwt =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  readFileSync(".env.local.active", "utf8").match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() || "https://byyfylkklbxcdofaspye.supabase.co"

async function main() {
  if (!jwt) {
    console.error("Missing Supabase service role — skip live QA.")
    process.exit(1)
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt

  const admin = createClient(url, jwt, { auth: { persistSession: false } })
  const { runProspectSearch } = await import(
    "../lib/growth/prospect-search/prospect-search-repository"
  )

  const query = "biomedical equipment service companies"
  const beforeSearch = await runProspectSearch(admin, {
    query,
    discovery_mode: "discover_external",
    result_mode: "companies",
    limit: 10,
    page: 1,
    page_size: 10,
    filters: {},
  })

  const companies = beforeSearch.companies ?? []
  const target = companies.find((c) => {
    const ws = buildProspectSearchOperatorWorkspace([c])
    return ws.aggregates.research_queues.some(
      (q) => q.queue_id === "acquire_humans" && q.count > 0,
    )
  })

  if (!target) {
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
          status: "skipped",
          reason: "No acquire_humans candidate in search results (providers or already hydrated).",
          companies: companies.length,
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  const before = {
    contacts: target.contact_intelligence?.contacts?.length ?? 0,
    linked_persons: target.contact_intelligence?.engine_coverage?.metrics?.contacts_with_canonical_person ?? 0,
    reachable: target.reachable_human?.label ?? null,
    prioritization: target.contact_intelligence?.engine_readiness?.prioritization_tier ?? null,
    verified_emails: target.contact_intelligence?.engine_intelligence?.verified_channels?.persons_with_verified_email ?? 0,
    committee: target.contact_intelligence?.engine_intelligence?.buying_committee?.verified_member_count ?? 0,
    overall_score: target.contact_intelligence?.engine_readiness?.overall?.score ?? 0,
  }

  const canonicalId =
    target.contact_intelligence?.engine_coverage?.company?.canonical_company_id ??
    target.canonical_company_id

  const acquisition = await runProspectSearchHumanAcquisitionPipeline(admin, {
    company_candidate_id: target.id,
    canonical_company_id: canonicalId,
    run_discovery: true,
  })

  const afterSearch = await runProspectSearch(admin, {
    query,
    discovery_mode: "discover_external",
    result_mode: "companies",
    limit: 10,
    page: 1,
    page_size: 10,
    filters: {},
  })

  const afterRow =
    (afterSearch.companies ?? []).find((c) => c.id === target.id) ?? target

  const after = {
    contacts: afterRow.contact_intelligence?.contacts?.length ?? 0,
    linked_persons:
      afterRow.contact_intelligence?.engine_coverage?.metrics?.contacts_with_canonical_person ?? 0,
    reachable: afterRow.reachable_human?.label ?? null,
    reachable_ok: hasProspectSearchReachableHumans(
      afterRow.reachable_human ?? {
        qa_marker: "growth-reachable-human-priority-v1",
        score: 0,
        label: "no_reachable_humans",
        verified_email_count: 0,
        verified_phone_count: 0,
        named_person_count: 0,
        role_confidence_avg: null,
        evidence_quality_avg: null,
        has_linkedin_reference: false,
        reasons: [],
        risks: [],
      },
    ),
    prioritization: afterRow.contact_intelligence?.engine_readiness?.prioritization_tier ?? null,
    verified_emails:
      afterRow.contact_intelligence?.engine_intelligence?.verified_channels?.persons_with_verified_email ?? 0,
    verified_phones:
      afterRow.contact_intelligence?.engine_intelligence?.verified_channels?.persons_with_verified_phone ?? 0,
    committee:
      afterRow.contact_intelligence?.engine_intelligence?.buying_committee?.verified_member_count ?? 0,
    overall_score: afterRow.contact_intelligence?.engine_readiness?.overall?.score ?? 0,
  }

  const emailPlan = buildProspectSearchActionableResearchPlan({
    company: afterRow,
    actionKind: "verify_email",
  })
  const phonePlan = buildProspectSearchActionableResearchPlan({
    company: afterRow,
    actionKind: "verify_phone_numbers",
  })

  const bulkPlan = planProspectSearchWorkspaceBulkAction({
    companies: [afterRow],
    action_kind: "human_acquisition",
    company_keys: [`${afterRow.source_type}:${afterRow.id}`],
  })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
        company: target.company_name,
        company_candidate_id: target.id,
        canonical_company_id: canonicalId,
        acquisition,
        before,
        after,
        ps_c_email_can_execute: emailPlan.can_execute,
        ps_c_phone_can_execute: phonePlan.can_execute,
        still_needs_humans: prospectSearchWorkspaceCompanyNeedsHumanAcquisition(
          buildProspectSearchOperatorWorkspace([afterRow]).company_refs[0]!,
        ),
        bulk_human_plan_executable: bulkPlan.executable_count,
        certification:
          acquisition.ok && after.contacts > before.contacts && after.reachable_ok
            ? "PASS_PARTIAL"
            : "FAIL",
      },
      null,
      2,
    ),
  )
}

void main()
