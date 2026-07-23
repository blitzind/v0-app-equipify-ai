/** GE-AI-UX-3B — AI teammate server identity types (client-safe). */

import {
  PLATFORM_PERSONA_DEFAULT_ROLE,
  PLATFORM_PERSONA_IDENTITY_MIGRATION,
  PLATFORM_PERSONA_SERVER_QA_MARKER,
  type PlatformPersonaIdentity,
  type PlatformPersonaIdentityApiResponse,
  type PlatformPersonaIdentityPatch,
  type PlatformPersonaIdentityRole,
  type PlatformPersonaIdentitySource,
} from "@fuzor/identity"

export const GE_AI_UX_3B_QA_MARKER = PLATFORM_PERSONA_SERVER_QA_MARKER

export const GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION = PLATFORM_PERSONA_IDENTITY_MIGRATION

export const GROWTH_AI_TEAMMATE_IDENTITY_API_PATH = "/api/growth/workspace/settings/ai-teammate" as const

export type AiTeammateIdentitySource = PlatformPersonaIdentitySource

export type AiTeammateIdentityRole = PlatformPersonaIdentityRole

export type AiTeammateIdentity = PlatformPersonaIdentity

export type AiTeammateIdentityPatch = PlatformPersonaIdentityPatch

export type AiTeammateIdentityApiResponse = PlatformPersonaIdentityApiResponse

export { PLATFORM_PERSONA_DEFAULT_ROLE as AI_TEAMMATE_DEFAULT_ROLE }
