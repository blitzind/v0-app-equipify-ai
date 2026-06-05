/**
 * Phase 7.PS-HI — Verified channel completion certification (live audit).
 * Run: pnpm test:growth-prospect-search-verified-channels-cert-7-ps-hf
 */
import { readFileSync } from "node:fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

const GROWTH_CERT_QA_MARKER =
  "growth-prospect-search-verified-channels-cert-7-ps-hi-v1" as const

const ICP_QUERIES = [
  "biomedical equipment service companies",
  "medical equipment repair companies",
] as const

/** PS-HE hydration regression companies (role_only + linked persons). */
const KNOWN_PS_HE_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    company_name: "Biomedical Repair Service",
    query: "medical equipment repair companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
  },
] as const

const MAX_TARGETS = 3
const MAX_ICP_COMPANIES_PER_QUERY = 10
const MAX_DB_ROLE_PROBE = 12
const MAX_PROCESS_ROUNDS = 12
const PROCESS_BATCH = 5

type CertTargetSource = "known_ps_he" | "icp_search" | "db_backfill"

type CertTarget = {
  query: string
  company: GrowthProspectSearchCompanyResult
  canonical_company_id: string
  person_id: string
  reachable_label: string
  target_source: CertTargetSource
}

type CertStageStatus = "pass" | "fail" | "config_blocked" | "skipped" | "not_reached"

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

function isSupabaseServiceRoleJwt(jwt: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      role?: string
      iss?: string
    }
    return payload.role === "service_role" || String(payload.iss ?? "").includes("supabase")
  } catch {
    return false
  }
}

function extractJwtFromEnvFiles(): string | null {
  const candidates: string[] = []
  const direct = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  if (direct.startsWith("eyJ")) candidates.push(direct)
  for (const path of [
    ".env.local.active",
    ".env.local",
    ".env.vercel.production",
    ".vercel/.env.production.local",
  ]) {
    try {
      const jwts = readFileSync(path, "utf8").match(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      )
      if (jwts) candidates.push(...jwts)
    } catch {
      /* optional */
    }
  }
  return candidates.find(isSupabaseServiceRoleJwt) ?? null
}

function resolveSupabaseUrl(): string | null {
  const candidates = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.startsWith("http"))
  if (candidates[0]) return candidates[0]
  const jwt = extractJwtFromEnvFiles()
  if (!jwt) return null
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      ref?: string
    }
    if (payload.ref) return `https://${payload.ref}.supabase.co`
  } catch {
    return null
  }
  return null
}

function bootstrapEnv(): { url: string; jwt: string } | null {
  for (const path of [
    ".env.local",
    ".env.local.active",
    ".env.vercel.production",
    ".vercel/.env.production.local",
  ]) {
    loadEnvFile(path)
  }
  const jwt = extractJwtFromEnvFiles()
  const url = resolveSupabaseUrl() || "https://byyfylkklbxcdofaspye.supabase.co"
  if (!jwt) return null
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt
  return { url, jwt }
}

function normalizeProspectSearchCompanyShell(
  input: Partial<GrowthProspectSearchCompanyResult> & {
    id: string
    source_type: GrowthProspectSearchCompanyResult["source_type"]
    company_name: string
    canonical_company_id: string
  },
): GrowthProspectSearchCompanyResult {
  return {
    in_lead_inbox: false,
    existing_customer: false,
    existing_prospect: false,
    already_pushed: false,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
    industry: null,
    subindustry: null,
    city: null,
    state: null,
    country: null,
    employees: null,
    revenue_range: null,
    location: null,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: null,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: null,
    signals: [],
    search_intent_category: null,
    lead_inbox_id: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: null,
    match_reasoning: [],
    discovery_provider_type: null,
    discovery_provider_name: null,
    discovery_source_badge: null,
    keywords: [],
    notes: null,
    matched_territory_label: null,
    territory_match_reasons: [],
    score_explanation_items: [],
    confidence_explanation_items: [],
    recommended_next_step_reason: null,
    recommended_next_action: null,
    recommended_next_action_reason: null,
    recommended_workflow_path: null,
    recommended_sequence_label: null,
    recommended_sequence_confidence: null,
    recommended_sequence_reason: null,
    recommended_first_touch: null,
    website: input.website ?? null,
    domain: input.domain ?? input.website ?? null,
    ...input,
    signals: Array.isArray(input.signals) ? input.signals : [],
    match_reasoning: Array.isArray(input.match_reasoning) ? input.match_reasoning : [],
  } as GrowthProspectSearchCompanyResult
}

type ChannelCounts = {
  verified_emails: number
  verified_phones: number
  verified_profiles: number
}

type ReadinessSnapshot = {
  overlay_contacts: number
  linked_persons: number
  reachable_label: string
  overall_score: number
  prioritization_tier: string | null
  outreach_ready: boolean
  channel_emails: number
  channel_phones: number
  channel_social: number
}

type QueueJobAudit = {
  channel: "email" | "phone" | "social"
  table: string
  stage_status: CertStageStatus
  before: { pending: number; running: number; failed: number; completed: number }
  enqueue: { ok: boolean; enqueued: boolean; reason: string; job_id: string | null }
  after: { pending: number; running: number; failed: number; completed: number }
  latest_job: {
    id: string | null
    status: string | null
    promote_on_complete: boolean | null
    trigger_source: string | null
    last_error: string | null
    run_id: string | null
  }
  process_rounds: number
  process_totals: { processed: number; failed: number; skipped: number; stale_recovered: number }
}

type DiscoveryAudit = {
  email_runs: number
  email_candidates: number
  email_verified_candidates: number
  email_promoted_candidates: number
  phone_runs: number
  phone_verified_candidates: number
  social_runs: number
  social_verified_candidates: number
  latest_email_run: {
    status: string | null
    verified_count: number | null
    candidate_count: number | null
    promotion_skipped_reasons: string[]
  } | null
}

type CompanyChannelCertRow = {
  company_name: string
  company_candidate_id: string
  canonical_company_id: string
  person_id: string
  reachable_label: string
  target_source: CertTargetSource
  before_db: ChannelCounts
  after_db: ChannelCounts
  before_hydration: ReadinessSnapshot
  after_hydration: ReadinessSnapshot
  queues: QueueJobAudit[]
  discovery: DiscoveryAudit
  blockers: string[]
}

async function countJobsByStatus(
  admin: SupabaseClient,
  table: string,
  filter: { company_id: string; person_id?: string },
): Promise<Record<string, number>> {
  const statuses = ["pending", "running", "failed", "completed"] as const
  const out: Record<string, number> = {}
  for (const status of statuses) {
    let q = admin.schema("growth").from(table).select("id", { count: "exact", head: true })
    q = q.eq("company_id", filter.company_id).eq("status", status)
    if (filter.person_id) q = q.eq("person_id", filter.person_id)
    const { count } = await q
    out[status] = count ?? 0
  }
  return out
}

async function loadLatestJob(
  admin: SupabaseClient,
  table: string,
  filter: { company_id: string; person_id: string },
) {
  const { data } = await admin
    .schema("growth")
    .from(table)
    .select("id, status, promote_on_complete, trigger_source, last_error, run_id")
    .eq("company_id", filter.company_id)
    .eq("person_id", filter.person_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

async function loadChannelDbCounts(
  admin: SupabaseClient,
  person_ids: string[],
): Promise<ChannelCounts> {
  if (person_ids.length === 0) {
    return { verified_emails: 0, verified_phones: 0, verified_profiles: 0 }
  }
  const [{ count: verified_emails }, { count: verified_phones }, { count: verified_profiles }] =
    await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("id", { count: "exact", head: true })
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("id", { count: "exact", head: true })
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("id", { count: "exact", head: true })
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
    ])
  return {
    verified_emails: verified_emails ?? 0,
    verified_phones: verified_phones ?? 0,
    verified_profiles: verified_profiles ?? 0,
  }
}

function readinessFromCompany(
  company: GrowthProspectSearchCompanyResult,
  scoring: {
    resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
  },
): ReadinessSnapshot {
  const contacts = company.contact_intelligence?.contacts ?? []
  const reachable = scoring.resolveProspectSearchReachableHumanScore(contacts)
  const readiness = company.contact_intelligence?.engine_readiness
  const engine = company.contact_intelligence?.engine_intelligence
  return {
    overlay_contacts: contacts.length,
    linked_persons:
      company.contact_intelligence?.engine_coverage?.metrics?.contacts_with_canonical_person ?? 0,
    reachable_label: reachable.label,
    overall_score: readiness?.overall?.score ?? 0,
    prioritization_tier: readiness?.prioritization_tier ?? null,
    outreach_ready: readiness?.prioritization_tier === "ready_for_outreach",
    channel_emails: engine?.verified_channels?.persons_with_verified_email ?? 0,
    channel_phones: engine?.verified_channels?.persons_with_verified_phone ?? 0,
    channel_social: engine?.verified_channels?.persons_with_verified_profile ?? 0,
  }
}

function isReachableCertTarget(
  readiness: ReadinessSnapshot,
  source: CertTargetSource,
): boolean {
  if (readiness.reachable_label === "role_only") return true
  if (source === "known_ps_he") {
    return (
      readiness.overlay_contacts > 0 &&
      readiness.linked_persons > 0 &&
      readiness.reachable_label !== "no_reachable_humans"
    )
  }
  return false
}

async function resolvePersonIdForCompany(
  admin: SupabaseClient,
  canonical_company_id: string,
  preferred_person_id?: string | null,
): Promise<string | null> {
  if (preferred_person_id) return preferred_person_id
  const { data: role } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id")
    .eq("company_id", canonical_company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return role?.person_id ? String(role.person_id) : null
}

async function buildDbBackedCompanyShell(
  admin: SupabaseClient,
  input: {
    canonical_company_id: string
    company_candidate_id?: string | null
    company_name?: string | null
    website?: string | null
  },
): Promise<GrowthProspectSearchCompanyResult> {
  let candidateId = input.company_candidate_id ?? null
  let companyName = input.company_name ?? null
  let website = input.website ?? null

  if (!companyName || !website) {
    const { data: companyRow } = await admin
      .schema("growth")
      .from("companies")
      .select("id, name, website")
      .eq("id", input.canonical_company_id)
      .maybeSingle()
    companyName = companyName ?? companyRow?.name ?? "Acquired company"
    website = website ?? companyRow?.website ?? null
  }

  if (!candidateId) {
    const { data: companyContact } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("contact_candidate_id")
      .eq("company_id", input.canonical_company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (companyContact?.contact_candidate_id) {
      const { data: contactRow } = await admin
        .schema("growth")
        .from("contact_candidates")
        .select("company_candidate_id")
        .eq("id", companyContact.contact_candidate_id)
        .maybeSingle()
      if (contactRow?.company_candidate_id) {
        candidateId = String(contactRow.company_candidate_id)
      }
    }
  }

  return normalizeProspectSearchCompanyShell({
    id: candidateId ?? input.canonical_company_id,
    source_type: "external_discovered",
    company_name: companyName,
    website,
    canonical_company_id: input.canonical_company_id,
  })
}

async function hydrateCertTarget(
  admin: SupabaseClient,
  deps: {
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    scoring: {
      resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    }
  },
  input: {
    query: string
    shell: GrowthProspectSearchCompanyResult
    canonical_company_id: string
    person_id?: string | null
    target_source: CertTargetSource
  },
): Promise<{ target: CertTarget | null; reject_reason?: string }> {
  const hydrated = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
    company: input.shell,
    canonical_company_id: input.canonical_company_id,
    query: input.query,
  })
  const readiness = readinessFromCompany(hydrated, deps.scoring)

  const person_id =
    (await resolvePersonIdForCompany(admin, input.canonical_company_id, input.person_id)) ??
    hydrated.contact_intelligence?.contacts?.find((c) => c.canonical_person_id)?.canonical_person_id ??
    null
  if (!person_id) {
    return {
      target: null,
      reject_reason: `no person_id (reachable=${readiness.reachable_label}, overlay=${readiness.overlay_contacts})`,
    }
  }

  const { count: company_contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.canonical_company_id)

  const dbBackedOk =
    (input.target_source === "known_ps_he" || input.target_source === "db_backfill") &&
    readiness.overlay_contacts > 0 &&
    readiness.linked_persons > 0 &&
    (company_contacts ?? 0) > 0

  if (!dbBackedOk && !isReachableCertTarget(readiness, input.target_source)) {
    return {
      target: null,
      reject_reason: `reachable gate (label=${readiness.reachable_label}, overlay=${readiness.overlay_contacts}, linked=${readiness.linked_persons}, db_contacts=${company_contacts ?? 0})`,
    }
  }

  return {
    target: {
      query: input.query,
      company: hydrated,
      canonical_company_id: input.canonical_company_id,
      person_id,
      reachable_label: readiness.reachable_label,
      target_source: input.target_source,
    },
  }
}

async function collectCertificationTargets(
  admin: SupabaseClient,
  deps: {
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    scoring: {
      resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    }
  },
): Promise<{ targets: CertTarget[]; selection_log: Array<{ source: CertTargetSource; company_name: string; accepted: boolean; reason?: string }> }> {
  const targets: CertTarget[] = []
  const seen = new Set<string>()
  const selection_log: Array<{
    source: CertTargetSource
    company_name: string
    accepted: boolean
    reason?: string
  }> = []

  const tryAdd = (
    result: { target: CertTarget | null; reject_reason?: string },
    meta: { source: CertTargetSource; company_name: string },
  ) => {
    if (!result.target) {
      selection_log.push({
        ...meta,
        accepted: false,
        reason: result.reject_reason ?? "hydration/reachable/person gate",
      })
      return
    }
    const target = result.target
    const key = `${target.canonical_company_id}:${target.person_id}`
    if (seen.has(key)) {
      selection_log.push({ ...meta, accepted: false, reason: "duplicate" })
      return
    }
    seen.add(key)
    targets.push(target)
    selection_log.push({ ...meta, accepted: true })
  }

  for (const seed of KNOWN_PS_HE_TARGETS) {
    if (targets.length >= MAX_TARGETS) break
    const shell = normalizeProspectSearchCompanyShell({
      id: seed.company_candidate_id,
      source_type: "external_discovered",
      company_name: seed.company_name,
      canonical_company_id: seed.canonical_company_id,
    })
    const hydratedResult = await hydrateCertTarget(admin, deps, {
      query: seed.query,
      shell,
      canonical_company_id: seed.canonical_company_id,
      target_source: "known_ps_he",
    })
    tryAdd(hydratedResult, { source: "known_ps_he", company_name: seed.company_name })
  }

  if (targets.length < MAX_TARGETS) {
    const { runProspectSearch } = await import(
      "../lib/growth/prospect-search/prospect-search-repository"
    )
    for (const query of ICP_QUERIES) {
      if (targets.length >= MAX_TARGETS) break
      const result = await runProspectSearch(admin, {
        query,
        discovery_mode: "discover_external",
        result_mode: "companies",
        limit: MAX_ICP_COMPANIES_PER_QUERY,
        page: 1,
        page_size: MAX_ICP_COMPANIES_PER_QUERY,
        filters: {},
      })
      for (const company of (result.companies ?? []).slice(0, MAX_ICP_COMPANIES_PER_QUERY)) {
        if (targets.length >= MAX_TARGETS) break
        const canonical =
          company.contact_intelligence?.engine_coverage?.company?.canonical_company_id ??
          company.canonical_company_id ??
          company.contact_intelligence?.engine_intelligence?.canonical_company_id
        if (!canonical || !company.contact_intelligence?.engine_coverage?.company?.resolved) continue
        const key = `${canonical}`
        if (seen.has(key)) continue

        const { count: roles } = await admin
          .schema("growth")
          .from("person_company_roles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", canonical)
        if ((roles ?? 0) === 0) continue

        const shell = normalizeProspectSearchCompanyShell({
          ...company,
          id: company.id,
          source_type: company.source_type,
          company_name: company.company_name ?? company.id,
          canonical_company_id: canonical,
        })
        const hydratedResult = await hydrateCertTarget(admin, deps, {
          query,
          shell,
          canonical_company_id: canonical,
          target_source: "icp_search",
        })
        tryAdd(hydratedResult, {
          source: "icp_search",
          company_name: company.company_name ?? company.id,
        })
      }
    }
  }

  if (targets.length < MAX_TARGETS) {
    const { data: roles } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("company_id, person_id")
      .order("created_at", { ascending: false })
      .limit(MAX_DB_ROLE_PROBE)

    for (const row of roles ?? []) {
      if (targets.length >= MAX_TARGETS) break
      const canonical_company_id = String(row.company_id ?? "")
      const person_id = String(row.person_id ?? "")
      if (!canonical_company_id || !person_id) continue
      const key = `${canonical_company_id}:${person_id}`
      if (seen.has(key)) continue

      const { count: contacts } = await admin
        .schema("growth")
        .from("company_contacts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", canonical_company_id)
      if ((contacts ?? 0) === 0) {
        selection_log.push({
          source: "db_backfill",
          company_name: canonical_company_id,
          accepted: false,
          reason: "no company_contacts",
        })
        continue
      }

      const shell = await buildDbBackedCompanyShell(admin, { canonical_company_id })
      const hydratedResult = await hydrateCertTarget(admin, deps, {
        query: "biomedical equipment service companies",
        shell,
        canonical_company_id,
        person_id,
        target_source: "db_backfill",
      })
      tryAdd(hydratedResult, {
        source: "db_backfill",
        company_name: shell.company_name ?? canonical_company_id,
      })
    }
  }

  return { targets, selection_log }
}

async function loadDiscoveryAudit(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<DiscoveryAudit> {
  const { data: emailRuns } = await admin
    .schema("growth")
    .from("email_discovery_runs")
    .select("id, status, verified_count, candidate_count")
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .order("created_at", { ascending: false })
    .limit(3)

  const latestEmail = emailRuns?.[0] ?? null
  let email_candidates = 0
  let email_verified_candidates = 0
  let email_promoted_candidates = 0
  const promotion_skipped_reasons: string[] = []

  if (latestEmail?.id) {
    const { data: candidates } = await admin
      .schema("growth")
      .from("email_discovery_candidates")
      .select("verification_status, promoted_at, promotion_status")
      .eq("run_id", latestEmail.id)
    for (const row of candidates ?? []) {
      email_candidates += 1
      if (row.verification_status === "verified") email_verified_candidates += 1
      if (row.promoted_at || row.promotion_status === "promoted") email_promoted_candidates += 1
      if (row.promotion_status && row.promotion_status !== "promoted") {
        promotion_skipped_reasons.push(String(row.promotion_status))
      }
    }
  }

  const { count: phone_runs } = await admin
    .schema("growth")
    .from("phone_discovery_runs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)

  const { count: phone_verified_candidates } = await admin
    .schema("growth")
    .from("phone_discovery_candidates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .eq("verification_status", "verified")

  const { count: social_runs } = await admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)

  const { count: social_verified_candidates } = await admin
    .schema("growth")
    .from("social_profile_discovery_candidates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .eq("verification_status", "verified")

  return {
    email_runs: emailRuns?.length ?? 0,
    email_candidates,
    email_verified_candidates,
    email_promoted_candidates,
    phone_runs: phone_runs ?? 0,
    phone_verified_candidates: phone_verified_candidates ?? 0,
    social_runs: social_runs ?? 0,
    social_verified_candidates: social_verified_candidates ?? 0,
    latest_email_run: latestEmail
      ? {
          status: latestEmail.status ?? null,
          verified_count: latestEmail.verified_count ?? null,
          candidate_count: latestEmail.candidate_count ?? null,
          promotion_skipped_reasons: [...new Set(promotion_skipped_reasons)],
        }
      : null,
  }
}

async function certifyCompanyChannels(
  admin: SupabaseClient,
  target: CertTarget,
  input: {
    email_config_blocked: boolean
    email_config_blockers: string[]
  },
  deps: {
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    buildProspectSearchActionableResearchPlan: typeof import("../lib/growth/prospect-search/prospect-search-actionable-research").buildProspectSearchActionableResearchPlan
    scoring: {
      resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    }
    queues: {
      enqueueEmailDiscoveryJob: typeof import("../lib/growth/email-discovery/email-discovery-queue").enqueueEmailDiscoveryJob
      processEmailDiscoveryJobQueue: typeof import("../lib/growth/email-discovery/email-discovery-queue").processEmailDiscoveryJobQueue
      enqueuePhoneDiscoveryJob: typeof import("../lib/growth/phone-discovery/phone-discovery-queue").enqueuePhoneDiscoveryJob
      processPhoneDiscoveryJobQueue: typeof import("../lib/growth/phone-discovery/phone-discovery-queue").processPhoneDiscoveryJobQueue
      enqueueSocialProfileDiscoveryJob: typeof import("../lib/growth/social-profile-discovery/social-profile-discovery-queue").enqueueSocialProfileDiscoveryJob
      processSocialProfileDiscoveryJobQueue: typeof import("../lib/growth/social-profile-discovery/social-profile-discovery-queue").processSocialProfileDiscoveryJobQueue
    }
  },
): Promise<CompanyChannelCertRow> {
  const blockers: string[] = []
  const { company, canonical_company_id, person_id } = target

  const before_db = await loadChannelDbCounts(admin, [person_id])
  const before_hydration = readinessFromCompany(company, deps.scoring)

  const channelSpecs = [
    {
      channel: "email" as const,
      table: "email_discovery_jobs",
      actionKind: "verify_email" as const,
      enqueue: deps.queues.enqueueEmailDiscoveryJob,
      process: deps.queues.processEmailDiscoveryJobQueue,
      config_blocked: input.email_config_blocked,
    },
    {
      channel: "phone" as const,
      table: "phone_discovery_jobs",
      actionKind: "verify_phone_numbers" as const,
      enqueue: deps.queues.enqueuePhoneDiscoveryJob,
      process: deps.queues.processPhoneDiscoveryJobQueue,
      config_blocked: false,
    },
    {
      channel: "social" as const,
      table: "social_profile_discovery_jobs",
      actionKind: "queue_social_profile_discovery" as const,
      enqueue: deps.queues.enqueueSocialProfileDiscoveryJob,
      process: deps.queues.processSocialProfileDiscoveryJobQueue,
      config_blocked: false,
    },
  ]

  const queues: QueueJobAudit[] = []

  for (const spec of channelSpecs) {
    const before = await countJobsByStatus(admin, spec.table, {
      company_id: canonical_company_id,
      person_id,
    })

    if (spec.config_blocked) {
      queues.push({
        channel: spec.channel,
        table: spec.table,
        stage_status: "config_blocked",
        before,
        enqueue: {
          ok: true,
          enqueued: false,
          reason: `config_blocked: ${input.email_config_blockers.join("; ")}`,
          job_id: null,
        },
        after: before,
        latest_job: {
          id: null,
          status: null,
          promote_on_complete: null,
          trigger_source: null,
          last_error: null,
          run_id: null,
        },
        process_rounds: 0,
        process_totals: { processed: 0, failed: 0, skipped: 0, stale_recovered: 0 },
      })
      continue
    }

    const plan = deps.buildProspectSearchActionableResearchPlan({
      company,
      actionKind: spec.actionKind,
      personId: person_id,
    })
    if (!plan.can_execute) {
      blockers.push(`${spec.channel}: PS-C blocked — ${plan.blocked_reason ?? "unknown"}`)
    }

    let enqueueResult: QueueJobAudit["enqueue"] = {
      ok: false,
      enqueued: false,
      reason: "plan_blocked",
      job_id: null,
    }

    if (plan.can_execute) {
      const raw =
        spec.channel === "social"
          ? await spec.enqueue(admin, {
              company_id: canonical_company_id,
              person_id,
              discovery_scope: "person",
              promote_on_complete: true,
              trigger_source: "manual",
            })
          : await spec.enqueue(admin, {
              company_id: canonical_company_id,
              person_id,
              promote_on_complete: true,
              trigger_source: "manual",
            })
      enqueueResult = {
        ok: raw.ok,
        enqueued: Boolean("enqueued" in raw && raw.enqueued),
        reason: "reason" in raw ? String(raw.reason) : raw.ok ? "ok" : "enqueue_failed",
        job_id: "job_id" in raw && raw.job_id ? String(raw.job_id) : null,
      }
      if (!enqueueResult.enqueued && enqueueResult.reason === "active_job_exists") {
        const active = await loadLatestJob(admin, spec.table, {
          company_id: canonical_company_id,
          person_id,
        })
        if (active?.status === "pending" || active?.status === "running") {
          blockers.push(
            `${spec.channel}: active_job_exists (${active.status}) — prior job not drained by worker`,
          )
        }
      }
    }

    const process_totals = { processed: 0, failed: 0, skipped: 0, stale_recovered: 0 }
    let process_rounds = 0
    for (let round = 0; round < MAX_PROCESS_ROUNDS; round += 1) {
      const pending = await countJobsByStatus(admin, spec.table, {
        company_id: canonical_company_id,
        person_id,
      })
      if ((pending.pending ?? 0) === 0) break
      const run = await spec.process(admin, PROCESS_BATCH)
      process_totals.processed += run.processed
      process_totals.failed += run.failed
      process_totals.skipped += run.skipped
      process_totals.stale_recovered += run.stale_recovered
      process_rounds += 1
      if (run.processed === 0 && run.failed === 0 && run.skipped === 0) break
    }

    const after = await countJobsByStatus(admin, spec.table, {
      company_id: canonical_company_id,
      person_id,
    })
    const latest = await loadLatestJob(admin, spec.table, {
      company_id: canonical_company_id,
      person_id,
    })

    let stage_status: CertStageStatus = "pass"
    if (!enqueueResult.ok || (!enqueueResult.enqueued && plan.can_execute)) stage_status = "fail"
    if ((after.pending ?? 0) > 0) {
      blockers.push(`${spec.channel}: ${after.pending} job(s) still pending after inline worker drain`)
      stage_status = "fail"
    }
    if ((after.failed ?? 0) > 0 && latest?.last_error) {
      blockers.push(`${spec.channel}: job failed — ${latest.last_error}`)
      stage_status = "fail"
    }
    if (latest?.promote_on_complete === false) {
      blockers.push(
        `${spec.channel}: latest job promote_on_complete=false (auto-trigger path — no canonical promotion)`,
      )
    }

    queues.push({
      channel: spec.channel,
      table: spec.table,
      stage_status,
      before,
      enqueue: enqueueResult,
      after,
      latest_job: {
        id: latest?.id ?? null,
        status: latest?.status ?? null,
        promote_on_complete: latest?.promote_on_complete ?? null,
        trigger_source: latest?.trigger_source ?? null,
        last_error: latest?.last_error ?? null,
        run_id: latest?.run_id ?? null,
      },
      process_rounds,
      process_totals,
    })
  }

  const afterCompany = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
    company,
    canonical_company_id,
    query: target.query,
  })
  const after_db = await loadChannelDbCounts(admin, [person_id])
  const after_hydration = readinessFromCompany(afterCompany, deps.scoring)
  const discovery = await loadDiscoveryAudit(admin, {
    company_id: canonical_company_id,
    person_id,
  })

  if (
    !input.email_config_blocked &&
    discovery.email_candidates > 0 &&
    discovery.email_verified_candidates === 0 &&
    after_db.verified_emails === 0
  ) {
    blockers.push("email: candidates produced but none verified — check ZeroBounce / verification gates")
  }

  return {
    company_name: company.company_name ?? company.id,
    company_candidate_id: company.id,
    canonical_company_id,
    person_id,
    reachable_label: target.reachable_label,
    target_source: target.target_source,
    before_db,
    after_db,
    before_hydration,
    after_hydration,
    queues,
    discovery,
    blockers,
  }
}

function deriveStages(input: {
  targets: CertTarget[]
  jobQueueSchemaReady: boolean
  emailConfigBlocked: boolean
  emailConfigBlockers: string[]
  rows: CompanyChannelCertRow[]
}): Record<string, { status: CertStageStatus; detail?: string }> {
  const anyEnqueue =
    input.rows.length > 0 &&
    input.rows.some((r) =>
      r.queues.some(
        (q) =>
          q.channel !== "email" &&
          (q.enqueue.enqueued || q.enqueue.reason === "active_job_exists"),
      ),
    )
  const anyProcessed = input.rows.some((r) =>
    r.queues.some((q) => q.process_totals.processed > 0 || q.process_totals.failed > 0),
  )
  const anyPromotion = input.rows.some(
    (r) =>
      r.after_db.verified_emails > r.before_db.verified_emails ||
      r.after_db.verified_phones > r.before_db.verified_phones ||
      r.after_db.verified_profiles > r.before_db.verified_profiles,
  )

  return {
    target_selection: {
      status: input.targets.length > 0 ? "pass" : "fail",
      detail: `${input.targets.length} target(s)`,
    },
    channel_queue_schema: {
      status: input.jobQueueSchemaReady ? "pass" : "fail",
      detail: input.jobQueueSchemaReady ? "job tables ready" : "missing job queue tables",
    },
    email_config: {
      status: input.emailConfigBlocked ? "config_blocked" : "pass",
      detail: input.emailConfigBlocked ? input.emailConfigBlockers.join("; ") : "production-safe",
    },
    job_enqueue: {
      status: input.targets.length === 0 ? "not_reached" : anyEnqueue ? "pass" : "fail",
      detail: anyEnqueue ? "at least one channel enqueued or active_job_exists" : "no enqueue",
    },
    worker_processing: {
      status: input.targets.length === 0 ? "not_reached" : anyProcessed ? "pass" : "fail",
      detail: anyProcessed ? "inline worker processed jobs" : "no jobs processed",
    },
    promotion: {
      status: input.targets.length === 0 ? "not_reached" : anyPromotion ? "pass" : "fail",
      detail: anyPromotion ? "verified channel count increased" : "verified channels unchanged",
    },
  }
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify({
        qa_marker: GROWTH_CERT_QA_MARKER,
        certification: "FAIL",
        first_blocker: { stage: "bootstrap", message: "no_credentials" },
      }),
    )
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchActionableResearchPlan },
    { resolveProspectSearchReachableHumanScore },
    emailQueue,
    phoneQueue,
    socialQueue,
    { evaluateEmailDiscoveryVerificationCertification },
    {
      probeGrowthEngineJobQueueSchema,
      GROWTH_ENGINE_JOB_QUEUE_SCHEMA_HEALTH_QA_MARKER,
    },
  ] = await Promise.all([
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-actionable-research"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/email-discovery/email-discovery-queue"),
    import("../lib/growth/phone-discovery/phone-discovery-queue"),
    import("../lib/growth/social-profile-discovery/social-profile-discovery-queue"),
    import("../lib/growth/email-discovery/email-discovery-certification"),
    import("../lib/growth/growth-engine-job-queue-schema-health"),
  ])

  const emailCert = evaluateEmailDiscoveryVerificationCertification()
  const emailConfigBlocked = !emailCert.production_safe
  const jobQueueSchema = await probeGrowthEngineJobQueueSchema(admin)
  const jobQueueSchemaReady = jobQueueSchema.ready

  const { targets, selection_log } = await collectCertificationTargets(admin, {
    refreshProspectSearchCompanyAfterHumanAcquisition,
    scoring: { resolveProspectSearchReachableHumanScore },
  })

  const stages = deriveStages({
    targets,
    jobQueueSchemaReady,
    emailConfigBlocked,
    emailConfigBlockers: emailCert.blockers,
    rows: [],
  })

  if (targets.length === 0) {
    const first_blocker = {
      stage: "target_selection",
      message: "No certifiable targets after known_ps_he, icp_search, and bounded db_backfill.",
      selection_log,
    }
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_CERT_QA_MARKER,
          certification: "FAIL",
          first_blocker,
          stages,
          email_verification_cert: emailCert,
          job_queue_schema: {
            ready: jobQueueSchemaReady,
            missing_objects: jobQueueSchema.missing_objects ?? [],
          },
          targets_certified: 0,
          selection_log,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  if (!jobQueueSchemaReady) {
    const first_blocker = {
      stage: "channel_queue_schema",
      message: `Job queue schema not ready: ${(jobQueueSchema.missing_objects ?? []).map((o) => o.table).join(", ") || "unknown"}`,
    }
    console.log(
      JSON.stringify({
        qa_marker: GROWTH_CERT_QA_MARKER,
        certification: "FAIL",
        first_blocker,
        stages: deriveStages({
          targets,
          jobQueueSchemaReady,
          emailConfigBlocked,
          emailConfigBlockers: emailCert.blockers,
          rows: [],
        }),
        targets_certified: targets.length,
        selection_log,
      }),
    )
    process.exit(1)
  }

  const rows: CompanyChannelCertRow[] = []
  for (const target of targets) {
    rows.push(
      await certifyCompanyChannels(
        admin,
        target,
        {
          email_config_blocked: emailConfigBlocked,
          email_config_blockers: emailCert.blockers,
        },
        {
          refreshProspectSearchCompanyAfterHumanAcquisition,
          buildProspectSearchActionableResearchPlan,
          scoring: { resolveProspectSearchReachableHumanScore },
          queues: {
            enqueueEmailDiscoveryJob: emailQueue.enqueueEmailDiscoveryJob,
            processEmailDiscoveryJobQueue: emailQueue.processEmailDiscoveryJobQueue,
            enqueuePhoneDiscoveryJob: phoneQueue.enqueuePhoneDiscoveryJob,
            processPhoneDiscoveryJobQueue: phoneQueue.processPhoneDiscoveryJobQueue,
            enqueueSocialProfileDiscoveryJob: socialQueue.enqueueSocialProfileDiscoveryJob,
            processSocialProfileDiscoveryJobQueue: socialQueue.processSocialProfileDiscoveryJobQueue,
          },
        },
      ),
    )
  }

  const finalStages = deriveStages({
    targets,
    jobQueueSchemaReady,
    emailConfigBlocked,
    emailConfigBlockers: emailCert.blockers,
    rows,
  })

  const passRow = rows.find(
    (r) =>
      (r.after_db.verified_emails > r.before_db.verified_emails ||
        r.after_db.verified_phones > r.before_db.verified_phones ||
        r.after_db.verified_profiles > r.before_db.verified_profiles) &&
      (r.after_hydration.channel_emails > r.before_hydration.channel_emails ||
        r.after_hydration.channel_phones > r.before_hydration.channel_phones ||
        r.after_hydration.channel_social > r.before_hydration.channel_social),
  )

  const phoneSocialPartial = rows.find((r) =>
    r.queues.some(
      (q) =>
        (q.channel === "phone" || q.channel === "social") &&
        (q.enqueue.enqueued || q.process_totals.processed > 0),
    ),
  )

  const certification = passRow
    ? "PASS"
    : phoneSocialPartial
      ? "PASS_PARTIAL"
      : rows.some((r) => r.queues.some((q) => q.enqueue.enqueued || q.latest_job.status))
        ? "FAIL_DOWNSTREAM"
        : "FAIL"

  const enqueueBlocker = rows
    .flatMap((r) =>
      r.queues
        .filter(
          (q) =>
            q.channel !== "email" &&
            q.stage_status === "fail" &&
            q.enqueue.reason &&
            !q.enqueue.reason.startsWith("config_blocked"),
        )
        .map((q) => ({
          stage: "job_enqueue",
          message: `${q.channel}: ${q.enqueue.reason}`,
          company: r.company_name,
        })),
    )[0]

  const firstBlockerEntry =
    rows.flatMap((r) =>
      r.blockers.map((message) => ({ stage: "downstream", message, company: r.company_name })),
    )[0] ??
    enqueueBlocker ??
    (emailConfigBlocked
      ? { stage: "email_config", message: emailCert.blockers.join("; ") }
      : null)

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CERT_QA_MARKER,
        job_queue_schema_qa_marker: GROWTH_ENGINE_JOB_QUEUE_SCHEMA_HEALTH_QA_MARKER,
        env_audit: boot.audit,
        certification,
        pass_company: passRow?.company_name ?? phoneSocialPartial?.company_name ?? null,
        first_blocker: firstBlockerEntry,
        stages: finalStages,
        reached_job_enqueue: finalStages.job_enqueue.status === "pass",
        growth_engine_enabled: process.env.GROWTH_ENGINE_ENABLED === "true",
        email_verification_cert: emailCert,
        job_queue_schema: {
          ready: jobQueueSchemaReady,
          missing_objects: jobQueueSchema.missing_objects ?? [],
        },
        targets_certified: rows.length,
        selection_log,
        before_after: rows.map((r) => ({
          company_name: r.company_name,
          target_source: r.target_source,
          person_id: r.person_id,
          reachable_label: r.reachable_label,
          before: {
            verified_emails: r.before_db.verified_emails,
            verified_phones: r.before_db.verified_phones,
            verified_profiles: r.before_db.verified_profiles,
            overall_score: r.before_hydration.overall_score,
            outreach_ready: r.before_hydration.outreach_ready,
          },
          after: {
            verified_emails: r.after_db.verified_emails,
            verified_phones: r.after_db.verified_phones,
            verified_profiles: r.after_db.verified_profiles,
            overall_score: r.after_hydration.overall_score,
            outreach_ready: r.after_hydration.outreach_ready,
            channel_emails: r.after_hydration.channel_emails,
            channel_phones: r.after_hydration.channel_phones,
            channel_social: r.after_hydration.channel_social,
          },
          queue_summary: r.queues.map((q) => ({
            channel: q.channel,
            stage_status: q.stage_status,
            enqueue: q.enqueue,
            process_totals: q.process_totals,
            pending_after: q.after.pending,
            failed_after: q.after.failed,
          })),
          blockers: r.blockers,
        })),
        companies: rows,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL" || certification === "FAIL_DOWNSTREAM") {
    process.exit(1)
  }
}

void main()
