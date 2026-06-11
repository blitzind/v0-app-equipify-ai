/** Apollo 25-company pilot launch — server-only route handlers. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { summarizeApolloOperatorReviewForQualification } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentCandidateStatus } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { resolveApolloEnrollmentQualificationThreshold } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { buildApollo25CompanyPilotLaunchReport, resolveApollo25CompanyPilotEnvGatesOk } from "@/lib/growth/apollo/apollo-25-company-pilot-launch-report"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import { createApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import { APOLLO_25_COMPANY_PILOT_TARGET_COUNT } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

const COHORTS_TABLE = "apollo_pilot_cohorts"
const COMPANIES_TABLE = "apollo_pilot_cohort_companies"
const ENROLLMENT_TABLE = "apollo_enrollment_candidates"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
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

async function loadEnrollmentCompanyPool(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("company_candidate_id")

  if (error) throw new Error(error.message)

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = asString((row as Record<string, unknown>).company_candidate_id)
    if (id) ids.add(id)
  }
  return [...ids]
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
  const pool = options?.company_ids ?? await loadEnrollmentCompanyPool(admin)
  const activePilotIds = await loadActivePilotCompanyIds(admin)
  const enrollmentState = await loadEnrollmentStateByCompany(admin, pool)
  const leadIds = [...new Set(Object.values(enrollmentState).map((row) => row.growth_lead_id).filter(Boolean) as string[])]
  const activeLeadIds = await loadActiveEnrollmentLeadIds(admin, leadIds)

  const inputs: Apollo25CompanyPilotSelectionInput[] = []

  for (const companyId of pool) {
    const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, companyId)
    if (!snapshot) continue

    const enrollment = enrollmentState[companyId]
    const hasActive =
      enrollment?.growth_lead_id ? activeLeadIds.has(enrollment.growth_lead_id) : false

    inputs.push({
      company_candidate_id: companyId,
      company_name: snapshot.company_name,
      domain: null,
      contacts: snapshot.contacts,
      snapshot_summary: summarizeApolloOperatorReviewForQualification(snapshot),
      enrollment_status: enrollment?.status ?? null,
      has_active_sequence_enrollment: hasActive,
      in_active_pilot_cohort: activePilotIds.has(companyId),
      company_intelligence_present: true,
      buying_committee_present: false,
    })
  }

  return inputs
}

export async function loadApollo25CompanyPilotLaunchReport(
  admin: SupabaseClient,
  input?: {
    create_cohort?: boolean
    cohort_name?: string
    created_by?: string
    created_by_email?: string
  },
) {
  const migrationProbe = await admin.schema("growth").from(COHORTS_TABLE).select("id").limit(1)
  const migration_present = !migrationProbe.error

  const production_threshold = resolveApolloEnrollmentQualificationThreshold()
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
    migration_present,
    cohort_status: null,
    env_gates_ok: resolveApollo25CompanyPilotEnvGatesOk(),
  })

  if (input?.create_cohort && migration_present && preview.selection.selected_count > 0) {
    const cohortName =
      input.cohort_name?.trim() ||
      `Apollo 25-Company Pilot ${new Date().toISOString().slice(0, 10)}`

    const created = await createApolloPilotCohort(admin, {
      cohort_name: cohortName,
      target_company_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
      created_by: input.created_by ?? "system",
      created_by_email: input.created_by_email ?? "system@equipify.internal",
      companies: preview.selection.selected.map((row) => ({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
      })),
      metadata: {
        qa_marker: preview.qa_marker,
        pilot_launch_certification: true,
        no_auto_outreach: true,
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

  const report = buildApollo25CompanyPilotLaunchReport({
    selection_inputs,
    production_threshold,
    migration_present,
    cohort_status,
    cohort_creation,
    env_gates_ok: resolveApollo25CompanyPilotEnvGatesOk(),
    operator_assigned: false,
  })

  return report
}
