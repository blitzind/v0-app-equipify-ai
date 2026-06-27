/** GE-AI-UX-3B — AI teammate server identity types (client-safe). */

import { AI_TEAMMATE_DEFAULT_ROLE } from "@/lib/workspace/ai-teammate-identity"

export const GE_AI_UX_3B_QA_MARKER = "ge-ai-ux-3b-ai-teammate-server-identity-v1" as const

export const GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION =
  "20270829120000_growth_organization_ai_teammate_identity_3b.sql" as const

export const GROWTH_AI_TEAMMATE_IDENTITY_API_PATH = "/api/growth/workspace/settings/ai-teammate" as const

export type AiTeammateIdentitySource = "default" | "organization" | "user_override"

export type AiTeammateIdentityRole = typeof AI_TEAMMATE_DEFAULT_ROLE

export type AiTeammateIdentity = {
  organizationId: string | null
  name: string
  role: AiTeammateIdentityRole
  source: AiTeammateIdentitySource
  onboardingCompleted: boolean
  updatedByUserId?: string | null
  updatedAt?: string | null
}

export type AiTeammateIdentityPatch = {
  name?: string
  onboardingCompleted?: boolean
}

export type AiTeammateIdentityApiResponse = {
  ok: boolean
  qa_marker: string
  identity: AiTeammateIdentity
  persisted: boolean
  message?: string
  error?: string
}
