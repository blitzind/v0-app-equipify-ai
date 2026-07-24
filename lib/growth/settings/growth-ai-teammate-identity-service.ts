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
import {
  PLATFORM_PERSONA_DEFAULT_NAME,
  PLATFORM_PERSONA_DEFAULT_ROLE,
} from "@fuzor/identity"

function defaultAiTeammateIdentity(organizationId: string | null): AiTeammateIdentity {
  return {
    organizationId,
    name: PLATFORM_PERSONA_DEFAULT_NAME,
    role: PLATFORM_PERSONA_DEFAULT_ROLE,
    source: "default",
    onboardingCompleted: false,
  }
}

export async function loadAiTeammateIdentity(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<AiTeammateIdentity> {
  return loadPlatformPersonaIdentity(admin, input)
}

export async function loadAiTeammateIdentityGracefully(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<{ identity: AiTeammateIdentity; degraded: boolean; warning: string | null }> {
  try {
    const identity = await loadPlatformPersonaIdentity(admin, input)
    return { identity, degraded: false, warning: null }
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Could not load AI teammate identity."
    return {
      identity: defaultAiTeammateIdentity(input.organizationId),
      degraded: true,
      warning,
    }
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
  return updatePlatformPersonaIdentity(admin, input, {
    setOnboardingCompletedForUser: async (adminClient, userId, onboardingCompleted) => {
      await upsertWorkspacePreferencesForUser(adminClient, userId, {
        aiTeammateOnboardingCompleted: onboardingCompleted,
      })
    },
  })
}

export const GE_AI_UX_3B_QA_MARKER = PLATFORM_PERSONA_SERVER_QA_MARKER
