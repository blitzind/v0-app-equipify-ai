import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION } from "@/lib/growth/business-profile/business-profile-types"
import { draftBusinessProfileWithAiAssistance } from "@/lib/growth/business-profile/business-profile-ai-draft-service"
import type {
  BusinessProfileDraftContent,
  BusinessProfileInput,
  BusinessProfileRecord,
} from "@/lib/growth/business-profile/business-profile-types"
import {
  approveBusinessProfileRow,
  getActiveApprovedBusinessProfile,
  getBusinessProfileById,
  getLatestDraftBusinessProfile,
  insertBusinessProfileDraft,
  isBusinessProfileSchemaReady,
  rejectBusinessProfileRow,
  rejectOtherApprovedBusinessProfiles,
  updateBusinessProfileRow,
} from "@/lib/growth/business-profile/business-profile-repository"

export type BusinessProfileWorkspaceState = {
  schemaReady: boolean
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
}

export async function fetchBusinessProfileWorkspaceState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BusinessProfileWorkspaceState> {
  const schemaReady = await isBusinessProfileSchemaReady(admin)
  if (!schemaReady) {
    return { schemaReady: false, activeApproved: null, latestDraft: null }
  }

  const [activeApproved, latestDraft] = await Promise.all([
    getActiveApprovedBusinessProfile(admin, organizationId),
    getLatestDraftBusinessProfile(admin, organizationId),
  ])

  return { schemaReady: true, activeApproved, latestDraft }
}

export async function createBusinessProfileDraftForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string | null
    companyInput: BusinessProfileInput
  },
): Promise<BusinessProfileRecord> {
  const schemaReady = await isBusinessProfileSchemaReady(admin)
  if (!schemaReady) {
    throw new Error(
      `Business Profile table is not ready. Apply migration ${GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION}.`,
    )
  }

  const draft = await draftBusinessProfileWithAiAssistance(input.companyInput, {
    organizationId: input.organizationId,
  })
  const record = await insertBusinessProfileDraft(admin, {
    organizationId: input.organizationId,
    companyName: draft.input.companyName,
    website: draft.input.website,
    profile: draft.profile,
    draftInput: draft.input,
    createdBy: input.createdBy,
  })

  if (!record) {
    throw new Error("Could not persist Business Profile draft.")
  }

  return record
}

export async function updateBusinessProfileDraftForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    companyName?: string
    website?: string
    profile?: BusinessProfileDraftContent
  },
): Promise<BusinessProfileRecord> {
  const existing = await getBusinessProfileById(admin, input.organizationId, input.profileId)
  if (!existing) {
    throw new Error("Business Profile not found.")
  }
  if (existing.status !== "draft") {
    throw new Error("Only draft Business Profiles can be edited.")
  }

  const updated = await updateBusinessProfileRow(admin, input)
  if (!updated) {
    throw new Error("Could not update Business Profile draft.")
  }
  return updated
}

export async function approveBusinessProfileForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    approvedBy: string | null
  },
): Promise<BusinessProfileRecord> {
  const existing = await getBusinessProfileById(admin, input.organizationId, input.profileId)
  if (!existing) {
    throw new Error("Business Profile not found.")
  }
  if (existing.status !== "draft") {
    throw new Error("Only draft Business Profiles can be approved.")
  }

  await rejectOtherApprovedBusinessProfiles(admin, input.organizationId, input.profileId)

  const approved = await approveBusinessProfileRow(admin, input)
  if (!approved) {
    throw new Error("Could not approve Business Profile.")
  }
  return approved
}

export async function rejectBusinessProfileForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
  },
): Promise<BusinessProfileRecord> {
  const existing = await getBusinessProfileById(admin, input.organizationId, input.profileId)
  if (!existing) {
    throw new Error("Business Profile not found.")
  }
  if (existing.status !== "draft") {
    throw new Error("Only draft Business Profiles can be rejected.")
  }

  const rejected = await rejectBusinessProfileRow(admin, input)
  if (!rejected) {
    throw new Error("Could not reject Business Profile.")
  }
  return rejected
}
