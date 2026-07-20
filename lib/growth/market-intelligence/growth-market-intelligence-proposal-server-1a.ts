/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Apply proposal to Business Profile draft (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { BusinessProfileInput } from "@/lib/growth/business-profile/business-profile-types"
import {
  getActiveApprovedBusinessProfile,
  getLatestDraftBusinessProfile,
  insertBusinessProfileDraft,
  updateBusinessProfileRow,
} from "@/lib/growth/business-profile/business-profile-repository"
import {
  fetchOrganizationMemoryStore,
  upsertOrganizationMemoryPreferences,
} from "@/lib/growth/memory/storage/organization-memory-repository"
import {
  applyMarketIntelligenceRecommendationsToProfile,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-proposal-1a"
import {
  marketIntelligenceLoopMemoryPreferencePayload,
  parseMarketIntelligenceLoopMemoryFromStore,
  recordMarketIntelligenceProposalMemory,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-memory-1a"
import type { MarketIntelligenceProposal } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import { attachMarketIntelligenceToProposalDraft } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a"

export async function applyMarketIntelligenceProposalToBusinessProfileDraft(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string | null
    proposal: MarketIntelligenceProposal
    generatedAt: string
  },
): Promise<{ profileId: string; created: boolean; proposal: MarketIntelligenceProposal }> {
  const approvedProfile = await getActiveApprovedBusinessProfile(admin, input.organizationId)
  if (!approvedProfile?.profile) {
    throw new Error("Approved Business Profile required before applying market intelligence proposal.")
  }

  const latestDraft = await getLatestDraftBusinessProfile(admin, input.organizationId)
  const companyName = approvedProfile.companyName ?? latestDraft?.companyName ?? "Company"
  const website = approvedProfile.website ?? latestDraft?.website ?? ""

  const profile = applyMarketIntelligenceRecommendationsToProfile(
    approvedProfile.profile,
    input.proposal.recommendations,
  )

  profile.confidence.assumptions = [
    ...new Set([
      ...profile.confidence.assumptions,
      "Draft proposed by Market Intelligence Loop — approve in Company Profile to update targeting.",
    ]),
  ]

  const draftInput: BusinessProfileInput = {
    companyName,
    website,
    notes: "Proposed strategic update from validated market intelligence.",
  }

  let profileId: string
  let created: boolean

  if (latestDraft) {
    const updated = await updateBusinessProfileRow(admin, {
      organizationId: input.organizationId,
      profileId: latestDraft.id,
      profile,
      companyName,
      website,
    })
    if (!updated) throw new Error("Could not update Business Profile draft from market intelligence proposal.")
    profileId = updated.id
    created = false
  } else {
    const inserted = await insertBusinessProfileDraft(admin, {
      organizationId: input.organizationId,
      companyName,
      website,
      profile,
      draftInput,
      createdBy: input.createdBy,
    })
    if (!inserted) throw new Error("Could not create Business Profile draft from market intelligence proposal.")
    profileId = inserted.id
    created = true
  }

  const memoryStore = await fetchOrganizationMemoryStore(admin, input.organizationId)
  const loopMemory = parseMarketIntelligenceLoopMemoryFromStore(memoryStore)
  const updatedProposal = attachMarketIntelligenceToProposalDraft(input.proposal, profileId)
  const nextMemory = recordMarketIntelligenceProposalMemory({
    memory: loopMemory,
    proposal: updatedProposal,
    profileDraftId: profileId,
  })

  await upsertOrganizationMemoryPreferences(admin, {
    organizationId: input.organizationId,
    preferences: [marketIntelligenceLoopMemoryPreferencePayload(nextMemory)],
    generatedAt: input.generatedAt,
  })

  return { profileId, created, proposal: updatedProposal }
}
