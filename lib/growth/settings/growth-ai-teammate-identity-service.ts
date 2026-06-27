import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type AiTeammateIdentity,
  type AiTeammateIdentityPatch,
  GE_AI_UX_3B_QA_MARKER,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import {
  getAiTeammateOnboardingCompletedForUser,
  getOrganizationAiTeammateIdentity,
  upsertOrganizationAiTeammateIdentity,
} from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { upsertWorkspacePreferencesForUser } from "@/lib/growth/settings/growth-workspace-settings-repository"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  isValidAiTeammateName,
  normalizeAiTeammateName,
  sanitizeAiTeammateName,
} from "@/lib/workspace/ai-teammate-identity"

export async function loadAiTeammateIdentity(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<AiTeammateIdentity> {
  const onboardingCompleted = await getAiTeammateOnboardingCompletedForUser(admin, input.userId)

  if (!input.organizationId) {
    return {
      organizationId: null,
      name: AI_TEAMMATE_DEFAULT_NAME,
      role: AI_TEAMMATE_DEFAULT_ROLE,
      source: "default",
      onboardingCompleted,
    }
  }

  const orgRecord = await getOrganizationAiTeammateIdentity(admin, input.organizationId)
  if (!orgRecord) {
    return {
      organizationId: input.organizationId,
      name: AI_TEAMMATE_DEFAULT_NAME,
      role: AI_TEAMMATE_DEFAULT_ROLE,
      source: "default",
      onboardingCompleted,
    }
  }

  return {
    organizationId: orgRecord.organizationId,
    name: sanitizeAiTeammateName(orgRecord.teammateName),
    role: AI_TEAMMATE_DEFAULT_ROLE,
    source: "organization",
    onboardingCompleted,
    updatedByUserId: orgRecord.updatedByUserId,
    updatedAt: orgRecord.updatedAt,
  }
}

export async function updateAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string | null
    userId: string
    patch: AiTeammateIdentityPatch
  },
): Promise<AiTeammateIdentity> {
  if (input.patch.name !== undefined) {
    const normalized = normalizeAiTeammateName(input.patch.name)
    if (!isValidAiTeammateName(normalized)) {
      throw new Error("AI teammate name must be 2–32 characters using letters, numbers, spaces, hyphens, or apostrophes.")
    }
    if (!input.organizationId) {
      throw new Error("Organization context is required to save AI teammate name.")
    }
    await upsertOrganizationAiTeammateIdentity(admin, {
      organizationId: input.organizationId,
      teammateName: normalized,
      updatedByUserId: input.userId,
    })
  }

  if (input.patch.onboardingCompleted !== undefined) {
    await upsertWorkspacePreferencesForUser(admin, input.userId, {
      aiTeammateOnboardingCompleted: input.patch.onboardingCompleted,
    })
  }

  return loadAiTeammateIdentity(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })
}

export { GE_AI_UX_3B_QA_MARKER }
