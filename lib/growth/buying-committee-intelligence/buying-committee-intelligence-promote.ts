import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canPromoteBuyingCommitteeAssignment } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-confidence"
import { evaluateBuyingCommitteeMemberPromotion } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-integrity-rules"
import { mapCanonicalEmploymentRoleToCommitteeRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification"
import {
  buyingCommitteeSourceRequiresEmploymentCheck,
  personHasVerifiedCompanyEmploymentLink,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-employment-integrity"
import {
  fetchBuyingCommitteeIntelligenceMemberByKey,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import type {
  GrowthBuyingCommitteeIntelligenceDraftAssignment,
  GrowthBuyingCommitteeIntelligenceVerificationStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

const PERSON_ROLE_UPSERT_MAP: Record<string, string> = {
  economic_buyer: "economic_buyer",
  technical_buyer: "technical_buyer",
  champion: "champion",
  influencer: "influencer",
  end_user: "end_user",
  executive_sponsor: "executive_sponsor",
  procurement: "procurement",
  blocker_risk_stakeholder: "blocker_risk_stakeholder",
}

export async function promoteVerifiedBuyingCommitteeAssignment(
  admin: SupabaseClient,
  input: {
    company_id: string
    run_id: string
    draft: GrowthBuyingCommitteeIntelligenceDraftAssignment
    verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus
    confidence: number
    source_evidence_ids: string[]
  },
): Promise<{ promoted: boolean; promotion_status: string; reason: string; member_id?: string }> {
  if (
    !canPromoteBuyingCommitteeAssignment({
      verification_status: input.verification_status,
      confidence: input.confidence,
    })
  ) {
    return {
      promoted: false,
      promotion_status: "skipped",
      reason: `Not promotable: verification=${input.verification_status}, confidence=${input.confidence}.`,
    }
  }

  const existing = await fetchBuyingCommitteeIntelligenceMemberByKey(admin, {
    company_id: input.company_id,
    person_id: input.draft.person_id,
    committee_role: input.draft.committee_role,
  })

  const gate = evaluateBuyingCommitteeMemberPromotion({
    existing: existing
      ? {
          id: existing.id as string,
          company_id: existing.company_id as string,
          person_id: existing.person_id as string,
          committee_role: existing.committee_role as GrowthBuyingCommitteeIntelligenceDraftAssignment["committee_role"],
          verification_status: existing.verification_status as string,
          confidence: Number(existing.confidence ?? 0),
        }
      : null,
    target_company_id: input.company_id,
    target_person_id: input.draft.person_id,
    incoming_confidence: input.confidence,
    incoming_verification_status: input.verification_status,
  })

  if (!gate.allowed) {
    return { promoted: false, promotion_status: "rejected", reason: gate.reason }
  }

  if (buyingCommitteeSourceRequiresEmploymentCheck(input.draft.source)) {
    const employed = await personHasVerifiedCompanyEmploymentLink(admin, {
      company_id: input.company_id,
      person_id: input.draft.person_id,
    })
    if (!employed) {
      return {
        promoted: false,
        promotion_status: "rejected",
        reason:
          "Promotion requires person_company_roles or company_contacts link at this canonical company.",
      }
    }
  }

  const observed_at = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .upsert(
      {
        company_id: input.company_id,
        person_id: input.draft.person_id,
        committee_role: input.draft.committee_role,
        normalized_assignment_key: input.draft.normalized_assignment_key,
        full_name: input.draft.full_name,
        job_title: input.draft.job_title,
        confidence: input.confidence,
        verification_status: "verified",
        source_table: "buying_committee_runs",
        source_run_id: input.run_id,
        source_evidence_ids: input.source_evidence_ids,
        provider_name: input.draft.provider_name,
        discovery_source: input.draft.discovery_source,
        observed_at,
        metadata: {
          qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
          source: input.draft.source,
        },
      },
      { onConflict: "company_id,person_id,committee_role", ignoreDuplicates: false },
    )
    .select("id")
    .single()

  if (error) {
    return {
      promoted: false,
      promotion_status: "rejected",
      reason: `Upsert failed: ${error.message}`,
    }
  }

  const employmentRole =
    PERSON_ROLE_UPSERT_MAP[input.draft.committee_role] ??
    mapCanonicalEmploymentRoleToCommitteeRole(input.draft.committee_role)

  if (employmentRole) {
    await admin.schema("growth").from("person_company_roles").upsert(
      {
        person_id: input.draft.person_id,
        company_id: input.company_id,
        title: input.draft.job_title,
        role_type: employmentRole,
        confidence: input.confidence,
        source_table: "buying_committee_intelligence_members",
        source_id: data.id as string,
        provider_name: input.draft.provider_name,
        discovery_source: input.draft.discovery_source,
        observed_at,
        metadata: { qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER },
      },
      { onConflict: "person_id,company_id,title", ignoreDuplicates: false },
    )
  }

  return {
    promoted: true,
    promotion_status: "promoted",
    reason: gate.reason,
    member_id: data.id as string,
  }
}
