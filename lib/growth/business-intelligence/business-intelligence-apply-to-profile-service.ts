/** GE-AIOS-8A-7 — Apply reviewed BI decisions to Business Profile draft (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { BusinessProfileDraftContent, BusinessProfileInput } from "@/lib/growth/business-profile/business-profile-types"
import {
  getActiveApprovedBusinessProfile,
  getLatestDraftBusinessProfile,
  insertBusinessProfileDraft,
  updateBusinessProfileRow,
} from "@/lib/growth/business-profile/business-profile-repository"
import { fetchLatestBusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-repository"
import { fetchBusinessIntelligenceReviewDecisions } from "@/lib/growth/business-intelligence/business-intelligence-review-repository"
import {
  computeBusinessIntelligenceReviewProgress,
  getBusinessIntelligenceReportFieldByKey,
} from "@/lib/growth/business-intelligence/business-intelligence-review-service"
import type { BusinessIntelligenceReviewFieldKey } from "@/lib/growth/business-intelligence/business-intelligence-review-types"

function asStringArray(value: string | string[] | null): string[] {
  if (value == null) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean)
}

function emptyProfileTemplate(input: {
  companyName: string
  website: string
}): BusinessProfileDraftContent {
  return {
    company: {
      companyName: input.companyName,
      website: input.website,
      shortDescription: "",
      productsServices: [],
      businessModel: "",
      primaryValueProposition: "",
    },
    idealCustomers: {
      targetIndustries: [],
      companySizeRanges: [],
      geography: [],
      buyerPersonas: [],
      disqualifiers: [],
    },
    problemsAndTriggers: {
      painPoints: [],
      buyingTriggers: [],
      competitorsAlternatives: [],
      keywords: [],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: null,
      messagingAngles: [],
      qualificationCriteria: [],
    },
    confidence: {
      score: 0.5,
      assumptions: ["Derived from Business Intelligence review decisions."],
      missingInformation: [],
    },
    draftSource: "deterministic",
  }
}

function applyReviewValueToProfile(
  profile: BusinessProfileDraftContent,
  fieldKey: BusinessIntelligenceReviewFieldKey,
  value: string | string[] | null,
): BusinessProfileDraftContent {
  const next: BusinessProfileDraftContent = structuredClone(profile)
  const list = asStringArray(value)
  const text = typeof value === "string" ? value : list.join(", ")

  switch (fieldKey) {
    case "company.company_description":
      next.company.shortDescription = text
      break
    case "company.primary_offer":
      next.company.primaryValueProposition = text
      break
    case "company.products":
      next.company.productsServices = list
      break
    case "company.services":
      next.company.productsServices = [...new Set([...next.company.productsServices, ...list])]
      break
    case "market.industries_served":
      next.idealCustomers.targetIndustries = list
      break
    case "market.geographic_markets":
      next.idealCustomers.geography = list
      break
    case "sales.likely_buyer_personas":
      next.idealCustomers.buyerPersonas = list
      break
    case "sales.likely_pain_points":
      next.problemsAndTriggers.painPoints = list
      break
    case "company.plans_pricing":
      next.salesAndMarketing.qualificationCriteria = [
        ...new Set([...next.salesAndMarketing.qualificationCriteria, ...list]),
      ]
      if (list[0]) {
        next.salesAndMarketing.averageDealSize = list[0]
      }
      break
    case "company.differentiators":
      next.salesAndMarketing.messagingAngles = list
      break
    default:
      break
  }

  return next
}

export type ApplyBiReviewToBusinessProfileDeps = {
  fetchLatestBusinessIntelligenceReport?: typeof fetchLatestBusinessIntelligenceReport
  fetchBusinessIntelligenceReviewDecisions?: typeof fetchBusinessIntelligenceReviewDecisions
  getActiveApprovedBusinessProfile?: typeof getActiveApprovedBusinessProfile
  getLatestDraftBusinessProfile?: typeof getLatestDraftBusinessProfile
  insertBusinessProfileDraft?: typeof insertBusinessProfileDraft
  updateBusinessProfileRow?: typeof updateBusinessProfileRow
}

export async function applyBusinessIntelligenceReviewToBusinessProfileDraft(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string | null
    deps?: ApplyBiReviewToBusinessProfileDeps
  },
): Promise<{ profileId: string; created: boolean }> {
  const fetchLatestReport = input.deps?.fetchLatestBusinessIntelligenceReport ?? fetchLatestBusinessIntelligenceReport
  const fetchDecisions = input.deps?.fetchBusinessIntelligenceReviewDecisions ?? fetchBusinessIntelligenceReviewDecisions
  const loadApproved = input.deps?.getActiveApprovedBusinessProfile ?? getActiveApprovedBusinessProfile
  const loadLatestDraft = input.deps?.getLatestDraftBusinessProfile ?? getLatestDraftBusinessProfile
  const insertDraft = input.deps?.insertBusinessProfileDraft ?? insertBusinessProfileDraft
  const updateDraft = input.deps?.updateBusinessProfileRow ?? updateBusinessProfileRow

  const reportRecord = await fetchLatestReport(admin, input.organizationId)
  if (!reportRecord?.report) {
    throw new Error("No Business Intelligence report exists.")
  }

  const decisions = await fetchDecisions(admin, {
    organization_id: input.organizationId,
    business_intelligence_report_id: reportRecord.report_id,
  })

  const progress = computeBusinessIntelligenceReviewProgress({
    report: reportRecord.report,
    decisions,
  })

  if (!progress.can_apply_to_profile) {
    throw new Error(
      "Review is incomplete. Resolve contradictions and confirm required fields before updating Business Profile.",
    )
  }

  const actionable = decisions.filter(
    (decision) => decision.decision === "approved" || decision.decision === "edited",
  )
  if (actionable.length === 0) {
    throw new Error("No approved or edited review decisions are available to apply.")
  }

  const approvedProfile = await loadApproved(admin, input.organizationId)
  const latestDraft = await loadLatestDraft(admin, input.organizationId)

  const companyName = approvedProfile?.companyName ?? latestDraft?.companyName ?? "Company"
  const website = approvedProfile?.website ?? latestDraft?.website ?? ""

  let profile = approvedProfile?.profile ?? latestDraft?.profile ?? emptyProfileTemplate({ companyName, website })

  for (const decision of actionable) {
    const value =
      decision.decision === "edited"
        ? decision.approved_value_json
        : decision.approved_value_json ?? getBusinessIntelligenceReportFieldByKey(reportRecord.report, decision.field_key)?.value ?? null

    if (value == null) continue
    profile = applyReviewValueToProfile(profile, decision.field_key, value)
  }

  profile.confidence.assumptions = [
    ...new Set([
      ...profile.confidence.assumptions,
      "Updated from Business Intelligence review decisions (draft — requires separate approval).",
    ]),
  ]
  profile.draftSource = "deterministic"

  const draftInput: BusinessProfileInput = {
    companyName,
    website,
    notes: "Proposed update from Business Intelligence review.",
  }

  if (latestDraft) {
    const updated = await updateDraft(admin, {
      organizationId: input.organizationId,
      profileId: latestDraft.id,
      profile,
      companyName,
      website,
    })
    if (!updated) {
      throw new Error("Could not update existing Business Profile draft.")
    }
    return { profileId: updated.id, created: false }
  }

  const created = await insertDraft(admin, {
    organizationId: input.organizationId,
    companyName,
    website,
    profile,
    draftInput,
    createdBy: input.createdBy,
  })

  if (!created) {
    throw new Error("Could not create Business Profile draft from review decisions.")
  }

  return { profileId: created.id, created: true }
}
