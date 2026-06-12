/** Apollo Full Pipeline — enrollment candidate resolution + failure evidence. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapApolloEnrollmentCandidateDbRow,
  summarizeApolloOperatorReviewForQualification,
} from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentAutomationReport } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import type { ApolloFullPipelineEnrollmentEvidence } from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { runApolloEnrollmentAutomation } from "@/lib/growth/apollo/apollo-enrollment-auto-enrollment"
import { buildApolloFullPipelineDbErrorEvidence } from "@/lib/growth/apollo/apollo-full-pipeline-db-error-evidence"
import {
  describeEnrollmentDuplicatePreventionDecision,
  isCertificationEligibleSequenceReadyContact,
  selectSequenceReadyContactForCertification,
  type ApolloFullPipelineCertificationScoredContact,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import {
  evaluateApolloEnrollmentQualification,
  resolveApolloEnrollmentQualificationThreshold,
  resolveApolloFullPipelineCertificationQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import { buildApolloEnrollmentQualificationInputFromScoringContext } from "@/lib/growth/apollo/apollo-qualification-scoring-context-helpers"
import { loadApolloQualificationScoringContextForCompany } from "@/lib/growth/apollo/apollo-qualification-scoring-context"

const CANDIDATES_TABLE = "apollo_enrollment_candidates"
const REUSABLE_STATUSES = ["pending_enrollment_approval", "enrollment_approved"] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function findEnrollmentCandidateByContactIds(
  admin: SupabaseClient,
  input: {
    company_contact_id: string | null
    contact_candidate_id: string | null
    statuses?: readonly string[]
  },
): Promise<Record<string, unknown> | null> {
  const statuses = input.statuses ?? REUSABLE_STATUSES

  if (input.company_contact_id) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("company_contact_id", input.company_contact_id)
      .in("status", [...statuses])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  if (input.contact_candidate_id) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("contact_candidate_id", input.contact_candidate_id)
      .in("status", [...statuses])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  return null
}

export async function findReusableApolloEnrollmentCandidate(
  admin: SupabaseClient,
  input: {
    enrollment_candidate_id?: string | null
    company_candidate_id: string
    company_contact_id?: string | null
    contact_candidate_id?: string | null
  },
): Promise<{
  row: Record<string, unknown>
  reuse_reason:
    | "explicit_id"
    | "contact_pending_or_approved"
    | "company_candidate_pending"
} | null> {
  const explicitId = input.enrollment_candidate_id?.trim() || null
  if (explicitId) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("id", explicitId)
      .in("status", [...REUSABLE_STATUSES])
      .maybeSingle()
    if (data) {
      return { row: data as Record<string, unknown>, reuse_reason: "explicit_id" }
    }
  }

  const byContact = await findEnrollmentCandidateByContactIds(admin, {
    company_contact_id: input.company_contact_id ?? null,
    contact_candidate_id: input.contact_candidate_id ?? null,
  })
  if (byContact) {
    return { row: byContact, reuse_reason: "contact_pending_or_approved" }
  }

  const { data: byCompanyPending } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("status", "pending_enrollment_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byCompanyPending) {
    return {
      row: byCompanyPending as Record<string, unknown>,
      reuse_reason: "company_candidate_pending",
    }
  }

  const { data: byCompanyApproved } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("status", "enrollment_approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byCompanyApproved) {
    return {
      row: byCompanyApproved as Record<string, unknown>,
      reuse_reason: "contact_pending_or_approved",
    }
  }

  return null
}

export async function scoreSequenceReadyContactsForCertification(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    contacts: ApolloPrimaryContactOperatorReviewRow[]
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloFullPipelineCertificationScoredContact[]> {
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  if (!snapshot) return []

  const summary = summarizeApolloOperatorReviewForQualification(snapshot)
  const scoringContext = await loadApolloQualificationScoringContextForCompany(admin, {
    company_candidate_id: input.company_candidate_id,
    canonical_company_id: snapshot.canonical_company_id,
  })

  const scored: ApolloFullPipelineCertificationScoredContact[] = []
  for (const contact of input.contacts.filter((row) => isCertificationEligibleSequenceReadyContact(row))) {
    const qualification = evaluateApolloEnrollmentQualification(
      buildApolloEnrollmentQualificationInputFromScoringContext({
        snapshot_summary: summary,
        contact,
        context: scoringContext,
        verified_email_source: "apollo_search_verified_email",
        enrichment_source: "apollo_enrollment_cert",
      }),
      { threshold: resolveApolloEnrollmentQualificationThreshold(input.env) },
    )
    scored.push({
      contact,
      qualification_score: qualification.qualification_score,
    })
  }

  return scored
}

export async function executeApolloFullPipelineCertificationEnrollment(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_candidate_id: string
    selected_contact: ApolloPrimaryContactOperatorReviewRow
    threshold_used: number
    threshold_source: "production" | "certification_override"
    production_threshold: number
    certification_threshold: number
    actor_user_id?: string | null
    actor_email?: string | null
    certification_source?: string | null
    audit_reason?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrollmentAutomationReport> {
  return runApolloEnrollmentAutomation(admin, {
    execution_id: input.execution_id,
    company_candidate_id: input.company_candidate_id,
    created_by: input.actor_user_id ?? null,
    env: input.env,
    qualification_threshold_override: input.threshold_used,
    production_qualification_threshold: input.production_threshold,
    certification_qualification_threshold: input.certification_threshold,
    qualification_threshold_source: input.threshold_source,
    certification_source: input.certification_source ?? null,
    created_by_source: input.certification_source ?? null,
    execution_source: input.certification_source ?? null,
    audit_reason: input.audit_reason ?? null,
    target_company_contact_id: input.selected_contact.company_contact_id,
    target_contact_candidate_id: input.selected_contact.contact_candidate_id,
  })
}

export async function buildApolloFullPipelineEnrollmentEvidence(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    sequence_ready_contact: ApolloPrimaryContactOperatorReviewRow | null
    automation_report?: ApolloEnrollmentAutomationReport | null
    automation_message?: string | null
    existing_enrollment_candidate_id?: string | null
    existing_enrollment_candidate_status?: string | null
    duplicate_prevention_decision?: string | null
    insert_error?: string | null
    qualification_score?: number | null
    qualification_threshold?: number | null
    qualification_threshold_source?: ApolloFullPipelineEnrollmentEvidence["qualification_threshold_source"]
    production_threshold?: number | null
    certification_threshold?: number | null
    qualification_override_used?: boolean
    certification_source?: string | null
    db_error_table?: string | null
    db_error_operation?: string | null
    db_error_message?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloFullPipelineEnrollmentEvidence> {
  const contact = input.sequence_ready_contact
  const production_threshold =
    input.production_threshold ?? resolveApolloEnrollmentQualificationThreshold(input.env)
  const certification_threshold =
    input.certification_threshold ??
    resolveApolloFullPipelineCertificationQualificationThreshold(input.env)
  const threshold = input.qualification_threshold ?? production_threshold
  const qualification_blockers: string[] = []

  let qualification_score: number | null = input.qualification_score ?? null

  if (contact) {
    if (qualification_score == null) {
      const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
      if (snapshot) {
        const summary = summarizeApolloOperatorReviewForQualification(snapshot)
        const scoringContext = await loadApolloQualificationScoringContextForCompany(admin, {
          company_candidate_id: input.company_candidate_id,
          canonical_company_id: snapshot.canonical_company_id,
        })

        const qualification = evaluateApolloEnrollmentQualification(
          buildApolloEnrollmentQualificationInputFromScoringContext({
            snapshot_summary: summary,
            contact,
            context: scoringContext,
            verified_email_source: "apollo_search_verified_email",
            enrichment_source: "apollo_enrollment_cert",
          }),
          { threshold: production_threshold },
        )

        qualification_score = qualification.qualification_score
        if (
          qualification_score < production_threshold &&
          (input.qualification_override_used ||
            (qualification_score >= certification_threshold &&
              input.qualification_threshold_source === "certification_override"))
        ) {
          // Certification override path — production threshold miss is expected.
        } else if (!qualification.qualified_for_enrollment) {
          qualification_blockers.push(qualification.qualification_reason)
        }
      }
    } else if (
      qualification_score < production_threshold &&
      !(input.qualification_override_used || qualification_score >= certification_threshold)
    ) {
      qualification_blockers.push(
        `Qualification score ${qualification_score} below production threshold ${production_threshold}.`,
      )
    }

    if (!contact.contactable) {
      qualification_blockers.push("Contact is not contactable (missing email/phone or blocked).")
    }
    if (contact.blockers.length > 0) {
      qualification_blockers.push(`Contact blockers: ${contact.blockers.join(", ")}.`)
    }
  } else {
    qualification_blockers.push("No sequence-ready contact available for enrollment.")
  }

  if (input.automation_report?.blockers.length) {
    for (const blocker of input.automation_report.blockers) {
      if (!qualification_blockers.includes(blocker)) qualification_blockers.push(blocker)
    }
  }

  const rawInsertError =
    input.insert_error ??
    input.automation_report?.blockers.find((blocker) =>
      /insert|duplicate key|violates|candidate_insert_failed|invalid input syntax for type uuid/i.test(
        blocker,
      ),
    ) ??
    input.db_error_message ??
    null

  const dbEvidence = rawInsertError
    ? buildApolloFullPipelineDbErrorEvidence({
        message: rawInsertError,
        table: input.db_error_table,
        operation: input.db_error_operation,
        company_contact_id: contact?.company_contact_id ?? null,
        contact_candidate_id: contact?.contact_candidate_id ?? null,
        candidate_id: input.existing_enrollment_candidate_id ?? null,
      })
    : null

  const qualification_override_used = input.qualification_override_used === true

  return {
    sequence_ready_contact_id:
      contact?.company_contact_id ?? contact?.contact_candidate_id ?? null,
    sequence_ready_contact_name: contact?.full_name ?? null,
    selected_contact_name: contact?.full_name ?? null,
    growth_lead_id: null,
    company_contact_id: contact?.company_contact_id ?? null,
    contact_candidate_id: contact?.contact_candidate_id ?? null,
    qualification_score,
    qualification_threshold: threshold,
    qualification_threshold_source: input.qualification_threshold_source ?? null,
    production_threshold,
    certification_threshold,
    qualification_override_used,
    qualification_blockers,
    existing_enrollment_candidate_id: input.existing_enrollment_candidate_id ?? null,
    existing_enrollment_candidate_status: input.existing_enrollment_candidate_status ?? null,
    duplicate_prevention_decision:
      input.duplicate_prevention_decision ??
      describeEnrollmentDuplicatePreventionDecision(input.automation_report),
    insert_error: dbEvidence?.insert_error ?? rawInsertError,
    db_error_table: dbEvidence?.db_error_table ?? input.db_error_table ?? null,
    db_error_operation: dbEvidence?.db_error_operation ?? input.db_error_operation ?? null,
    db_error_message: dbEvidence?.db_error_message ?? input.db_error_message ?? null,
    certification_source: input.certification_source ?? null,
    automation_message: input.automation_message ?? null,
  }
}

export function mapReusableEnrollmentCandidateId(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null
  return mapApolloEnrollmentCandidateDbRow(row).candidate_id || null
}
