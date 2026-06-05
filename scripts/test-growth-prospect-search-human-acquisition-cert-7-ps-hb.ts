/**
 * Phase 7.PS-HE — End-to-end human acquisition & promotion certification (live).
 * Run: pnpm test:growth-prospect-search-human-acquisition-cert-7-ps-hb
 */
import { readFileSync } from "node:fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"
import type { ProspectSearchEnrichmentTier } from "../lib/growth/prospect-search/prospect-search-progressive-enrichment"

const GROWTH_CERT_QA_MARKER = "growth-prospect-search-human-acquisition-cert-7-ps-he-v1" as const

const ICP_QUERIES = [
  "biomedical equipment service companies",
  "medical equipment repair companies",
] as const

const TARGET_ACQUISITION_COUNT = 5
const TARGET_HYDRATION_REGRESSION_COUNT = 3
const MAX_PERSONS_FOR_CHANNEL_JOBS = 2

type CertTargetMode = "acquisition" | "hydration_regression"

function simulateStaleProspectSearchCompanyShell(
  company: GrowthProspectSearchCompanyResult,
): GrowthProspectSearchCompanyResult {
  const intelligence = company.contact_intelligence
  if (!intelligence) return company
  const coverage = intelligence.engine_coverage
  return {
    ...company,
    contact_intelligence: {
      ...intelligence,
      has_contacts: false,
      contacts: [],
      engine_coverage: coverage
        ? {
            ...coverage,
            contacts: [],
            metrics: {
              ...coverage.metrics,
              contact_count: 0,
              contacts_with_canonical_person: 0,
              canonical_person_coverage_pct: 0,
            },
          }
        : coverage,
    },
  }
}

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

type DbSnapshot = {
  contact_candidates: number
  company_contacts: number
  persons: number
  person_company_roles: number
  verified_emails: number
  verified_phones: number
  verified_profiles: number
  committee_verified: number
}

type HydrationSnapshot = {
  overlay_contacts: number
  linked_persons: number
  reachable_label: string
  reachable_ok: boolean
  reachable_reasons: string[]
  enrichment_max_tier: string
  prioritization_tier: string | null
  research_completeness: string | null
  overall_score: number
  channel_emails: number
  channel_phones: number
  channel_social: number
  committee_verified: number
}

type CompanyCertRow = {
  query: string
  company_name: string
  company_candidate_id: string
  canonical_company_id: string | null
  cert_mode: CertTargetMode
  domain: string | null
  before_db: DbSnapshot
  after_acquisition_db: DbSnapshot
  after_full_db: DbSnapshot
  before_hydration: HydrationSnapshot
  after_acquisition_hydration: HydrationSnapshot
  after_full_hydration: HydrationSnapshot
  acquisition: {
    ok: boolean
    message: string
    discovery_contacts: number
    backfill_persons_linked: number
    provider_messages?: string[]
  }
  ps_c_eligibility: {
    email: { can_execute: boolean; blocked_reason: string | null }
    phone: { can_execute: boolean; blocked_reason: string | null }
    social: { can_execute: boolean; blocked_reason: string | null }
  }
  channel_jobs: {
    email: { enqueued: number; processed: number; failed: number }
    phone: { enqueued: number; processed: number; failed: number }
    social: { enqueued: number; processed: number; failed: number }
  }
  committee_job: { enqueued: boolean; processed: number; failed: number }
  failures: string[]
  outreach_ready_after: boolean
}

async function loadDbSnapshot(
  admin: SupabaseClient,
  input: { company_candidate_id: string; canonical_company_id: string | null },
): Promise<DbSnapshot> {
  const { count: contact_candidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id", { count: "exact", head: true })
    .eq("company_candidate_id", input.company_candidate_id)

  let company_contacts = 0
  let personIds: string[] = []

  if (input.canonical_company_id) {
    const { count } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", input.canonical_company_id)
    company_contacts = count ?? 0

    const { data: roles } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("person_id")
      .eq("company_id", input.canonical_company_id)
    personIds = [...new Set((roles ?? []).map((r) => String(r.person_id)).filter(Boolean))]
  }

  let verified_emails = 0
  let verified_phones = 0
  let verified_profiles = 0
  if (personIds.length > 0) {
    const { count: emailCount } = await admin
      .schema("growth")
      .from("person_emails")
      .select("id", { count: "exact", head: true })
      .in("person_id", personIds)
      .eq("verification_status", "verified")
    verified_emails = emailCount ?? 0

    const { count: phoneCount } = await admin
      .schema("growth")
      .from("person_phones")
      .select("id", { count: "exact", head: true })
      .in("person_id", personIds)
      .eq("verification_status", "verified")
    verified_phones = phoneCount ?? 0

    const { count: profileCount } = await admin
      .schema("growth")
      .from("person_profiles")
      .select("id", { count: "exact", head: true })
      .in("person_id", personIds)
      .eq("verification_status", "verified")
    verified_profiles = profileCount ?? 0
  }

  let committee_verified = 0
  if (input.canonical_company_id) {
    const { count } = await admin
      .schema("growth")
      .from("buying_committee_intelligence_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", input.canonical_company_id)
      .eq("verification_status", "verified")
    committee_verified = count ?? 0
  }

  return {
    contact_candidates: contact_candidates ?? 0,
    company_contacts,
    persons: personIds.length,
    person_company_roles: personIds.length,
    verified_emails,
    verified_phones,
    verified_profiles,
    committee_verified,
  }
}

function hydrationFromCompany(
  company: GrowthProspectSearchCompanyResult,
  scoring: {
    resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    hasProspectSearchReachableHumans: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").hasProspectSearchReachableHumans
    resolveProspectSearchProgressiveEnrichmentPlan: typeof import("../lib/growth/prospect-search/prospect-search-progressive-enrichment").resolveProspectSearchProgressiveEnrichmentPlan
  },
): HydrationSnapshot {
  const reachable =
    company.reachable_human ?? scoring.resolveProspectSearchReachableHumanScore(company)
  const plan = scoring.resolveProspectSearchProgressiveEnrichmentPlan({ company })
  const readiness = company.contact_intelligence?.engine_readiness
  const engine = company.contact_intelligence?.engine_intelligence
  return {
    overlay_contacts: company.contact_intelligence?.contacts?.length ?? 0,
    linked_persons: company.contact_intelligence?.engine_coverage?.metrics?.contacts_with_canonical_person ?? 0,
    reachable_label: reachable.label,
    reachable_ok: scoring.hasProspectSearchReachableHumans(reachable),
    reachable_reasons: reachable.reasons,
    enrichment_max_tier: plan.max_tier,
    prioritization_tier: readiness?.prioritization_tier ?? null,
    research_completeness: readiness?.research_completeness ?? null,
    overall_score: readiness?.overall?.score ?? 0,
    channel_emails: engine?.verified_channels?.persons_with_verified_email ?? 0,
    channel_phones: engine?.verified_channels?.persons_with_verified_phone ?? 0,
    channel_social: engine?.verified_channels?.persons_with_verified_profile ?? 0,
    committee_verified: engine?.buying_committee?.verified_member_count ?? 0,
  }
}

async function collectCanonicalTargets(
  admin: SupabaseClient,
  deps: {
    buildProspectSearchOperatorWorkspace: typeof import("../lib/growth/prospect-search/prospect-search-workspace").buildProspectSearchOperatorWorkspace
    prospectSearchWorkspaceCompanyNeedsHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-workspace").prospectSearchWorkspaceCompanyNeedsHumanAcquisition
  },
): Promise<Array<{
  query: string
  company: GrowthProspectSearchCompanyResult
  canonical_company_id: string
  mode: CertTargetMode
}>> {
  const { runProspectSearch } = await import(
    "../lib/growth/prospect-search/prospect-search-repository"
  )
  const targets: Array<{
    query: string
    company: GrowthProspectSearchCompanyResult
    canonical_company_id: string
    mode: CertTargetMode
  }> = []
  const seen = new Set<string>()
  let acquisitionCount = 0
  let hydrationRegressionCount = 0

  for (const query of ICP_QUERIES) {
    const result = await runProspectSearch(admin, {
      query,
      discovery_mode: "discover_external",
      result_mode: "companies",
      limit: 10,
      page: 1,
      page_size: 10,
      filters: {},
    })
    for (const company of result.companies ?? []) {
      const canonical =
        company.contact_intelligence?.engine_coverage?.company?.canonical_company_id ??
        company.canonical_company_id ??
        company.contact_intelligence?.engine_intelligence?.canonical_company_id
      if (!canonical || !company.contact_intelligence?.engine_coverage?.company?.resolved) continue
      const key = `${company.source_type}:${company.id}`
      if (seen.has(key)) continue

      const ref = deps.buildProspectSearchOperatorWorkspace([company]).company_refs[0]
      if (
        acquisitionCount < TARGET_ACQUISITION_COUNT &&
        ref &&
        deps.prospectSearchWorkspaceCompanyNeedsHumanAcquisition(ref)
      ) {
        seen.add(key)
        acquisitionCount += 1
        targets.push({ query, company, canonical_company_id: canonical, mode: "acquisition" })
        continue
      }

      if (hydrationRegressionCount >= TARGET_HYDRATION_REGRESSION_COUNT) continue
      const db = await loadDbSnapshot(admin, {
        company_candidate_id: company.id,
        canonical_company_id: canonical,
      })
      if (db.company_contacts > 0 || db.persons > 0) {
        seen.add(key)
        hydrationRegressionCount += 1
        targets.push({
          query,
          company,
          canonical_company_id: canonical,
          mode: "hydration_regression",
        })
      }
    }
  }
  return targets
}

async function runChannelAndCommitteeJobs(
  admin: SupabaseClient,
  input: {
    canonical_company_id: string
    person_ids: string[]
  },
  queues: {
    enqueueEmailDiscoveryJob: typeof import("../lib/growth/email-discovery/email-discovery-queue").enqueueEmailDiscoveryJob
    processEmailDiscoveryJobQueue: typeof import("../lib/growth/email-discovery/email-discovery-queue").processEmailDiscoveryJobQueue
    enqueuePhoneDiscoveryJob: typeof import("../lib/growth/phone-discovery/phone-discovery-queue").enqueuePhoneDiscoveryJob
    processPhoneDiscoveryJobQueue: typeof import("../lib/growth/phone-discovery/phone-discovery-queue").processPhoneDiscoveryJobQueue
    enqueueSocialProfileDiscoveryJob: typeof import("../lib/growth/social-profile-discovery/social-profile-discovery-queue").enqueueSocialProfileDiscoveryJob
    processSocialProfileDiscoveryJobQueue: typeof import("../lib/growth/social-profile-discovery/social-profile-discovery-queue").processSocialProfileDiscoveryJobQueue
    enqueueBuyingCommitteeIntelligenceJob: typeof import("../lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue").enqueueBuyingCommitteeIntelligenceJob
    processBuyingCommitteeIntelligenceJobQueue: typeof import("../lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue").processBuyingCommitteeIntelligenceJobQueue
  },
): Promise<CompanyCertRow["channel_jobs"] & { committee_job: CompanyCertRow["committee_job"] }> {
  let emailEnqueued = 0
  let phoneEnqueued = 0
  let socialEnqueued = 0

  for (const person_id of input.person_ids.slice(0, MAX_PERSONS_FOR_CHANNEL_JOBS)) {
    const email = await queues.enqueueEmailDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (email.enqueued) emailEnqueued += 1

    const phone = await queues.enqueuePhoneDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (phone.enqueued) phoneEnqueued += 1

    const social = await queues.enqueueSocialProfileDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      discovery_scope: "person",
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (social.enqueued) socialEnqueued += 1
  }

  const emailRun = await queues.processEmailDiscoveryJobQueue(admin, 10)
  const phoneRun = await queues.processPhoneDiscoveryJobQueue(admin, 10)
  const socialRun = await queues.processSocialProfileDiscoveryJobQueue(admin, 10)

  const committeeEnqueue = await queues.enqueueBuyingCommitteeIntelligenceJob(admin, {
    company_id: input.canonical_company_id,
    promote_on_complete: true,
    trigger_source: "manual",
  })
  const committeeRun = await queues.processBuyingCommitteeIntelligenceJobQueue(admin, 5)

  return {
    email: {
      enqueued: emailEnqueued,
      processed: emailRun.processed,
      failed: emailRun.failed,
    },
    phone: {
      enqueued: phoneEnqueued,
      processed: phoneRun.processed,
      failed: phoneRun.failed,
    },
    social: {
      enqueued: socialEnqueued,
      processed: socialRun.processed,
      failed: socialRun.failed,
    },
    committee_job: {
      enqueued: Boolean(committeeEnqueue.enqueued),
      processed: committeeRun.processed,
      failed: committeeRun.failed,
    },
  }
}

async function certifyCompany(
  admin: SupabaseClient,
  target: {
    query: string
    company: GrowthProspectSearchCompanyResult
    canonical_company_id: string
    mode: CertTargetMode
  },
  runDownstream: boolean,
  jobQueueSchemaReady: boolean,
  deps: {
    runProspectSearchHumanAcquisitionPipeline: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition").runProspectSearchHumanAcquisitionPipeline
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    buildProspectSearchActionableResearchPlan: typeof import("../lib/growth/prospect-search/prospect-search-actionable-research").buildProspectSearchActionableResearchPlan
    compareProspectSearchEnrichmentTiers: typeof import("../lib/growth/prospect-search/prospect-search-progressive-enrichment").compareProspectSearchEnrichmentTiers
    scoring: {
      resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
      hasProspectSearchReachableHumans: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").hasProspectSearchReachableHumans
      resolveProspectSearchProgressiveEnrichmentPlan: typeof import("../lib/growth/prospect-search/prospect-search-progressive-enrichment").resolveProspectSearchProgressiveEnrichmentPlan
    }
    queues: Parameters<typeof runChannelAndCommitteeJobs>[2]
  },
): Promise<CompanyCertRow> {
  const failures: string[] = []
  const company = target.company
  const company_candidate_id = company.id
  const canonical_company_id = target.canonical_company_id
  const hydrationShell =
    target.mode === "hydration_regression"
      ? simulateStaleProspectSearchCompanyShell(company)
      : company

  const before_db = await loadDbSnapshot(admin, { company_candidate_id, canonical_company_id })
  const before_hydration = hydrationFromCompany(hydrationShell, deps.scoring)

  let acquisition: CompanyCertRow["acquisition"]
  let after_acquisition_db: DbSnapshot
  let afterCompany: GrowthProspectSearchCompanyResult

  if (target.mode === "hydration_regression") {
    acquisition = {
      ok: true,
      message: "Hydration regression — DB contacts reloaded without re-running acquisition.",
      discovery_contacts: 0,
      backfill_persons_linked: 0,
      provider_messages: [],
    }
    after_acquisition_db = before_db
    afterCompany = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: hydrationShell,
      canonical_company_id,
      query: target.query,
    })
    if (before_hydration.overlay_contacts > 0) {
      failures.push("hydration regression: expected stale shell with overlay_contacts=0 before refresh")
    }
  } else {
    const pipeline = await deps.runProspectSearchHumanAcquisitionPipeline(admin, {
      company_candidate_id,
      canonical_company_id,
      run_discovery: true,
      company_snapshot: company,
      search_query: target.query,
    })
    acquisition = {
      ok: pipeline.ok,
      message: pipeline.message,
      discovery_contacts: pipeline.discovery_contacts,
      backfill_persons_linked: pipeline.backfill_persons_linked,
      provider_messages: pipeline.provider_messages,
    }
    if (!pipeline.ok) failures.push(`acquisition: ${pipeline.message}`)

    after_acquisition_db = await loadDbSnapshot(admin, { company_candidate_id, canonical_company_id })
    afterCompany =
      pipeline.refreshed_company ??
      (await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
        company,
        canonical_company_id,
        query: target.query,
      }))
  }

  const after_acquisition_hydration = hydrationFromCompany(afterCompany, deps.scoring)

  if (
    after_acquisition_db.contact_candidates > 0 &&
    after_acquisition_hydration.overlay_contacts === 0
  ) {
    failures.push("hydration: contact_intelligence overlay empty after DB acquisition")
  }
  if (
    after_acquisition_db.persons > 0 &&
    !after_acquisition_hydration.reachable_ok &&
    after_acquisition_hydration.reachable_label === "no_reachable_humans"
  ) {
    failures.push("reachable: acquired persons not visible in reachable human scoring")
  }

  const tierBefore = before_hydration.enrichment_max_tier
  const tierAfter = after_acquisition_hydration.enrichment_max_tier
  if (
    deps.compareProspectSearchEnrichmentTiers(
      tierAfter as ProspectSearchEnrichmentTier,
      tierBefore as ProspectSearchEnrichmentTier,
    ) < 0
  ) {
    failures.push("reachable: tier did not advance after acquisition")
  }

  const { data: roleRows } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id")
    .eq("company_id", canonical_company_id)

  const person_ids = [...new Set((roleRows ?? []).map((r) => String(r.person_id)).filter(Boolean))]

  const ps_c_eligibility = {
    email: (() => {
      const plan = deps.buildProspectSearchActionableResearchPlan({
        company: afterCompany,
        actionKind: "verify_email",
        personId: person_ids[0] ?? null,
      })
      return { can_execute: plan.can_execute, blocked_reason: plan.blocked_reason }
    })(),
    phone: (() => {
      const plan = deps.buildProspectSearchActionableResearchPlan({
        company: afterCompany,
        actionKind: "verify_phone_numbers",
        personId: person_ids[0] ?? null,
      })
      return { can_execute: plan.can_execute, blocked_reason: plan.blocked_reason }
    })(),
    social: (() => {
      const plan = deps.buildProspectSearchActionableResearchPlan({
        company: afterCompany,
        actionKind: "queue_social_profile_discovery",
        personId: person_ids[0] ?? null,
      })
      return { can_execute: plan.can_execute, blocked_reason: plan.blocked_reason }
    })(),
  }

  if (person_ids.length === 0) failures.push("promotion: no person_company_roles after acquisition")

  let channel_jobs: CompanyCertRow["channel_jobs"] = {
    email: { enqueued: 0, processed: 0, failed: 0 },
    phone: { enqueued: 0, processed: 0, failed: 0 },
    social: { enqueued: 0, processed: 0, failed: 0 },
  }
  let committee_job: CompanyCertRow["committee_job"] = {
    enqueued: false,
    processed: 0,
    failed: 0,
  }

  if (runDownstream && person_ids.length > 0) {
    if (!jobQueueSchemaReady) {
      failures.push("job_queues: PS-C job queue schema not ready — apply job migrations before downstream certification")
    } else {
      try {
        const jobResult = await runChannelAndCommitteeJobs(
          admin,
          { canonical_company_id, person_ids },
          deps.queues,
        )
        channel_jobs = {
          email: jobResult.email,
          phone: jobResult.phone,
          social: jobResult.social,
        }
        committee_job = jobResult.committee_job
        if (jobResult.email.processed === 0 && jobResult.email.enqueued > 0) {
          failures.push("verification: email discovery jobs did not complete")
        }
      } catch (e) {
        failures.push(`channel/committee: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const after_full_db = await loadDbSnapshot(admin, { company_candidate_id, canonical_company_id })
  afterCompany = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
    company: afterCompany,
    canonical_company_id,
    query: target.query,
  })
  const after_full_hydration = hydrationFromCompany(afterCompany, deps.scoring)

  const outreach_ready_after = after_full_hydration.prioritization_tier === "ready_for_outreach"

  return {
    query: target.query,
    company_name: company.company_name,
    company_candidate_id,
    canonical_company_id,
    cert_mode: target.mode,
    domain: company.domain ?? company.website ?? null,
    before_db,
    after_acquisition_db,
    after_full_db,
    before_hydration,
    after_acquisition_hydration,
    after_full_hydration,
    acquisition,
    ps_c_eligibility,
    channel_jobs,
    committee_job,
    failures,
    outreach_ready_after,
  }
}

async function main() {
  const creds = bootstrapEnv()
  if (!creds) {
    console.error(JSON.stringify({ qa_marker: GROWTH_CERT_QA_MARKER, error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(creds.url, creds.jwt, { auth: { persistSession: false } })

  const [
    { runProspectSearchHumanAcquisitionPipeline },
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchActionableResearchPlan },
    {
      hasProspectSearchReachableHumans,
      resolveProspectSearchReachableHumanScore,
    },
    {
      buildProspectSearchOperatorWorkspace,
      prospectSearchWorkspaceCompanyNeedsHumanAcquisition,
    },
    { compareProspectSearchEnrichmentTiers, resolveProspectSearchProgressiveEnrichmentPlan },
    emailQueue,
    phoneQueue,
    socialQueue,
    committeeQueue,
    { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER },
    {
      probeGrowthEngineJobQueueSchema,
      GROWTH_ENGINE_JOB_QUEUE_SCHEMA_HEALTH_QA_MARKER,
    },
  ] = await Promise.all([
    import("../lib/growth/prospect-search/prospect-search-human-acquisition"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-actionable-research"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/prospect-search/prospect-search-workspace"),
    import("../lib/growth/prospect-search/prospect-search-progressive-enrichment"),
    import("../lib/growth/email-discovery/email-discovery-queue"),
    import("../lib/growth/phone-discovery/phone-discovery-queue"),
    import("../lib/growth/social-profile-discovery/social-profile-discovery-queue"),
    import("../lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-types"),
    import("../lib/growth/growth-engine-job-queue-schema-health"),
  ])

  const jobQueueSchema = await probeGrowthEngineJobQueueSchema(admin)
  const jobQueueSchemaReady = jobQueueSchema.ready

  const deps = {
    runProspectSearchHumanAcquisitionPipeline,
    refreshProspectSearchCompanyAfterHumanAcquisition,
    buildProspectSearchActionableResearchPlan,
    compareProspectSearchEnrichmentTiers,
    scoring: {
      resolveProspectSearchReachableHumanScore,
      hasProspectSearchReachableHumans,
      resolveProspectSearchProgressiveEnrichmentPlan,
    },
    queues: {
      enqueueEmailDiscoveryJob: emailQueue.enqueueEmailDiscoveryJob,
      processEmailDiscoveryJobQueue: emailQueue.processEmailDiscoveryJobQueue,
      enqueuePhoneDiscoveryJob: phoneQueue.enqueuePhoneDiscoveryJob,
      processPhoneDiscoveryJobQueue: phoneQueue.processPhoneDiscoveryJobQueue,
      enqueueSocialProfileDiscoveryJob: socialQueue.enqueueSocialProfileDiscoveryJob,
      processSocialProfileDiscoveryJobQueue: socialQueue.processSocialProfileDiscoveryJobQueue,
      enqueueBuyingCommitteeIntelligenceJob: committeeQueue.enqueueBuyingCommitteeIntelligenceJob,
      processBuyingCommitteeIntelligenceJobQueue:
        committeeQueue.processBuyingCommitteeIntelligenceJobQueue,
    },
  }

  const targets = await collectCanonicalTargets(admin, {
    buildProspectSearchOperatorWorkspace,
    prospectSearchWorkspaceCompanyNeedsHumanAcquisition,
  })
  if (targets.length === 0) {
    const probeQueries: Array<{ query: string; provider_status_label: string | null; companies: number }> =
      []
    const { runProspectSearch } = await import(
      "../lib/growth/prospect-search/prospect-search-repository"
    )
    for (const query of ICP_QUERIES) {
      const result = await runProspectSearch(admin, {
        query,
        discovery_mode: "discover_external",
        result_mode: "companies",
        limit: 10,
        page: 1,
        page_size: 10,
        filters: {},
      })
      probeQueries.push({
        query,
        provider_status_label: result.provider_status_label ?? null,
        companies: result.companies?.length ?? 0,
      })
    }
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_CERT_QA_MARKER,
          certification: "FAIL",
          reason: "No acquire_humans canonical targets from ICP searches.",
          growth_engine_enabled: process.env.GROWTH_ENGINE_ENABLED === "true",
          icp_probe: probeQueries,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const rows: CompanyCertRow[] = []
  let downstreamSlots = 3

  for (const target of targets) {
    const runDownstream = downstreamSlots > 0
    const row = await certifyCompany(admin, target, runDownstream, jobQueueSchemaReady, deps)
    rows.push(row)
    if (runDownstream && row.after_acquisition_db.person_company_roles > 0) {
      downstreamSlots -= 1
    }
  }

  const passCompany = rows.find(
    (r) =>
      r.after_acquisition_db.persons > 0 &&
      r.after_acquisition_hydration.reachable_ok &&
      (r.after_full_db.verified_emails > 0 ||
        r.after_full_db.verified_phones > 0 ||
        r.after_full_hydration.channel_emails > 0 ||
        r.after_full_hydration.channel_phones > 0) &&
      r.outreach_ready_after,
  )

  const partialPass = rows.find(
    (r) =>
      r.after_acquisition_db.persons > 0 &&
      r.after_acquisition_hydration.reachable_ok &&
      (r.after_full_db.committee_verified > 0 ||
        r.after_full_hydration.committee_verified > 0 ||
        r.after_full_db.verified_emails > 0),
  )

  const hydrationPass = rows.find(
    (r) =>
      r.after_acquisition_db.persons > 0 &&
      r.after_acquisition_hydration.overlay_contacts > 0 &&
      r.after_acquisition_hydration.linked_persons > 0 &&
      r.after_acquisition_hydration.reachable_label !== "no_reachable_humans" &&
      r.ps_c_eligibility.email.can_execute &&
      r.ps_c_eligibility.phone.can_execute &&
      r.ps_c_eligibility.social.can_execute,
  )

  const certification = passCompany
    ? "PASS"
    : partialPass
      ? "PASS_PARTIAL"
      : hydrationPass
        ? "PASS_HYDRATION"
        : rows.some((r) => r.after_acquisition_db.persons > 0)
            ? "FAIL_DOWNSTREAM"
            : "FAIL"

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CERT_QA_MARKER,
        human_acquisition_qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
        job_queue_schema_qa_marker: GROWTH_ENGINE_JOB_QUEUE_SCHEMA_HEALTH_QA_MARKER,
        growth_engine_enabled: process.env.GROWTH_ENGINE_ENABLED === "true",
        growth_research_website_enabled: process.env.GROWTH_RESEARCH_WEBSITE_ENABLED === "true",
        job_queue_schema: {
          ready: jobQueueSchemaReady,
          missing_objects: jobQueueSchema.missing_objects ?? [],
          warning_message: jobQueueSchema.warning_message ?? null,
        },
        targets_certified: rows.length,
        certification,
        pass_company:
          passCompany?.company_name ??
          partialPass?.company_name ??
          hydrationPass?.company_name ??
          null,
        companies: rows,
        summary: {
          with_persons_after: rows.filter((r) => r.after_acquisition_db.persons > 0).length,
          with_overlay_contacts: rows.filter(
            (r) => r.after_acquisition_hydration.overlay_contacts > 0,
          ).length,
          reachable_after: rows.filter((r) => r.after_acquisition_hydration.reachable_ok).length,
          humans_visible_after: rows.filter(
            (r) => r.after_acquisition_hydration.reachable_label !== "no_reachable_humans",
          ).length,
          with_verified_email: rows.filter((r) => r.after_full_db.verified_emails > 0).length,
          with_verified_phone: rows.filter((r) => r.after_full_db.verified_phones > 0).length,
          with_committee: rows.filter((r) => r.after_full_db.committee_verified > 0).length,
          outreach_ready: rows.filter((r) => r.outreach_ready_after).length,
        },
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
