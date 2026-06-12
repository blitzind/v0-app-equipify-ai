/** Apollo 25-company pilot — cohort enrollment bridge (Phase 14.2J). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { handoffEnrollmentApprovedToAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-bridge"
import type { ApolloAccountPlaybookEnrollmentHandoffInput } from "@/lib/growth/apollo/apollo-account-playbooks-types"
import { mapApolloEnrollmentCandidateDbRow } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentCandidateRow } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { approveApolloEnrollmentCandidate } from "@/lib/growth/apollo/apollo-enrollment-candidate-queue"
import {
  ensureApollo25CompanyPilotCanonicalUniqueSnapshot,
  parseApollo25CompanyPilotCohortSnapshotFromMetadata,
  snapshotCompaniesFromCohortCompanyRows,
} from "@/lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import {
  buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-readiness"
import { buildApollo25CompanyPilotCohortReview } from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-review"
import {
  analyzeApollo25CompanyPilotCompanyEligibility,
  type Apollo25CompanyPilotSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import {
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome,
  snapshotCompanyQualificationPassesThreshold,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-evidence"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_SOURCE,
  type Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult,
  type Apollo25CompanyPilotCohortEnrollmentBridgeFailure,
  type Apollo25CompanyPilotCohortEnrollmentBridgeReport,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-types"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
  type Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import {
  describeEnrollmentDuplicatePreventionDecision,
  pickEnrollmentCandidateIdFromAutomationReport,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import {
  executeApolloFullPipelineCertificationEnrollment,
  findReusableApolloEnrollmentCandidate,
  mapReusableEnrollmentCandidateId,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution"
import {
  resolveApolloEnrollmentQualificationThreshold,
  resolveApolloFullPipelineCertificationQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { loadApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"

export {
  APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_SOURCE,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-types"
export {
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome,
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeSuccess,
  snapshotCompanyQualificationPassesThreshold,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-evidence"

const ENROLLMENT_TABLE = "apollo_enrollment_candidates"
const PLAYBOOKS_TABLE = "account_playbooks"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildPlaybookHandoffInput(
  enrollment: ApolloEnrollmentCandidateRow,
  canonical_company_id: string | null,
): ApolloAccountPlaybookEnrollmentHandoffInput {
  return {
    enrollment_candidate_id: enrollment.candidate_id,
    company_candidate_id: enrollment.company_candidate_id,
    canonical_company_id,
    company_contact_id: enrollment.company_contact_id,
    contact_candidate_id: enrollment.contact_candidate_id,
    growth_lead_id: enrollment.growth_lead_id,
    company_name: enrollment.company_name,
    full_name: enrollment.full_name,
    title: enrollment.title,
    email: enrollment.email,
    phone: enrollment.phone,
    qualification_score: enrollment.qualification_score,
    fit_score: enrollment.fit_score,
    research_score: enrollment.research_score,
    operator_intelligence: enrollment.operator_intelligence as unknown as Record<string, unknown>,
    source_attribution: enrollment.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence: enrollment.acquisition_evidence,
  }
}

async function findApprovedEnrollmentCandidateForCompany(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("*")
    .eq("company_candidate_id", company_candidate_id)
    .eq("status", "enrollment_approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as Record<string, unknown>) : null
}

async function ensureAccountPlaybookHandoffForApprovedEnrollment(
  admin: SupabaseClient,
  input: {
    enrollment: ApolloEnrollmentCandidateRow
    snapshot_company: Apollo25CompanyPilotCohortSnapshotCompany
  },
): Promise<{ ok: boolean; error: string | null }> {
  const { data: existingPlaybook } = await admin
    .schema("growth")
    .from(PLAYBOOKS_TABLE)
    .select("id")
    .eq("enrollment_candidate_id", input.enrollment.candidate_id)
    .limit(1)
    .maybeSingle()

  if (existingPlaybook) return { ok: true, error: null }

  const canonicalResolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: input.enrollment.company_candidate_id,
  })
  const canonical_company_id =
    input.snapshot_company.canonical_company_id?.trim() ||
    canonicalResolution.canonical_company_id?.trim() ||
    null

  const handoff = await handoffEnrollmentApprovedToAccountPlaybook(
    admin,
    buildPlaybookHandoffInput(input.enrollment, canonical_company_id),
  )

  if (!handoff.ok) {
    return { ok: false, error: handoff.error ?? "account_playbook_handoff_failed" }
  }

  return { ok: true, error: null }
}

async function enrollApollo25CompanyPilotCohortCompany(
  admin: SupabaseClient,
  input: {
    snapshot_company: Apollo25CompanyPilotCohortSnapshotCompany
    selection_input: Apollo25CompanyPilotSelectionInput | null
    production_threshold: number
    certification_threshold: number
    cohort_id: string
    execution_id: string
    acting_user_id: string
    acting_user_email: string
    company_ids_in_other_active_pilot_cohorts: Set<string>
  },
): Promise<Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult | Apollo25CompanyPilotCohortEnrollmentBridgeFailure> {
  const company_candidate_id = input.snapshot_company.company_candidate_id
  const company_name = input.snapshot_company.company_name

  if (!input.selection_input) {
    return {
      company_candidate_id,
      company_name,
      code: "selection_input_missing",
      message: "Cohort company not found in current pilot selection inputs.",
    }
  }

  if (!snapshotCompanyQualificationPassesThreshold(input.snapshot_company, input.production_threshold)) {
    return {
      company_candidate_id,
      company_name,
      code: "qualification_below_threshold",
      message: `Snapshot qualification score ${input.snapshot_company.qualification_score} is below production threshold ${input.production_threshold}.`,
    }
  }

  let created = false
  let reused = false
  let enrollmentCandidateId: string | null = null
  let contact: Apollo25CompanyPilotSelectionInput["contacts"][number] | null = null

  const approvedRowEarly = await findApprovedEnrollmentCandidateForCompany(admin, company_candidate_id)
  if (approvedRowEarly) {
    enrollmentCandidateId = mapReusableEnrollmentCandidateId(approvedRowEarly)
    reused = true
  }

  if (!enrollmentCandidateId) {
    const selectionInputForEnrollment = buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput(
      input.selection_input,
      {
        company_candidate_id,
        company_ids_in_other_active_pilot_cohorts: input.company_ids_in_other_active_pilot_cohorts,
      },
    )

    const analysis = analyzeApollo25CompanyPilotCompanyEligibility(
      selectionInputForEnrollment,
      input.production_threshold,
      "greenfield",
    )

    if (!analysis.eligible || !analysis.contact) {
      if (analysis.skip_reason === "already_enrollment_approved") {
        const approvedRow = await findApprovedEnrollmentCandidateForCompany(admin, company_candidate_id)
        if (approvedRow) {
          enrollmentCandidateId = mapReusableEnrollmentCandidateId(approvedRow)
          reused = true
        }
      }

      if (!enrollmentCandidateId) {
        return {
          company_candidate_id,
          company_name,
          code: analysis.skip_reason ?? "contact_resolution_failed",
          message: analysis.raw_reason ?? "No eligible sequence-ready contact for enrollment.",
        }
      }
    } else {
      contact = analysis.contact

      const reusableBeforeAutomation = await findReusableApolloEnrollmentCandidate(admin, {
        company_candidate_id,
        company_contact_id: contact.company_contact_id,
        contact_candidate_id: contact.contact_candidate_id,
      })

      if (reusableBeforeAutomation) {
        enrollmentCandidateId = mapReusableEnrollmentCandidateId(reusableBeforeAutomation.row)
        reused = true
      }
    }
  }

  if (!enrollmentCandidateId && contact) {
    try {
      const automationReport = await executeApolloFullPipelineCertificationEnrollment(admin, {
        execution_id: input.execution_id,
        company_candidate_id,
        selected_contact: contact,
        threshold_used: input.production_threshold,
        threshold_source: "production",
        production_threshold: input.production_threshold,
        certification_threshold: input.certification_threshold,
        actor_user_id: input.acting_user_id,
        actor_email: input.acting_user_email,
        certification_source: APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_SOURCE,
        audit_reason: `pilot-cohort-enroll:${input.cohort_id}`,
      })

      enrollmentCandidateId =
        pickEnrollmentCandidateIdFromAutomationReport(automationReport, {
          company_contact_id: contact.company_contact_id,
          contact_candidate_id: contact.contact_candidate_id,
        }) ?? null

      if (!enrollmentCandidateId) {
        const postAutomationReuse = await findReusableApolloEnrollmentCandidate(admin, {
          company_candidate_id,
          company_contact_id: contact.company_contact_id,
          contact_candidate_id: contact.contact_candidate_id,
        })
        if (postAutomationReuse) {
          enrollmentCandidateId = mapReusableEnrollmentCandidateId(postAutomationReuse.row)
          reused = true
        } else {
          const approvedAfterAutomation = await findApprovedEnrollmentCandidateForCompany(
            admin,
            company_candidate_id,
          )
          if (approvedAfterAutomation) {
            enrollmentCandidateId = mapReusableEnrollmentCandidateId(approvedAfterAutomation)
            reused = true
          } else {
            const message =
              automationReport.blockers.length > 0
                ? automationReport.blockers.join(" | ")
                : "Enrollment automation did not create or reuse a candidate."
            return {
              company_candidate_id,
              company_name,
              code: "enrollment_candidate_not_created",
              message,
              contact_company_contact_id: contact.company_contact_id ?? null,
              contact_candidate_id: contact.contact_candidate_id ?? null,
              automation_blockers: automationReport.blockers,
            }
          }
        }
      } else if (automationReport.candidates_created > 0) {
        created = true
      } else if (describeEnrollmentDuplicatePreventionDecision(automationReport)) {
        reused = true
      }
    } catch (error) {
      return {
        company_candidate_id,
        company_name,
        code: "enrollment_automation_failed",
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (!enrollmentCandidateId) {
    return {
      company_candidate_id,
      company_name,
      code: "enrollment_candidate_not_created",
      message: "No enrollment candidate resolved for cohort company.",
    }
  }

  const { data: enrollmentRow, error: enrollmentError } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("*")
    .eq("id", enrollmentCandidateId)
    .maybeSingle()

  if (enrollmentError) {
    return {
      company_candidate_id,
      company_name,
      code: "enrollment_candidate_load_failed",
      message: enrollmentError.message,
    }
  }

  if (!enrollmentRow) {
    return {
      company_candidate_id,
      company_name,
      code: "enrollment_candidate_not_found",
      message: `Enrollment candidate ${enrollmentCandidateId} missing after automation.`,
    }
  }

  const enrollment = mapApolloEnrollmentCandidateDbRow(enrollmentRow as Record<string, unknown>)
  let approved = false

  if (enrollment.status === "pending_enrollment_approval") {
    const approveResult = await approveApolloEnrollmentCandidate(admin, {
      candidate_id: enrollment.candidate_id,
      approver_user_id: input.acting_user_id,
      approver_email: input.acting_user_email,
      note: `pilot-cohort-enroll:${input.cohort_id}`,
    })

    if (!approveResult.ok) {
      return {
        company_candidate_id,
        company_name,
        code: "enrollment_approval_failed",
        message: approveResult.error ?? "Enrollment approval failed.",
      }
    }

    approved = true
  } else if (enrollment.status === "enrollment_approved") {
    const handoff = await ensureAccountPlaybookHandoffForApprovedEnrollment(admin, {
      enrollment,
      snapshot_company: input.snapshot_company,
    })
    if (!handoff.ok) {
      return {
        company_candidate_id,
        company_name,
        code: "account_playbook_handoff_failed",
        message: handoff.error ?? "Account playbook handoff failed.",
      }
    }
    approved = true
  } else {
    return {
      company_candidate_id,
      company_name,
      code: "enrollment_not_approvable",
      message: `Enrollment candidate in unexpected status: ${enrollment.status}.`,
    }
  }

  const { data: refreshedEnrollmentRow } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("growth_lead_id")
    .eq("id", enrollment.candidate_id)
    .maybeSingle()

  const growth_lead_id = asString((refreshedEnrollmentRow as Record<string, unknown> | null)?.growth_lead_id) || null

  return {
    company_candidate_id,
    company_name,
    enrollment_candidate_id: enrollment.candidate_id,
    growth_lead_id,
    created,
    reused,
    approved,
    treated_as: created ? "created_approved" : reused ? "reused_approved" : undefined,
  }
}

export async function enrollApollo25CompanyPilotCohortCompanies(
  admin: SupabaseClient,
  input: {
    cohort_id: string
    acting_user_id: string
    acting_user_email: string
  },
): Promise<Apollo25CompanyPilotCohortEnrollmentBridgeReport> {
  const loaded = await loadApolloPilotCohort(admin, input.cohort_id)
  if (!loaded) throw new Error("cohort_not_found")

  const rawSnapshot =
    parseApollo25CompanyPilotCohortSnapshotFromMetadata(loaded.cohort.metadata) ??
    (() => {
      const companies = snapshotCompaniesFromCohortCompanyRows(loaded.companies)
      if (companies.length === 0) throw new Error("cohort_snapshot_missing")
      return {
        qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
        snapshot_id: asString(loaded.cohort.metadata.snapshot_id) || input.cohort_id,
        generated_at: loaded.cohort.created_at,
        pilot_selection_mode: "greenfield" as const,
        target_size: loaded.cohort.target_company_count,
        cohort_size: companies.length,
        production_qualification_threshold: 70,
        immutable: true as const,
        companies,
      }
    })()

  const snapshot = ensureApollo25CompanyPilotCanonicalUniqueSnapshot(rawSnapshot)
  const execution_id = randomUUID()
  const production_threshold =
    snapshot.production_qualification_threshold ?? resolveApolloEnrollmentQualificationThreshold()
  const certification_threshold = resolveApolloFullPipelineCertificationQualificationThreshold()

  logGrowthEngine("apollo_25_pilot_cohort_enrollment_bridge_started", {
    cohort_id: input.cohort_id,
    execution_id,
    cohort_size: snapshot.cohort_size,
  })

  const { buildApollo25CompanyPilotSelectionInputs, loadCompanyIdsInOtherActivePilotCohorts } =
    await import("@/lib/growth/apollo/apollo-25-company-pilot-route")
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const company_ids_in_other_active_pilot_cohorts = await loadCompanyIdsInOtherActivePilotCohorts(
    admin,
    input.cohort_id,
  )
  const selectionByCompany = new Map(
    selection_inputs.map((row) => [row.company_candidate_id, row]),
  )

  const failures: Apollo25CompanyPilotCohortEnrollmentBridgeFailure[] = []
  const companies: Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult[] = []
  let enrollment_candidates_created = 0
  let enrollment_candidates_reused = 0
  let enrollment_candidates_approved = 0

  for (const snapshotCompany of snapshot.companies) {
    const result = await enrollApollo25CompanyPilotCohortCompany(admin, {
      snapshot_company: snapshotCompany,
      selection_input: selectionByCompany.get(snapshotCompany.company_candidate_id) ?? null,
      production_threshold,
      certification_threshold,
      cohort_id: input.cohort_id,
      execution_id,
      acting_user_id: input.acting_user_id,
      acting_user_email: input.acting_user_email,
      company_ids_in_other_active_pilot_cohorts,
    })

    if ("code" in result) {
      failures.push(result)
      continue
    }

    companies.push(result)
    if (result.created) enrollment_candidates_created += 1
    if (result.reused) enrollment_candidates_reused += 1
    if (result.approved) enrollment_candidates_approved += 1
  }

  const review = buildApollo25CompanyPilotCohortReview({
    selection_inputs,
    snapshot,
    cohort_id: input.cohort_id,
    cohort_name: loaded.cohort.cohort_name,
    cohort_status: loaded.cohort.status,
  })

  const companies_processed = snapshot.companies.length
  const now = new Date().toISOString()

  const reportBody = {
    qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_QA_MARKER,
    cohort_id: input.cohort_id,
    execution_id,
    companies_processed,
    enrollment_candidates_created,
    enrollment_candidates_reused,
    enrollment_candidates_approved,
    failures,
    companies,
    review,
    no_outbound_sends: true as const,
    no_sequence_execution: true as const,
  }

  const { ok, partial_success } = evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome({
    companies_processed,
    companies,
    failures,
    enrollment_candidates_approved,
  })

  const { error: metadataError } = await admin
    .schema("growth")
    .from("apollo_pilot_cohorts")
    .update({
      updated_at: now,
      metadata: {
        ...loaded.cohort.metadata,
        canonical_cohort_dedupe_v14_2g_1: snapshot.canonical_dedupe ?? null,
        pilot_cohort_enrollment_v14_2j: {
          execution_id,
          executed_at: now,
          companies_processed,
          enrollment_candidates_created,
          enrollment_candidates_reused,
          enrollment_candidates_approved,
          enrollment_readiness_pct: review.enrollment_readiness.readiness_pct,
          failure_count: failures.length,
          failures,
          ok,
          partial_success,
        },
      },
    })
    .eq("id", input.cohort_id)

  if (metadataError) {
    throw new Error(`cohort_enrollment_metadata_update_failed:${metadataError.message}`)
  }

  logGrowthEngine("apollo_25_pilot_cohort_enrollment_bridge_completed", {
    cohort_id: input.cohort_id,
    execution_id,
    companies_processed,
    enrollment_candidates_created,
    enrollment_candidates_reused,
    enrollment_candidates_approved,
    failure_count: failures.length,
    enrollment_readiness_pct: review.enrollment_readiness.readiness_pct,
    ok,
    partial_success,
  })

  return {
    ...reportBody,
    ok,
    partial_success,
  }
}
