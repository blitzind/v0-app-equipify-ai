/** Apollo 25-company pilot launch — server-only route handlers. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { summarizeApolloOperatorReviewForQualification } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentCandidateStatus } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { resolveApolloEnrollmentQualificationThreshold } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { buildApollo25CompanyPilotEligibilityDiagnostic } from "@/lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import {
  buildApollo25CompanyPilotLaunchReport,
  resolveApollo25CompanyPilotEnvGatesOk,
} from "@/lib/growth/apollo/apollo-25-company-pilot-launch-report"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { Apollo25CompanyPilotSelectionMode } from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import {
  buildApollo25CompanyPilotGreenfieldCohortSnapshot,
  parseApollo25CompanyPilotCohortSnapshotFromMetadata,
  snapshotCompaniesFromCohortCompanyRows,
} from "@/lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import { buildApollo25CompanyPilotCohortReview } from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-review"
import type { Apollo25CompanyPilotPersonalizationMaterializationState } from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation"
import { createApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"
import { loadApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import { enrichApollo25CompanyPilotSelectionInputWithIntelligence } from "@/lib/growth/apollo/apollo-intelligence-recovery-enrichment"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

const COHORTS_TABLE = "apollo_pilot_cohorts"
const COMPANIES_TABLE = "apollo_pilot_cohort_companies"
const ENROLLMENT_TABLE = "apollo_enrollment_candidates"
const CONTACT_CANDIDATES_TABLE = "contact_candidates"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parsePilotSelectionMode(value: unknown): Apollo25CompanyPilotSelectionMode {
  const raw = asString(value)
  if (raw === "existing_pipeline_revalidation") return "existing_pipeline_revalidation"
  return "greenfield"
}

async function loadActivePilotCompanyIds(admin: SupabaseClient): Promise<Set<string>> {
  const { data: cohorts, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .select("id, status")
    .in("status", ["draft", "active", "paused"])

  if (error) throw new Error(error.message)

  const cohortIds = (cohorts ?? []).map((row) => asString((row as Record<string, unknown>).id)).filter(Boolean)
  if (cohortIds.length === 0) return new Set()

  const { data: companies, error: companiesError } = await admin
    .schema("growth")
    .from(COMPANIES_TABLE)
    .select("company_candidate_id")
    .in("cohort_id", cohortIds)

  if (companiesError) throw new Error(companiesError.message)

  const ids = new Set<string>()
  for (const row of companies ?? []) {
    const id = asString((row as Record<string, unknown>).company_candidate_id)
    if (id) ids.add(id)
  }
  return ids
}

export async function loadApolloDiscoveredCompanyIds(admin: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()

  const [enrollmentRes, contactCandidateRes] = await Promise.all([
    admin.schema("growth").from(ENROLLMENT_TABLE).select("company_candidate_id"),
    admin
      .schema("growth")
      .from(CONTACT_CANDIDATES_TABLE)
      .select("company_candidate_id")
      .eq("provider_type", "future_apollo")
      .not("company_candidate_id", "is", null),
  ])

  if (enrollmentRes.error) throw new Error(enrollmentRes.error.message)
  if (contactCandidateRes.error) throw new Error(contactCandidateRes.error.message)

  for (const row of enrollmentRes.data ?? []) {
    const id = asString((row as Record<string, unknown>).company_candidate_id)
    if (id) ids.add(id)
  }
  for (const row of contactCandidateRes.data ?? []) {
    const id = asString((row as Record<string, unknown>).company_candidate_id)
    if (id) ids.add(id)
  }

  return [...ids].sort()
}

async function loadEnrollmentStateByCompany(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<
  Record<
    string,
    {
      status: ApolloEnrollmentCandidateStatus | null
      growth_lead_id: string | null
    }
  >
> {
  if (companyIds.length === 0) return {}

  const { data, error } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("company_candidate_id, status, growth_lead_id, updated_at")
    .in("company_candidate_id", companyIds)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)

  const map: Record<string, { status: ApolloEnrollmentCandidateStatus | null; growth_lead_id: string | null }> =
    {}

  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const companyId = asString(record.company_candidate_id)
    if (!companyId || map[companyId]) continue
    const status = asString(record.status) as ApolloEnrollmentCandidateStatus
    map[companyId] = {
      status: status || null,
      growth_lead_id: asString(record.growth_lead_id) || null,
    }
  }

  return map
}

async function loadPipelineStateByCompany(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<
  Record<
    string,
    {
      has_execution_ready_candidate: boolean
      has_account_playbook: boolean
    }
  >
> {
  if (companyIds.length === 0) return {}

  const [executionRes, playbookRes] = await Promise.all([
    admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("company_candidate_id, status")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("account_playbooks")
      .select("company_candidate_id")
      .in("company_candidate_id", companyIds),
  ])

  if (executionRes.error) throw new Error(executionRes.error.message)
  if (playbookRes.error) throw new Error(playbookRes.error.message)

  const map: Record<string, { has_execution_ready_candidate: boolean; has_account_playbook: boolean }> = {}

  for (const companyId of companyIds) {
    map[companyId] = { has_execution_ready_candidate: false, has_account_playbook: false }
  }

  for (const row of executionRes.data ?? []) {
    const record = row as Record<string, unknown>
    const companyId = asString(record.company_candidate_id)
    if (!companyId || !map[companyId]) continue
    if (asString(record.status) === "execution_ready") {
      map[companyId].has_execution_ready_candidate = true
    }
  }

  for (const row of playbookRes.data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_candidate_id)
    if (!companyId || !map[companyId]) continue
    map[companyId].has_account_playbook = true
  }

  return map
}

async function loadActiveEnrollmentLeadIds(admin: SupabaseClient, leadIds: string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set()

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("lead_id")
    .in("lead_id", leadIds)
    .in("status", ["draft", "active", "paused"])

  if (error) throw new Error(error.message)

  const active = new Set<string>()
  for (const row of data ?? []) {
    const leadId = asString((row as Record<string, unknown>).lead_id)
    if (leadId) active.add(leadId)
  }
  return active
}

export async function buildApollo25CompanyPilotSelectionInputs(
  admin: SupabaseClient,
  options?: { company_ids?: string[] },
): Promise<Apollo25CompanyPilotSelectionInput[]> {
  const pool = options?.company_ids ?? await loadApolloDiscoveredCompanyIds(admin)
  const activePilotIds = await loadActivePilotCompanyIds(admin)
  const enrollmentState = await loadEnrollmentStateByCompany(admin, pool)
  const pipelineState = await loadPipelineStateByCompany(admin, pool)
  const leadIds = [
    ...new Set(Object.values(enrollmentState).map((row) => row.growth_lead_id).filter(Boolean) as string[]),
  ]
  const activeLeadIds = await loadActiveEnrollmentLeadIds(admin, leadIds)

  const inputs: Apollo25CompanyPilotSelectionInput[] = []

  for (const companyId of pool) {
    const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, companyId)
    if (!snapshot) continue

    const enrollment = enrollmentState[companyId]
    const pipeline = pipelineState[companyId]
    const hasActive = enrollment?.growth_lead_id ? activeLeadIds.has(enrollment.growth_lead_id) : false

    const baseInput: Apollo25CompanyPilotSelectionInput = {
      company_candidate_id: companyId,
      company_name: snapshot.company_name,
      domain: null,
      contacts: snapshot.contacts,
      snapshot_summary: summarizeApolloOperatorReviewForQualification(snapshot),
      enrollment_status: enrollment?.status ?? null,
      growth_lead_id: enrollment?.growth_lead_id ?? null,
      has_active_sequence_enrollment: hasActive,
      in_active_pilot_cohort: activePilotIds.has(companyId),
      has_execution_ready_candidate: pipeline?.has_execution_ready_candidate ?? false,
      has_account_playbook: pipeline?.has_account_playbook ?? false,
    }

    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: companyId,
    })

    const enriched = await enrichApollo25CompanyPilotSelectionInputWithIntelligence(
      admin,
      baseInput,
      resolution.canonical_company_id,
    )
    inputs.push({
      ...enriched,
      canonical_company_id: resolution.canonical_company_id?.trim() || null,
    })
  }

  return inputs
}

export async function loadApollo25CompanyPilotEligibilityDiagnosticReport(
  admin: SupabaseClient,
  input?: { pilot_selection_mode?: Apollo25CompanyPilotSelectionMode },
) {
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const pilot_selection_mode = input?.pilot_selection_mode ?? "greenfield"
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)

  return buildApollo25CompanyPilotEligibilityDiagnostic(selection_inputs, {
    production_threshold,
    pilot_selection_mode,
    target_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
  })
}

export async function loadApollo25CompanyPilotLaunchReport(
  admin: SupabaseClient,
  input?: {
    create_cohort?: boolean
    cohort_name?: string
    created_by?: string
    created_by_email?: string
    pilot_selection_mode?: Apollo25CompanyPilotSelectionMode
  },
) {
  const migrationProbe = await admin.schema("growth").from(COHORTS_TABLE).select("id").limit(1)
  const migration_present = !migrationProbe.error

  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const pilot_selection_mode = input?.pilot_selection_mode ?? "greenfield"
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)

  let cohort_creation: {
    cohort_id: string | null
    cohort_name: string | null
    status: string | null
    company_count: number
    created: boolean
  } = {
    cohort_id: null,
    cohort_name: null,
    status: null,
    company_count: 0,
    created: false,
  }

  let cohort_status: "draft" | "active" | "paused" | "completed" | "cancelled" | null = null

  const preview = buildApollo25CompanyPilotLaunchReport({
    selection_inputs,
    production_threshold,
    pilot_selection_mode,
    migration_present,
    cohort_status: null,
    env_gates_ok: resolveApollo25CompanyPilotEnvGatesOk(),
  })

  if (input?.create_cohort && migration_present) {
    const snapshot = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
      selection_inputs,
      production_threshold,
      target_size: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
    })

    if (snapshot.cohort_size > 0) {
    const cohortName =
      input.cohort_name?.trim() ||
      `Apollo 25-Company Pilot ${new Date().toISOString().slice(0, 10)}`

    const created = await createApolloPilotCohort(admin, {
      cohort_name: cohortName,
      target_company_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
      created_by: input.created_by ?? "system",
      created_by_email: input.created_by_email ?? "system@equipify.internal",
      companies: snapshot.companies.map((row) => ({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        qualification_status: `score_${row.qualification_score}`,
        sequence_ready_count: row.sequence_ready_count,
        enrollment_candidate_count: row.verified_email_count,
        metadata: {
          snapshot_v14_2f: row,
          cohort_rank: row.cohort_rank,
          cohort_reason: row.cohort_reason,
          snapshot_id: snapshot.snapshot_id,
        },
      })),
      metadata: {
        qa_marker: preview.qa_marker,
        pilot_launch_certification: true,
        pilot_selection_mode: "greenfield",
        draft_cohort_snapshot_v14_2f: snapshot,
        snapshot_id: snapshot.snapshot_id,
        snapshot_immutable: true,
        no_auto_outreach: true,
        no_duplicate_enrollment: true,
      },
    })

    cohort_creation = {
      cohort_id: created.cohort.id,
      cohort_name: created.cohort.cohort_name,
      status: created.cohort.status,
      company_count: created.companies.length,
      created: true,
    }
    cohort_status = created.cohort.status
    }
  }

  const report = buildApollo25CompanyPilotLaunchReport({
    selection_inputs,
    production_threshold,
    pilot_selection_mode,
    migration_present,
    cohort_status,
    cohort_creation,
    env_gates_ok: resolveApollo25CompanyPilotEnvGatesOk(),
    operator_assigned: false,
  })

  return report
}

async function loadApollo25CompanyPilotPersonalizationMaterializationByCompany(
  admin: SupabaseClient,
  companyIds: string[],
  enrollmentState: Record<string, { growth_lead_id: string | null }>,
): Promise<Record<string, Apollo25CompanyPilotPersonalizationMaterializationState>> {
  const map: Record<string, Apollo25CompanyPilotPersonalizationMaterializationState> = {}
  for (const companyId of companyIds) {
    map[companyId] = {
      has_account_playbook: false,
      has_personalization_generation: false,
      execution_drafts: [],
      has_voice_drop_candidate: false,
    }
  }
  if (companyIds.length === 0) return map

  const leadIds = [
    ...new Set(
      companyIds
        .map((companyId) => enrollmentState[companyId]?.growth_lead_id)
        .filter((leadId): leadId is string => Boolean(leadId)),
    ),
  ]

  const [playbookRes, executionRes, voiceDropRes, personalizationRes] = await Promise.all([
    admin
      .schema("growth")
      .from("account_playbooks")
      .select("company_candidate_id")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_voice_drop_candidates")
      .select("company_candidate_id")
      .in("company_candidate_id", companyIds),
    leadIds.length > 0
      ? admin
          .schema("growth")
          .from("personalization_generations")
          .select("lead_id")
          .in("lead_id", leadIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (playbookRes.error) throw new Error(playbookRes.error.message)
  if (executionRes.error) throw new Error(executionRes.error.message)
  if (voiceDropRes.error) throw new Error(voiceDropRes.error.message)
  if (personalizationRes.error) throw new Error(personalizationRes.error.message)

  for (const row of playbookRes.data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_candidate_id)
    if (companyId && map[companyId]) map[companyId].has_account_playbook = true
  }

  for (const row of voiceDropRes.data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_candidate_id)
    if (companyId && map[companyId]) map[companyId].has_voice_drop_candidate = true
  }

  const leadsWithPersonalization = new Set<string>()
  for (const row of personalizationRes.data ?? []) {
    const leadId = asString((row as Record<string, unknown>).lead_id)
    if (leadId) leadsWithPersonalization.add(leadId)
  }

  for (const companyId of companyIds) {
    const leadId = enrollmentState[companyId]?.growth_lead_id
    if (leadId && leadsWithPersonalization.has(leadId)) {
      map[companyId].has_personalization_generation = true
    }
  }

  for (const row of executionRes.data ?? []) {
    const candidate = mapApolloSequenceExecutionCandidateDbRow(row as Record<string, unknown>)
    const companyId = candidate.company_candidate_id?.trim()
    if (!companyId || !map[companyId]) continue
    map[companyId].execution_drafts = candidate.materialization.drafts
  }

  return map
}

async function loadLatestDraftApollo25CompanyPilotCohortId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from(COHORTS_TABLE)
    .select("id, metadata")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const metadata = (row as Record<string, unknown>).metadata as Record<string, unknown> | undefined
    if (parseApollo25CompanyPilotCohortSnapshotFromMetadata(metadata)) {
      return asString((row as Record<string, unknown>).id) || null
    }
  }

  return null
}

export async function loadApollo25CompanyPilotCohortReview(
  admin: SupabaseClient,
  input?: { cohort_id?: string; preview?: boolean },
) {
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const companyIds = selection_inputs.map((row) => row.company_candidate_id)
  const enrollmentState = await loadEnrollmentStateByCompany(admin, companyIds)
  const materialization_by_company = await loadApollo25CompanyPilotPersonalizationMaterializationByCompany(
    admin,
    companyIds,
    enrollmentState,
  )

  let cohort_id: string | null = null
  let cohort_name: string | null = null
  let cohort_status: string | null = null
  let snapshot: ReturnType<typeof buildApollo25CompanyPilotGreenfieldCohortSnapshot> | null = null

  const requestedCohortId = input?.cohort_id?.trim()
  if (requestedCohortId) {
    cohort_id = requestedCohortId
  } else if (!input?.preview) {
    cohort_id = await loadLatestDraftApollo25CompanyPilotCohortId(admin)
  }

  if (cohort_id) {
    const loaded = await loadApolloPilotCohort(admin, cohort_id)
    if (!loaded) throw new Error("cohort_not_found")

    cohort_name = loaded.cohort.cohort_name
    cohort_status = loaded.cohort.status
    const parsedSnapshot = parseApollo25CompanyPilotCohortSnapshotFromMetadata(loaded.cohort.metadata)
    if (parsedSnapshot) {
      snapshot = parsedSnapshot
    } else {
      const companies = snapshotCompaniesFromCohortCompanyRows(loaded.companies)
      if (companies.length === 0) {
        throw new Error("cohort_snapshot_missing")
      }
      snapshot = {
        qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
        snapshot_id: asString(loaded.cohort.metadata.snapshot_id) || "restored-from-company-rows",
        generated_at: loaded.cohort.created_at,
        pilot_selection_mode: "greenfield",
        target_size: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
        cohort_size: companies.length,
        production_qualification_threshold: production_threshold,
        immutable: true,
        companies,
      }
    }
  }

  return buildApollo25CompanyPilotCohortReview({
    selection_inputs,
    production_threshold,
    target_size: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
    snapshot,
    cohort_id,
    cohort_name,
    cohort_status,
    materialization_by_company,
  })
}

export async function createApollo25CompanyPilotDraftCohort(
  admin: SupabaseClient,
  input: {
    cohort_name?: string
    created_by: string
    created_by_email: string
  },
) {
  const migrationProbe = await admin.schema("growth").from(COHORTS_TABLE).select("id").limit(1)
  if (migrationProbe.error) throw new Error("apollo_pilot_cohorts_table_unavailable")

  const report = await loadApollo25CompanyPilotLaunchReport(admin, {
    create_cohort: true,
    cohort_name: input.cohort_name,
    created_by: input.created_by,
    created_by_email: input.created_by_email,
    pilot_selection_mode: "greenfield",
  })

  const review = await loadApollo25CompanyPilotCohortReview(admin, {
    cohort_id: report.cohort_creation.cohort_id ?? undefined,
  })

  return { report, review }
}

export { parsePilotSelectionMode }
