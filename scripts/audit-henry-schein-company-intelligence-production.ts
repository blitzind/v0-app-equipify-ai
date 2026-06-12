/**
 * Phase 14.2J.17 — Henry Schein company intelligence audit (production, no sends).
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-henry-schein-company-intelligence-production.ts
 *
 * Recovery (Henry Schein only):
 *   ... scripts/audit-henry-schein-company-intelligence-production.ts --recover
 */
import { createClient } from "@supabase/supabase-js"
import { resolveApolloEnrichmentCanonicalCompanyId } from "../lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { evaluateApollo25CompanyPilotCohortEnrollmentReadiness } from "../lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-readiness"
import { buildApollo25CompanyPilotSelectionInputs } from "../lib/growth/apollo/apollo-25-company-pilot-route"
import { loadApolloQualificationScoringContextForCompany } from "../lib/growth/apollo/apollo-qualification-scoring-context"
import { loadCompanyIdsInOtherActivePilotCohorts } from "../lib/growth/apollo/apollo-25-company-pilot-route"
import { parseApollo25CompanyPilotCohortSnapshotFromMetadata } from "../lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import { resolveApolloPilotMaterializationValidationActor } from "../lib/growth/apollo/apollo-pilot-materialization-validation-actor"
import { repromoteBestVerifiedCompanyIntelligenceRunForCompany } from "../lib/growth/company-intelligence/company-intelligence-repromote"
import { runCompanyIntelligenceForCanonicalCompany } from "../lib/growth/company-intelligence/company-intelligence-orchestrator"
import { loadProspectSearchEngineIntelligence } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-loader"
import { loadCompanyIntelligenceOperatorStatus } from "../lib/growth/company-intelligence/company-intelligence-operator-status"
import { loadCompanyIntelligenceRunDetail } from "../lib/growth/company-intelligence/company-intelligence-repository"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const HENRY_SCHEIN_COMPANY_CANDIDATE_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"
const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function main(): Promise<void> {
  const recover = process.argv.includes("--recover")
  const repromote = process.argv.includes("--repromote")

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase production credentials unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const actor = await resolveApolloPilotMaterializationValidationActor(admin, {
    acting_user_id: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_ID ?? null,
    acting_user_email: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_EMAIL ?? null,
  })

  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
  })

  const canonicalId = resolution.canonical_company_id

  const { data: enrollmentRow } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("id, status, growth_lead_id")
    .eq("company_candidate_id", HENRY_SCHEIN_COMPANY_CANDIDATE_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: ciRuns } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, status, verified_count, promoted_count, completed_at, created_at")
    .eq("company_id", canonicalId ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false })
    .limit(5)

  const runDetails = []
  for (const run of ciRuns ?? []) {
    if (!run.id) continue
    const detail = await loadCompanyIntelligenceRunDetail(admin, run.id as string)
    if (!detail) continue
    runDetails.push({
      run_id: detail.run_id,
      verified_count: detail.verified_count,
      promoted_count: detail.promoted_count,
      findings: detail.findings.map((finding) => ({
        intelligence_key: finding.intelligence_key,
        verification_status: finding.verification_status,
        confidence: finding.confidence,
        promotion_status: finding.promotion_status,
        promotion_reason: finding.promotion_reason,
      })),
    })
  }

  let ciSnapshots: Array<Record<string, unknown>> = []
  if (canonicalId) {
    const { data } = await admin
      .schema("growth")
      .from("company_intelligence_snapshots")
      .select("intelligence_category, intelligence_key, verification_status, confidence")
      .eq("company_id", canonicalId)
      .limit(20)
    ciSnapshots = (data ?? []) as Array<Record<string, unknown>>
  }

  let operatorStatus = canonicalId
    ? await loadCompanyIntelligenceOperatorStatus(admin, { company_id: canonicalId })
    : null

  const scoringBefore = await loadApolloQualificationScoringContextForCompany(admin, {
    company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
    growth_lead_id: asString(enrollmentRow?.growth_lead_id) || null,
    canonical_company_id: canonicalId,
  })

  const engineBefore = await loadProspectSearchEngineIntelligence(admin, {
    source_type: "external_discovered",
    id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
    growth_lead_id: asString(enrollmentRow?.growth_lead_id) || null,
    canonical_company_id: canonicalId,
  })

  let recovery: Record<string, unknown> | null = null
  let repromoteResult: Record<string, unknown> | null = null

  if (repromote && canonicalId) {
    repromoteResult = await repromoteBestVerifiedCompanyIntelligenceRunForCompany(admin, {
      company_id: canonicalId,
    })
  }

  if (
    recover &&
    canonicalId &&
    !scoringBefore.company_intelligence_present &&
    engineBefore.company_intelligence?.has_verified_intelligence !== true
  ) {
    try {
      const runResult = await runCompanyIntelligenceForCanonicalCompany(admin, {
        company_id: canonicalId,
        created_by: actor.acting_user_id,
        promote: true,
      })
      recovery = {
        attempted: true,
        run_id: runResult.run_id,
        status: runResult.status,
        verified_count: runResult.verified_count,
        promoted_count: runResult.promoted_count,
        finding_count: runResult.finding_count,
      }
    } catch (error) {
      recovery = {
        attempted: true,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (repromote || recover) {
    if (canonicalId) {
      const { data: refreshedSnapshots } = await admin
        .schema("growth")
        .from("company_intelligence_snapshots")
        .select("intelligence_category, intelligence_key, verification_status, confidence")
        .eq("company_id", canonicalId)
        .limit(20)
      ciSnapshots = ((refreshedSnapshots ?? []) as Array<Record<string, unknown>>)
      operatorStatus = await loadCompanyIntelligenceOperatorStatus(admin, { company_id: canonicalId })
    }
  }

  const scoringAfter = await loadApolloQualificationScoringContextForCompany(admin, {
    company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
    growth_lead_id: asString(enrollmentRow?.growth_lead_id) || null,
    canonical_company_id: canonicalId,
  })

  const selectionInputs = await buildApollo25CompanyPilotSelectionInputs(admin, {
    company_ids: [HENRY_SCHEIN_COMPANY_CANDIDATE_ID],
  })
  const henryInput = selectionInputs[0] ?? null

  const { data: cohortRow } = await admin
    .schema("growth")
    .from("apollo_pilot_cohorts")
    .select("metadata")
    .eq("id", COHORT_ID)
    .maybeSingle()

  const snapshot = parseApollo25CompanyPilotCohortSnapshotFromMetadata(
    (cohortRow?.metadata as Record<string, unknown> | undefined) ?? null,
  )
  const henrySnapshot = snapshot?.companies.find(
    (company) => company.company_candidate_id === HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
  )

  const otherActivePilotIds = await loadCompanyIdsInOtherActivePilotCohorts(admin, COHORT_ID)
  const enrollmentReadiness = snapshot
    ? evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
        snapshot_companies: snapshot.companies,
        selection_inputs: await buildApollo25CompanyPilotSelectionInputs(admin),
        cohort_id: COHORT_ID,
        company_ids_in_other_active_pilot_cohorts: otherActivePilotIds,
      })
    : null

  const henryEnrollment = enrollmentReadiness?.companies.find(
    (company) => company.company_candidate_id === HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
        company_name: "Henry Schein",
        cohort_id: COHORT_ID,
        recover_mode: recover,
        repromote_mode: repromote,
        validation_actor: actor,
        canonical_resolution: {
          canonical_company_id: canonicalId,
          resolution_blockers: resolution.resolution_blockers,
          evidence: resolution.evidence,
        },
        enrollment: enrollmentRow,
        company_intelligence_runs: ciRuns ?? [],
        company_intelligence_run_details: runDetails,
        company_intelligence_snapshots: ciSnapshots ?? [],
        operator_status: operatorStatus,
        engine_before: {
          has_verified_intelligence: engineBefore.company_intelligence?.has_verified_intelligence ?? false,
          snapshot_count: engineBefore.company_intelligence?.snapshot_count ?? 0,
          discovery_status: engineBefore.company_intelligence?.discovery_status ?? null,
        },
        scoring_context_before: {
          company_intelligence_present: scoringBefore.company_intelligence_present,
          company_intelligence_run: scoringBefore.company_intelligence_run
            ? {
                run_id: scoringBefore.company_intelligence_run.run_id,
                verified_count: scoringBefore.company_intelligence_run.verified_count,
                promoted_count: scoringBefore.company_intelligence_run.promoted_count,
              }
            : null,
        },
        recovery,
        repromote_result: repromoteResult,
        scoring_context_after: {
          company_intelligence_present: scoringAfter.company_intelligence_present,
          company_intelligence_run: scoringAfter.company_intelligence_run
            ? {
                run_id: scoringAfter.company_intelligence_run.run_id,
                verified_count: scoringAfter.company_intelligence_run.verified_count,
                promoted_count: scoringAfter.company_intelligence_run.promoted_count,
              }
            : null,
        },
        selection_input: henryInput
          ? {
              company_intelligence_present: henryInput.company_intelligence_present,
              enrollment_status: henryInput.enrollment_status,
              canonical_company_id: henryInput.canonical_company_id,
              growth_lead_id: henryInput.growth_lead_id,
            }
          : null,
        cohort_snapshot_company: henrySnapshot ?? null,
        henry_enrollment_readiness: henryEnrollment ?? null,
        cohort_enrollment_readiness: enrollmentReadiness
          ? {
              companies_evaluated: enrollmentReadiness.companies_evaluated,
              companies_ready: enrollmentReadiness.companies_ready,
              readiness_pct: enrollmentReadiness.readiness_pct,
            }
          : null,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
