/**
 * GE-AI-UX-3A — AI Teammate identity (presentation-only, client-safe).
 * Platform: Equipify AI OS. Teammate: default Ava, customer-renamable.
 */

export const GE_AI_UX_3A_QA_MARKER = "ge-ai-ux-3a-ai-teammate-identity-foundation-v1" as const

export const AI_TEAMMATE_DEFAULT_NAME = "Ava" as const

export const AI_TEAMMATE_DEFAULT_ROLE = "Equipify's AI Growth Operator" as const

export const AI_TEAMMATE_FUTURE_ROLE = "Your AI Business Operator" as const

export const AI_TEAMMATE_IDENTITY_STORAGE_KEY = "equipify:ai-os:teammate-identity/v1" as const

export const AI_TEAMMATE_ONBOARDING_STORAGE_KEY = "equipify:ai-os:teammate-onboarding/v1" as const

export const AI_TEAMMATE_NAME_MIN_LENGTH = 2 as const
export const AI_TEAMMATE_NAME_MAX_LENGTH = 32 as const

export const AI_TEAMMATE_SUGGESTED_NAMES = [
  "Ava",
  "Emma",
  "Claire",
  "Nora",
  "Alex",
  "Jordan",
  "Charlie",
  "Scout",
  "Atlas",
] as const

export type AiTeammateSubjectPronoun = "She" | "He" | "They"

export type AiTeammatePresentation = {
  name: string
  role: string
  subjectPronoun: AiTeammateSubjectPronoun
  objectPronoun: "her" | "him" | "them"
  possessivePronoun: "her" | "his" | "their"
}

export type AiTeammateStoredIdentity = {
  name: string
  onboardingCompleted: boolean
}

const SHE_PRONOUN_NAMES = new Set(["ava", "emma", "claire", "nora"])
const THEY_PRONOUN_NAMES = new Set(["alex", "jordan", "charlie", "scout", "atlas"])

export function normalizeAiTeammateName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return AI_TEAMMATE_DEFAULT_NAME
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function isValidAiTeammateName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < AI_TEAMMATE_NAME_MIN_LENGTH || trimmed.length > AI_TEAMMATE_NAME_MAX_LENGTH) {
    return false
  }
  return /^[\p{L}\p{N}][\p{L}\p{N}' -]*[\p{L}\p{N}]$|^[\p{L}\p{N}]$/u.test(trimmed)
}

export function resolveAiTeammatePronouns(name: string): Pick<
  AiTeammatePresentation,
  "subjectPronoun" | "objectPronoun" | "possessivePronoun"
> {
  const lower = name.trim().toLowerCase()
  if (SHE_PRONOUN_NAMES.has(lower)) {
    return { subjectPronoun: "She", objectPronoun: "her", possessivePronoun: "her" }
  }
  if (THEY_PRONOUN_NAMES.has(lower)) {
    return { subjectPronoun: "They", objectPronoun: "them", possessivePronoun: "their" }
  }
  return { subjectPronoun: "They", objectPronoun: "them", possessivePronoun: "their" }
}

export function resolveAiTeammatePresentation(name?: string | null): AiTeammatePresentation {
  const resolvedName = normalizeAiTeammateName(name?.trim() || AI_TEAMMATE_DEFAULT_NAME)
  return {
    name: resolvedName,
    role: AI_TEAMMATE_DEFAULT_ROLE,
    ...resolveAiTeammatePronouns(resolvedName),
  }
}

export function sanitizeAiTeammateName(raw: string): string {
  const normalized = normalizeAiTeammateName(raw)
  return isValidAiTeammateName(normalized) ? normalized : AI_TEAMMATE_DEFAULT_NAME
}

export function readAiTeammateStoredIdentity(): AiTeammateStoredIdentity {
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

export function writeAiTeammateStoredIdentity(next: AiTeammateStoredIdentity): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AI_TEAMMATE_IDENTITY_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
