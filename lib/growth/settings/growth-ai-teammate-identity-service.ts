import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isValidPlatformPersonaName,
  normalizePlatformPersonaName,
  PLATFORM_PERSONA_SERVER_QA_MARKER,
  updatePlatformPersonaIdentity,
} from "@fuzor/identity"
import {
  loadGrowthAiTeammateIdentityRecord,
  upsertOrganizationAiTeammateIdentity,
} from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import {
  type AiTeammateIdentity,
  type AiTeammateIdentityPatch,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import { isGrowthOrganizationAiTeammateActivationColumnMissingError } from "@/lib/growth/settings/growth-workspace-settings-column-compat"
import { upsertWorkspacePreferencesForUser } from "@/lib/growth/settings/growth-workspace-settings-repository"

export async function loadAiTeammateIdentity(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<AiTeammateIdentity> {
  return loadGrowthAiTeammateIdentityRecord(admin, input)
}

export async function updateAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string | null
    userId: string
    patch: AiTeammateIdentityPatch
  },
): Promise<AiTeammateIdentity> {
  try {
    return await updatePlatformPersonaIdentity(admin, input, {
      setOnboardingCompletedForUser: async (adminClient, userId, onboardingCompleted) => {
        await upsertWorkspacePreferencesForUser(adminClient, userId, {
          aiTeammateOnboardingCompleted: onboardingCompleted,
        })
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isGrowthOrganizationAiTeammateActivationColumnMissingError({ message })) throw error
  }

  if (input.patch.name !== undefined) {
    const normalized = normalizePlatformPersonaName(input.patch.name)
    if (!isValidPlatformPersonaName(normalized)) {
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

  return loadGrowthAiTeammateIdentityRecord(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })
}

export const GE_AI_UX_3B_QA_MARKER = PLATFORM_PERSONA_SERVER_QA_MARKER
