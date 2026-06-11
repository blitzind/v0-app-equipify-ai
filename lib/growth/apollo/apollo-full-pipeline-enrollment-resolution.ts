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
import { loadProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-loader"

const CANDIDATES_TABLE = "apollo_enrollment_candidates"
const REUSABLE_STATUSES = ["pending_enrollment_approval", "enrollment_approved"] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
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

  const { data: byCompany } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("status", "pending_enrollment_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byCompany) {
    return { row: byCompany as Record<string, unknown>, reuse_reason: "company_candidate_pending" }
  }

  return null
}

function buildQualificationInput(input: {
  snapshotSummary: ReturnType<typeof summarizeApolloOperatorReviewForQualification>
  contact: ApolloPrimaryContactOperatorReviewRow
  companyIntelligencePresent: boolean
  buyingCommitteePresent: boolean
  buyingCommitteeCoverage: number | null
  fitScore: number | null
  researchScore: number | null
}) {
  return {
    mapped_contacts: input.snapshotSummary.mapped_contacts,
    verified_email_contacts: input.snapshotSummary.verified_email_contacts,
    contactable_contacts: input.snapshotSummary.contactable_contacts,
    sequence_ready_contacts: input.snapshotSummary.sequence_ready_contacts,
    company_intelligence_present: input.companyIntelligencePresent,
    buying_committee_present: input.buyingCommitteePresent,
    buying_committee_coverage: input.buyingCommitteeCoverage,
    fit_score: input.fitScore,
    research_score: input.researchScore,
    contact_sequence_ready: input.contact.sequence_ready,
    contact_contactable: input.contact.contactable,
    contact_blockers: input.contact.blockers,
    apollo_search_tier: null,
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  }
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
  const engineIntelligence = await loadProspectSearchEngineIntelligence(admin, {
    source_type: "external_discovered",
    id: input.company_candidate_id,
    growth_lead_id: null,
    canonical_company_id: snapshot.canonical_company_id,
  })

  const fitScore =
    asNumber(engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence) != null
      ? (engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence ?? 0) * 100
      : null

  const scored: ApolloFullPipelineCertificationScoredContact[] = []
  for (const contact of input.contacts.filter((row) => isCertificationEligibleSequenceReadyContact(row))) {
    const qualification = evaluateApolloEnrollmentQualification(
      buildQualificationInput({
        snapshotSummary: summary,
        contact,
        companyIntelligencePresent:
          engineIntelligence.company_intelligence?.has_verified_intelligence === true,
        buyingCommitteePresent: (engineIntelligence.buying_committee?.member_count ?? 0) > 0,
        buyingCommitteeCoverage: engineIntelligence.buying_committee?.committee_completeness ?? null,
        fitScore,
        researchScore: fitScore,
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
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrollmentAutomationReport> {
  return runApolloEnrollmentAutomation(admin, {
    execution_id: input.execution_id,
    company_candidate_id: input.company_candidate_id,
    created_by: input.created_by ?? null,
    env: input.env,
    qualification_threshold_override: input.threshold_used,
    production_qualification_threshold: input.production_threshold,
    certification_qualification_threshold: input.certification_threshold,
    qualification_threshold_source: input.threshold_source,
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
        const engineIntelligence = await loadProspectSearchEngineIntelligence(admin, {
          source_type: "external_discovered",
          id: input.company_candidate_id,
          growth_lead_id: null,
          canonical_company_id: snapshot.canonical_company_id,
        })

        const fitScore =
          asNumber(engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence) != null
            ? (engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence ?? 0) * 100
            : null

        const qualification = evaluateApolloEnrollmentQualification(
          buildQualificationInput({
            snapshotSummary: summary,
            contact,
            companyIntelligencePresent:
              engineIntelligence.company_intelligence?.has_verified_intelligence === true,
            buyingCommitteePresent: (engineIntelligence.buying_committee?.member_count ?? 0) > 0,
            buyingCommitteeCoverage:
              engineIntelligence.buying_committee?.committee_completeness ?? null,
            fitScore,
            researchScore: fitScore,
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

  const insert_error =
    input.insert_error ??
    input.automation_report?.blockers.find((blocker) =>
      /insert|duplicate key|violates|candidate_insert_failed/i.test(blocker),
    ) ??
    null

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
    insert_error,
    automation_message: input.automation_message ?? null,
  }
}

export function mapReusableEnrollmentCandidateId(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null
  return mapApolloEnrollmentCandidateDbRow(row).candidate_id || null
}
