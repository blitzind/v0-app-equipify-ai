/**
 * GE-AIOS-LIVE-1C — Create one production lead via canonical Prospect Search push + verify pipeline.
 *
 *   pnpm run:ge-aios-live-1c-first-production-lead
 *   pnpm run:ge-aios-live-1c-first-production-lead -- --inspect-only <leadId>
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { pushProspectSearchCompanyToLeadInbox } from "@/lib/growth/prospect-search/prospect-search-push-to-inbox"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { GROWTH_LEAD_ADMISSION_21C_QA_MARKER } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { GROWTH_COMPANY_EVIDENCE_22_QA_MARKER } from "@/lib/growth/research/company-evidence/company-evidence-types"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { evaluateGrowthLeadAdmission } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"

const PHASE = "GE-AIOS-LIVE-1C" as const

/** Known-good ICP — biomedical equipment service; not in legacy pool at selection time. */
const LIVE_1C_COMPANY = {
  company_name: "Block Imaging",
  website: "https://www.blockimaging.com",
  industry: "Biomedical and medical equipment service",
  city: "Holt",
  state: "MI",
  location: "Holt, Michigan",
  keywords: [
    "biomedical equipment service",
    "medical imaging repair",
    "preventive maintenance",
    "field service technicians",
    "equipment parts",
    "installation",
    "calibration",
  ],
  signals: [
    "Medical imaging equipment service and repair",
    "Field service and preventive maintenance",
    "Parts, installation, and equipment lifecycle support",
  ],
} as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildProspectSearchCompany(generatedAt: string): GrowthProspectSearchCompanyResult {
  const id = `live-1c-${generatedAt.replace(/[:.]/g, "-")}`
  return {
    id,
    source_type: "external_discovered",
    discovery_provider_type: "google_places",
    discovery_provider_name: "GE-AIOS-LIVE-1C operator validation",
    company_name: LIVE_1C_COMPANY.company_name,
    website: LIVE_1C_COMPANY.website,
    industry: LIVE_1C_COMPANY.industry,
    subindustry: "Medical imaging equipment service",
    employees: "51-100",
    revenue_range: null,
    location: LIVE_1C_COMPANY.location,
    city: LIVE_1C_COMPANY.city,
    state: LIVE_1C_COMPANY.state,
    service_area: "United States",
    intent_score: 72,
    buying_stage: null,
    buying_stage_confidence: null,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: null,
    lead_engine_score: null,
    lead_engine_score_label: null,
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    confidence: 0.86,
    company_match_confidence: 0.88,
    decision_maker_coverage: null,
    verification_status: "unknown",
    signals: [...LIVE_1C_COMPANY.signals],
    search_intent_category: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 0.82,
    match_reasoning: [
      "Operator-selected known-good biomedical equipment service ICP match (GE-AIOS-LIVE-1C).",
      "Field service, repair, preventive maintenance, and installation on medical imaging equipment.",
    ],
    keywords: [...LIVE_1C_COMPANY.keywords],
    existing_account: false,
    in_revenue_queue: false,
    existing_customer: false,
    existing_prospect: false,
    already_pushed: false,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
  }
}

async function listExistingDomains(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("company_name, website, source_kind")
    .order("created_at", { ascending: false })
    .limit(100)
  const domains = new Set<string>()
  const sourceKinds = new Set<string>()
  for (const row of data ?? []) {
    sourceKinds.add(String(row.source_kind ?? ""))
    const website = (row.website ?? "").toLowerCase()
    if (website.includes("blockimaging")) domains.add("blockimaging.com")
    domains.add(website)
  }
  console.log(`  existing pool source_kind values: ${[...sourceKinds].filter(Boolean).sort().join(", ") || "(none)"}`)
  return domains
}

async function inspectLead(admin: SupabaseClient, leadId: string) {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) {
    console.log("  lead not found")
    return null
  }

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const activeRun = await fetchActiveProspectResearchRun(admin, leadId)

  let completedRunEvidence = false
  let researchRunId: string | null = lead.latestProspectResearchRunId ?? null
  if (researchRunId) {
    const { data: runRow } = await admin
      .schema("growth")
      .from("research_runs")
      .select("id, status, signals, completed_at")
      .eq("id", researchRunId)
      .maybeSingle()
    if (runRow) {
      const signals = (runRow.signals ?? {}) as Record<string, unknown>
      const bundle = signals.companyEvidence_v22 as { qa_marker?: string } | undefined
      completedRunEvidence = bundle?.qa_marker === GROWTH_COMPANY_EVIDENCE_22_QA_MARKER
      console.log(`  research run: ${runRow.id} status=${runRow.status} completed=${runRow.completed_at ?? "(pending)"}`)
      console.log(`  research signal keys: ${Object.keys(signals).join(", ") || "(none)"}`)
    }
  }

  console.log("\n--- Lead Pipeline Inspect ---")
  console.log(`  leadId: ${lead.id}`)
  console.log(`  company: ${lead.companyName}`)
  console.log(`  website: ${lead.website}`)
  console.log(`  status: ${lead.status}`)
  console.log(`  admission_state: ${metadata.admission_state ?? "(missing)"}`)
  console.log(`  admission_qa_marker: ${metadata.admission_qa_marker ?? "(missing)"}`)
  console.log(`  admission_reasons: ${JSON.stringify(metadata.admission_reasons ?? [])}`)
  console.log(`  admission_evaluated_at: ${metadata.admission_evaluated_at ?? "(missing)"}`)
  console.log(`  latestProspectResearchRunId: ${lead.latestProspectResearchRunId ?? "(none)"}`)
  console.log(`  active research run: ${activeRun?.id ?? "(none)"} status=${activeRun?.status ?? "(n/a)"}`)
  console.log(`  companyEvidence_v22 present: ${completedRunEvidence}`)
  console.log(`  nextBestAction: ${lead.nextBestAction ?? "(none)"}`)
  console.log(`  sourceKind: ${lead.sourceKind ?? "(none)"}`)
  console.log(`  metadata keys: ${Object.keys(metadata).sort().join(", ")}`)

  const admissionContext = await loadGrowthLeadAdmissionContext(admin, EQUIPIFY_PRODUCTION_ORG_ID)
  const evaluated = evaluateGrowthLeadAdmission(
    buildGrowthLeadAdmissionIntakeFromLead({
      id: lead.id,
      company_name: lead.companyName,
      contact_name: lead.contactName,
      contact_email: lead.contactEmail,
      website: lead.website,
      status: lead.status,
      metadata,
    }),
    admissionContext,
  )
  console.log(`  evaluated admission (21C re-run): ${evaluated.state}`)
  console.log(`  evaluated admission reasons: ${JSON.stringify(evaluated.reasons)}`)
  console.log(`  evaluated admission qa marker: ${evaluated.qa_marker}`)

  return {
    lead,
    metadata,
    admissionOk:
      metadata.admission_state != null &&
      metadata.admission_qa_marker === GROWTH_LEAD_ADMISSION_21C_QA_MARKER &&
      Array.isArray(metadata.admission_reasons) &&
      typeof metadata.admission_evaluated_at === "string",
    researchStarted: Boolean(activeRun || lead.latestProspectResearchRunId),
    companyEvidenceOk: completedRunEvidence,
    researchRunId,
  }
}

async function main(): Promise<void> {
  const inspectOnly = process.argv.includes("--inspect-only")
  const inspectLeadId = process.argv[process.argv.indexOf("--inspect-only") + 1]

  console.log(`[${PHASE}] First production lead validation`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}`)
  console.log(`Canonical intake: POST /api/platform/growth/prospect-search → push_to_lead_inbox`)
  console.log(`Service: pushProspectSearchCompanyToLeadInbox → createLeadCandidate → resolveUnifiedLeadFromIntake`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin = bootstrap.admin

  if (inspectOnly && inspectLeadId) {
    await inspectLead(admin, inspectLeadId)
    return
  }

  const existing = await listExistingDomains(admin)
  if (process.argv.includes("--check-pool-only")) {
    process.exit(0)
  }
  if (existing.has("blockimaging.com") || [...existing].some((d) => d.includes("blockimaging"))) {
    console.error("Block Imaging already exists in production pool — pick another company.")
    process.exit(1)
  }

  console.log("\n--- ICP Rationale ---")
  console.log("  Block Imaging services, repairs, and maintains medical imaging equipment nationwide.")
  console.log("  Matches approved profile: biomedical equipment service, field technicians, PM, parts, installation.")
  console.log("  Not manufacturing-primary; not retail/software.")

  const generatedAt = new Date().toISOString()
  const company = buildProspectSearchCompany(generatedAt)
  const query = "biomedical equipment service Michigan field service maintenance"

  console.log("\n--- Creating Lead (canonical push) ---")
  const push = await pushProspectSearchCompanyToLeadInbox(
    admin,
    company,
    query,
    { userId: null, email: "ge-aios-live-1c-operator@equipify.ai" },
  )

  console.log(`  push outcome: ${push.outcome}`)
  console.log(`  message: ${push.message}`)
  console.log(`  growth_lead_id: ${push.growth_lead_id ?? "(none)"}`)
  console.log(`  lead_created: ${push.lead_created ?? "(unknown)"}`)

  if (push.outcome !== "pushed" || !push.growth_lead_id) {
    console.error("\n[GE-AIOS-LIVE-1C] STOP — lead creation failed.")
    process.exit(1)
  }

  const leadId = push.growth_lead_id
  let last: Awaited<ReturnType<typeof inspectLead>> = null

  console.log("\n--- Polling pipeline (natural production; no manual research trigger) ---")
  for (let attempt = 1; attempt <= 20; attempt++) {
    last = await inspectLead(admin, leadId)
    if (!last) break
    if (last.admissionOk && last.companyEvidenceOk) break
    if (attempt < 20) {
      console.log(`  … waiting 30s (attempt ${attempt}/20)`)
      await sleep(30_000)
    }
  }

  if (!last?.admissionOk) {
    console.error("\n[GE-AIOS-LIVE-1C] STOP — 21C admission metadata incomplete.")
    process.exit(1)
  }

  if (!last.researchStarted) {
    console.error("\n[GE-AIOS-LIVE-1C] STOP — canonical research has not started (autonomous loop may not have run yet).")
    process.exit(1)
  }

  if (!last.companyEvidenceOk) {
    console.error("\n[GE-AIOS-LIVE-1C] STOP — companyEvidence_v22 not yet present (research may still be running).")
    process.exit(1)
  }

  console.log("\n[GE-AIOS-LIVE-1C] Pipeline checkpoints passed for lead", leadId)
}

void main()
