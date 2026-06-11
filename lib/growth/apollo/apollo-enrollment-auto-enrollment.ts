/** Apollo Enrollment Auto-Enrollment — server-only, candidate creation only (no draft/outreach). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  loadApolloEnrollmentCompanyContactRow,
  resolveOrCreateLeadForEnrollmentCandidate,
} from "@/lib/growth/apollo/apollo-enrollment-growth-lead-resolution"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  buildApolloEnrollmentAttributionRecord,
  buildApolloEnrollmentContactSnapshot,
  evaluateApolloEnrollmentReEnrollmentBlock,
  mapApolloEnrollmentCandidateDbRow,
  summarizeApolloOperatorReviewForQualification,
} from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import {
  APOLLO_ENROLLMENT_AUTOMATION_ID,
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  type ApolloEnrollmentAutomationReport,
  type ApolloEnrollmentCandidateRow,
  type ApolloEnrollmentQualificationInput,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { buildApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-funnel-metrics"
import { buildApolloEnrollmentOperatorIntelligence } from "@/lib/growth/apollo/apollo-enrollment-operator-intelligence"
import {
  evaluateApolloEnrollmentQualification,
  resolveApolloEnrollmentQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { loadProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-loader"

const CANDIDATES_TABLE = "apollo_enrollment_candidates"
const RUNS_TABLE = "apollo_enrollment_automation_runs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

async function findExistingPendingCandidate(
  admin: SupabaseClient,
  input: { company_contact_id: string | null; contact_candidate_id: string | null },
): Promise<Record<string, unknown> | null> {
  if (input.company_contact_id) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("company_contact_id", input.company_contact_id)
      .eq("status", "pending_enrollment_approval")
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  if (input.contact_candidate_id) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("contact_candidate_id", input.contact_candidate_id)
      .eq("status", "pending_enrollment_approval")
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  return null
}

async function findApprovedCandidateForContact(
  admin: SupabaseClient,
  input: { company_contact_id: string | null; contact_candidate_id: string | null },
): Promise<Record<string, unknown> | null> {
  if (input.company_contact_id) {
    const { data } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .select("*")
      .eq("company_contact_id", input.company_contact_id)
      .eq("status", "enrollment_approved")
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
      .eq("status", "enrollment_approved")
      .limit(1)
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  return null
}

async function hasActiveSequenceEnrollment(
  admin: SupabaseClient,
  leadId: string,
): Promise<boolean> {
  const { data } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

function buildQualificationInput(input: {
  snapshotSummary: ReturnType<typeof summarizeApolloOperatorReviewForQualification>
  contact: ApolloPrimaryContactOperatorReviewRow
  companyIntelligencePresent: boolean
  buyingCommitteePresent: boolean
  buyingCommitteeCoverage: number | null
  fitScore: number | null
  researchScore: number | null
  apolloSearchTier: string | null
}): ApolloEnrollmentQualificationInput {
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
    apollo_search_tier: input.apolloSearchTier,
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  }
}

export async function runApolloEnrollmentAutoEnrollmentForCompany(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_candidate_id: string
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    /** Full pipeline certification only — must not be passed from normal enrollment routes. */
    qualification_threshold_override?: number | null
    production_qualification_threshold?: number | null
    certification_qualification_threshold?: number | null
    qualification_threshold_source?: "production" | "certification_override" | null
    certification_source?: string | null
    created_by_source?: string | null
    execution_source?: string | null
    audit_reason?: string | null
    target_company_contact_id?: string | null
    target_contact_candidate_id?: string | null
  },
): Promise<{
  contacts_evaluated: number
  contacts_qualified: number
  candidates_created: number
  candidates_skipped_duplicate: number
  candidates_skipped_re_enrollment: number
  candidates: ApolloEnrollmentCandidateRow[]
  blockers: string[]
  funnel_overlay: {
    companies_searched: number
    contacts_found: number
    contacts_mapped: number
    verified_emails: number
    promoted_contacts: number
    contactable_contacts: number
    sequence_ready_contacts: number
    qualified_contacts: number
  }
}> {
  const productionThreshold =
    input.production_qualification_threshold ?? resolveApolloEnrollmentQualificationThreshold(input.env)
  const threshold = input.qualification_threshold_override ?? productionThreshold
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  if (!snapshot) {
    return {
      contacts_evaluated: 0,
      contacts_qualified: 0,
      candidates_created: 0,
      candidates_skipped_duplicate: 0,
      candidates_skipped_re_enrollment: 0,
      candidates: [],
      blockers: ["company_candidate_not_found"],
      funnel_overlay: {
        companies_searched: 0,
        contacts_found: 0,
        contacts_mapped: 0,
        verified_emails: 0,
        promoted_contacts: 0,
        contactable_contacts: 0,
        sequence_ready_contacts: 0,
        qualified_contacts: 0,
      },
    }
  }

  const summary = summarizeApolloOperatorReviewForQualification(snapshot)
  const engineIntelligence = await loadProspectSearchEngineIntelligence(admin, {
    source_type: "external_discovered",
    id: input.company_candidate_id,
    growth_lead_id: null,
    canonical_company_id: snapshot.canonical_company_id,
  })

  const companyIntelligencePresent =
    engineIntelligence.company_intelligence?.has_verified_intelligence === true
  const buyingCommitteePresent = (engineIntelligence.buying_committee?.member_count ?? 0) > 0
  const buyingCommitteeCoverage =
    engineIntelligence.buying_committee?.committee_completeness ?? null

  const fitScore =
    asNumber(engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence) != null
      ? (engineIntelligence.company_intelligence?.snapshots?.[0]?.confidence ?? 0) * 100
      : null
  const researchScore = fitScore

  const companySummary =
    engineIntelligence.company_intelligence?.snapshots
      ?.map((row) => row.value_text)
      .filter(Boolean)
      .slice(0, 2)
      .join(" — ") ?? null

  const buyingCommitteeSummary = buyingCommitteePresent
    ? `${engineIntelligence.buying_committee?.member_count ?? 0} committee members; roles: ${(engineIntelligence.buying_committee?.roles_present ?? []).join(", ") || "unknown"}`
    : null

  let targets = snapshot.contacts.filter((row) => row.sequence_ready && row.contactable)
  if (input.target_company_contact_id) {
    targets = targets.filter((row) => row.company_contact_id === input.target_company_contact_id)
  } else if (input.target_contact_candidate_id) {
    targets = targets.filter((row) => row.contact_candidate_id === input.target_contact_candidate_id)
  }
  const candidates: ApolloEnrollmentCandidateRow[] = []
  const blockers: string[] = []
  let contacts_qualified = 0
  let candidates_created = 0
  let candidates_skipped_duplicate = 0
  let candidates_skipped_re_enrollment = 0

  for (const contact of targets) {
    const qualificationInput = buildQualificationInput({
      snapshotSummary: summary,
      contact,
      companyIntelligencePresent,
      buyingCommitteePresent,
      buyingCommitteeCoverage,
      fitScore,
      researchScore,
      apolloSearchTier: null,
    })

    const qualification = evaluateApolloEnrollmentQualification(qualificationInput, { threshold })

    if (!qualification.qualified_for_enrollment) {
      blockers.push(`${contact.full_name}: ${qualification.qualification_reason}`)
      continue
    }

    contacts_qualified += 1

    const existingPending = await findExistingPendingCandidate(admin, {
      company_contact_id: contact.company_contact_id,
      contact_candidate_id: contact.contact_candidate_id,
    })
    if (existingPending) {
      candidates_skipped_duplicate += 1
      candidates.push(mapApolloEnrollmentCandidateDbRow(existingPending))
      continue
    }

    const existingApproved = await findApprovedCandidateForContact(admin, {
      company_contact_id: contact.company_contact_id,
      contact_candidate_id: contact.contact_candidate_id,
    })
    if (existingApproved) {
      candidates_skipped_re_enrollment += 1
      candidates.push(mapApolloEnrollmentCandidateDbRow(existingApproved))
      continue
    }

    const companyContact = contact.company_contact_id
      ? await loadApolloEnrollmentCompanyContactRow(admin, contact.company_contact_id)
      : null

    if (companyContact?.growth_lead_id) {
      const reEnrollmentBlock = evaluateApolloEnrollmentReEnrollmentBlock({
        existing_status: "enrollment_approved",
        growth_lead_id: companyContact.growth_lead_id,
        has_active_enrollment: await hasActiveSequenceEnrollment(admin, companyContact.growth_lead_id),
      })
      if (reEnrollmentBlock.blocked) {
        candidates_skipped_re_enrollment += 1
        const reuseApproved = await findApprovedCandidateForContact(admin, {
          company_contact_id: contact.company_contact_id,
          contact_candidate_id: contact.contact_candidate_id,
        })
        if (reuseApproved) {
          candidates.push(mapApolloEnrollmentCandidateDbRow(reuseApproved))
        }
        continue
      }
    }

    const operatorIntelligence = buildApolloEnrollmentOperatorIntelligence({
      contact,
      qualification,
      qualification_input: qualificationInput,
      company_summary: companySummary,
      research_summary: researchScore != null ? `Research confidence ${researchScore}/100.` : null,
      buying_committee_summary: buyingCommitteeSummary,
    })

    const sourceAttribution = buildApolloEnrollmentAttributionRecord({
      apollo_search_tier: qualificationInput.apollo_search_tier,
      verified_email_source: qualificationInput.verified_email_source,
      enrichment_source: qualificationInput.enrichment_source,
    })

    const contactSnapshot = buildApolloEnrollmentContactSnapshot(contact, {
      email: companyContact?.email ?? null,
      phone: companyContact?.phone ?? null,
    })

    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await admin
      .schema("growth")
      .from(CANDIDATES_TABLE)
      .insert({
        company_candidate_id: input.company_candidate_id,
        company_contact_id: contact.company_contact_id,
        contact_candidate_id: contact.contact_candidate_id,
        status: "pending_enrollment_approval",
        qualified_for_enrollment: true,
        qualification_reason: qualification.qualification_reason,
        qualification_score: qualification.qualification_score,
        fit_score: fitScore,
        research_score: researchScore,
        contact_snapshot: contactSnapshot,
        qualification_snapshot: {
          threshold,
          production_threshold: productionThreshold,
          certification_threshold: input.certification_qualification_threshold ?? null,
          qualification_threshold_source: input.qualification_threshold_source ?? "production",
          qualification_override_used:
            input.qualification_threshold_source === "certification_override",
          score_breakdown: qualification.score_breakdown,
          qualification_input: qualificationInput,
        },
        operator_intelligence: operatorIntelligence,
        source_attribution: sourceAttribution,
        acquisition_evidence: {
          pipeline: ["Apollo", "Enrichment", "Promotion", "Qualification", "Enrollment"],
          company_candidate_id: input.company_candidate_id,
          sequence_ready_at_creation: contact.sequence_ready,
          contactable_at_creation: contact.contactable,
          execution_id: input.execution_id,
        },
        auto_enrollment_attempted: true,
        outreach_sent: false,
        updated_at: now,
        metadata: {
          qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
          certification_source: input.certification_source ?? null,
          created_by_source: input.created_by_source ?? null,
          execution_source: input.execution_source ?? null,
          audit_reason: input.audit_reason ?? null,
        },
      })
      .select("*")
      .single()

    if (insertError || !inserted) {
      blockers.push(
        `${contact.full_name}: table=growth.apollo_enrollment_candidates operation=insert | ${insertError?.message ?? "candidate_insert_failed"}`,
      )
      continue
    }

    const candidateId = asString(inserted.id)
    if (contact.company_contact_id) {
      const leadResolution = await resolveOrCreateLeadForEnrollmentCandidate(admin, {
        company_candidate_id: input.company_candidate_id,
        company_contact_id: contact.company_contact_id,
        candidate_id: candidateId,
        created_by: normalizeGrowthActorUserIdForDb(input.created_by),
      })

      if (leadResolution.ok) {
        await admin
          .schema("growth")
          .from(CANDIDATES_TABLE)
          .update({
            growth_lead_id: leadResolution.lead_id,
            prospect_id: leadResolution.prospect_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", candidateId)

        const { data: refreshed } = await admin
          .schema("growth")
          .from(CANDIDATES_TABLE)
          .select("*")
          .eq("id", candidateId)
          .single()

        candidates.push(
          mapApolloEnrollmentCandidateDbRow((refreshed ?? inserted) as Record<string, unknown>),
        )
      } else {
        blockers.push(
          `${contact.full_name}: table=growth.leads operation=insert | ${leadResolution.code}`,
        )
        candidates.push(mapApolloEnrollmentCandidateDbRow(inserted as Record<string, unknown>))
      }
    } else {
      candidates.push(mapApolloEnrollmentCandidateDbRow(inserted as Record<string, unknown>))
    }

    candidates_created += 1
    logGrowthEngine("apollo_enrollment_candidate_created", {
      execution_id: input.execution_id,
      candidate_id: candidateId,
      company_candidate_id: input.company_candidate_id,
      qualification_score: qualification.qualification_score,
      auto_enrollment: false,
      outreach_sent: false,
    })
  }

  return {
    contacts_evaluated: targets.length,
    contacts_qualified,
    candidates_created,
    candidates_skipped_duplicate,
    candidates_skipped_re_enrollment,
    candidates,
    blockers,
    funnel_overlay: {
      companies_searched: 1,
      contacts_found: summary.mapped_contacts,
      contacts_mapped: summary.mapped_contacts,
      verified_emails: summary.verified_email_contacts,
      promoted_contacts: snapshot.evidence.promoted_company_contacts_loaded,
      contactable_contacts: summary.contactable_contacts,
      sequence_ready_contacts: summary.sequence_ready_contacts,
      qualified_contacts: contacts_qualified,
    },
  }
}

export async function runApolloEnrollmentAutomation(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_candidate_id: string
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    qualification_threshold_override?: number | null
    production_qualification_threshold?: number | null
    certification_qualification_threshold?: number | null
    qualification_threshold_source?: "production" | "certification_override" | null
    certification_source?: string | null
    created_by_source?: string | null
    execution_source?: string | null
    audit_reason?: string | null
    target_company_contact_id?: string | null
    target_contact_candidate_id?: string | null
  },
): Promise<ApolloEnrollmentAutomationReport> {
  const result = await runApolloEnrollmentAutoEnrollmentForCompany(admin, input)
  const funnel_metrics = await buildApolloEnrollmentFunnelMetrics(admin, result.funnel_overlay)

  const report: ApolloEnrollmentAutomationReport = {
    qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
    automation_id: APOLLO_ENROLLMENT_AUTOMATION_ID,
    execution_id: input.execution_id,
    company_candidate_id: input.company_candidate_id,
    contacts_evaluated: result.contacts_evaluated,
    contacts_qualified: result.contacts_qualified,
    candidates_created: result.candidates_created,
    candidates_skipped_duplicate: result.candidates_skipped_duplicate,
    candidates_skipped_re_enrollment: result.candidates_skipped_re_enrollment,
    funnel_metrics,
    candidates: result.candidates,
    blockers: result.blockers,
    auto_enrollment: false,
    outreach_sent: false,
    draft_created: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from(RUNS_TABLE).insert({
    execution_id: input.execution_id,
    company_candidate_id: input.company_candidate_id,
    status: result.blockers.length && result.candidates_created === 0 ? "partial" : "completed",
    contacts_evaluated: result.contacts_evaluated,
    contacts_qualified: result.contacts_qualified,
    candidates_created: result.candidates_created,
    candidates_skipped_duplicate: result.candidates_skipped_duplicate,
    candidates_skipped_re_enrollment: result.candidates_skipped_re_enrollment,
    funnel_metrics,
    blockers: result.blockers,
    auto_enrollment_attempted: true,
    outreach_sent: false,
    metadata: { qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER },
  })

  return report
}
