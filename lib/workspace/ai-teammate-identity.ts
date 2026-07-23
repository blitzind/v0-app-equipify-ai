/**
 * GE-AI-UX-3A — AI Teammate identity (presentation-only, client-safe).
 * Delegates to @fuzor/identity; Equipify import paths and aliases preserved.
 */

import {
  PLATFORM_PERSONA_DEFAULT_NAME,
  PLATFORM_PERSONA_DEFAULT_ROLE,
  PLATFORM_PERSONA_FUTURE_ROLE,
  PLATFORM_PERSONA_IDENTITY_STORAGE_KEY,
  PLATFORM_PERSONA_NAME_MAX_LENGTH,
  PLATFORM_PERSONA_NAME_MIN_LENGTH,
  PLATFORM_PERSONA_ONBOARDING_STORAGE_KEY,
  PLATFORM_PERSONA_PRESENTATION_QA_MARKER,
  PLATFORM_PERSONA_SUGGESTED_NAMES,
  isValidPlatformPersonaName,
  normalizePlatformPersonaName,
  readPlatformPersonaStoredIdentity,
  resolvePlatformPersonaPresentation,
  resolvePlatformPersonaPronouns,
  sanitizePlatformPersonaName,
  writePlatformPersonaStoredIdentity,
  type PlatformPersonaPresentation,
  type PlatformPersonaStoredIdentity,
  type PlatformPersonaSubjectPronoun,
} from "@fuzor/identity"

export const GE_AI_UX_3A_QA_MARKER = PLATFORM_PERSONA_PRESENTATION_QA_MARKER

export const AI_TEAMMATE_DEFAULT_NAME = PLATFORM_PERSONA_DEFAULT_NAME

export const AI_TEAMMATE_DEFAULT_ROLE = PLATFORM_PERSONA_DEFAULT_ROLE

export const AI_TEAMMATE_FUTURE_ROLE = PLATFORM_PERSONA_FUTURE_ROLE

export const AI_TEAMMATE_IDENTITY_STORAGE_KEY = PLATFORM_PERSONA_IDENTITY_STORAGE_KEY

export const AI_TEAMMATE_ONBOARDING_STORAGE_KEY = PLATFORM_PERSONA_ONBOARDING_STORAGE_KEY

export const AI_TEAMMATE_NAME_MIN_LENGTH = PLATFORM_PERSONA_NAME_MIN_LENGTH

export const AI_TEAMMATE_NAME_MAX_LENGTH = PLATFORM_PERSONA_NAME_MAX_LENGTH

export const AI_TEAMMATE_SUGGESTED_NAMES = PLATFORM_PERSONA_SUGGESTED_NAMES

export type AiTeammateSubjectPronoun = PlatformPersonaSubjectPronoun

export type AiTeammatePresentation = PlatformPersonaPresentation

export type AiTeammateStoredIdentity = PlatformPersonaStoredIdentity

export const normalizeAiTeammateName = normalizePlatformPersonaName

export const isValidAiTeammateName = isValidPlatformPersonaName

export const resolveAiTeammatePronouns = resolvePlatformPersonaPronouns

export const resolveAiTeammatePresentation = resolvePlatformPersonaPresentation

export const sanitizeAiTeammateName = sanitizePlatformPersonaName

function readLegacyUnscopedAiTeammateStoredIdentity(): AiTeammateStoredIdentity {
  if (typeof window === "undefined") {
    return { name: AI_TEAMMATE_DEFAULT_NAME, onboardingCompleted: false }
  }
  try {
    const raw = window.localStorage.getItem(AI_TEAMMATE_IDENTITY_STORAGE_KEY)
    if (!raw) {
      return { name: AI_TEAMMATE_DEFAULT_NAME, onboardingCompleted: false }
    }
    const parsed = JSON.parse(raw) as Partial<AiTeammateStoredIdentity>
    const name = normalizeAiTeammateName(parsed.name ?? AI_TEAMMATE_DEFAULT_NAME)
    return {
      name: isValidAiTeammateName(name) ? name : AI_TEAMMATE_DEFAULT_NAME,
      onboardingCompleted: parsed.onboardingCompleted === true,
    }
  } catch {
    return { name: AI_TEAMMATE_DEFAULT_NAME, onboardingCompleted: false }
  }
}

/** Reads org-scoped storage when organizationId is known; legacy unscoped key before org hydration. */
export function readAiTeammateStoredIdentity(organizationId?: string | null): AiTeammateStoredIdentity {
  const scopedOrganizationId = organizationId?.trim()
  if (scopedOrganizationId) {
    return readPlatformPersonaStoredIdentity(scopedOrganizationId)
  }
  return readLegacyUnscopedAiTeammateStoredIdentity()
}

/** Writes org-scoped storage when organizationId is known; legacy unscoped key before org hydration. */
export function writeAiTeammateStoredIdentity(
  next: AiTeammateStoredIdentity,
  organizationId?: string | null,
): void {
  const scopedOrganizationId = organizationId?.trim()
  if (scopedOrganizationId) {
    writePlatformPersonaStoredIdentity(scopedOrganizationId, next)
    return
  }
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AI_TEAMMATE_IDENTITY_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
