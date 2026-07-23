import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadPlatformPersonaIdentity,
  PLATFORM_PERSONA_SERVER_QA_MARKER,
  updatePlatformPersonaIdentity,
} from "@fuzor/identity"

import {
  type AiTeammateIdentity,
  type AiTeammateIdentityPatch,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import { upsertWorkspacePreferencesForUser } from "@/lib/growth/settings/growth-workspace-settings-repository"

export async function loadAiTeammateIdentity(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<AiTeammateIdentity> {
  return loadPlatformPersonaIdentity(admin, input)
}

export async function updateAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string | null
    userId: string
    patch: AiTeammateIdentityPatch
  },
): Promise<AiTeammateIdentity> {
  return updatePlatformPersonaIdentity(admin, input, {
    setOnboardingCompletedForUser: async (adminClient, userId, onboardingCompleted) => {
      await upsertWorkspacePreferencesForUser(adminClient, userId, {
        aiTeammateOnboardingCompleted: onboardingCompleted,
      })
    },
  })
}

export const GE_AI_UX_3B_QA_MARKER = PLATFORM_PERSONA_SERVER_QA_MARKER
