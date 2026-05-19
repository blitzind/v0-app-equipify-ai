import type { User } from "@supabase/supabase-js"
import type { EquipifyOAuthProvider } from "@/lib/auth/supabase-oauth"
import {
  LOGIN_OAUTH_ERROR_MESSAGE,
  ONBOARDING_OAUTH_ERROR_MESSAGE,
  ONBOARDING_OAUTH_START_ERROR_MESSAGE,
} from "@/lib/auth/supabase-oauth"

export type ParsedOAuthProfile = {
  email: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
}

export {
  LOGIN_OAUTH_ERROR_MESSAGE,
  ONBOARDING_OAUTH_ERROR_MESSAGE,
  ONBOARDING_OAUTH_START_ERROR_MESSAGE,
}

export const ONBOARDING_OAUTH_SESSION_STORAGE_KEY = "equipify.onboarding.oauthReturn"

export function isGoogleOAuthUser(user: User): boolean {
  return isOAuthProviderUser(user, "google")
}

export function isAppleOAuthUser(user: User): boolean {
  return isOAuthProviderUser(user, "apple")
}

export function isOAuthProviderUser(user: User, provider: EquipifyOAuthProvider): boolean {
  if (user.app_metadata?.provider === provider) return true
  return user.identities?.some((identity) => identity.provider === provider) ?? false
}

export function isSocialOAuthUser(user: User): boolean {
  return isGoogleOAuthUser(user) || isAppleOAuthUser(user)
}

export function detectOAuthProviderFromUser(user: User): EquipifyOAuthProvider | null {
  if (isAppleOAuthUser(user)) return "apple"
  if (isGoogleOAuthUser(user)) return "google"
  return null
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function readAppleNameFromMetadata(meta: Record<string, unknown>): {
  firstName: string
  lastName: string
} {
  const rawName = meta.name
  if (rawName && typeof rawName === "object" && !Array.isArray(rawName)) {
    const nameObj = rawName as Record<string, unknown>
    const firstName = String(nameObj.firstName ?? nameObj.givenName ?? "").trim()
    const lastName = String(nameObj.lastName ?? nameObj.familyName ?? "").trim()
    if (firstName || lastName) return { firstName, lastName }
  }

  return { firstName: "", lastName: "" }
}

export function parseOAuthProfileFromUser(user: User): ParsedOAuthProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const email = (user.email ?? String(meta.email ?? "")).trim().toLowerCase()

  let firstName = String(meta.given_name ?? meta.first_name ?? "").trim()
  let lastName = String(meta.family_name ?? meta.last_name ?? "").trim()

  if (!firstName && !lastName) {
    const appleName = readAppleNameFromMetadata(meta)
    firstName = appleName.firstName
    lastName = appleName.lastName
  }

  if (!firstName && !lastName) {
    const split = splitFullName(String(meta.full_name ?? meta.name ?? "").trim())
    firstName = split.firstName
    lastName = split.lastName
  }

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(meta.full_name ?? (typeof meta.name === "string" ? meta.name : "") ?? "").trim()

  const avatarUrl = String(meta.avatar_url ?? meta.picture ?? "").trim() || null

  return { email, firstName, lastName, fullName, avatarUrl }
}

/** Preserve onboarding marketing/invite query params when returning from OAuth. */
export function buildOnboardingOAuthReturnPath(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.set("step", "workspace")
  params.delete("error")
  return `/onboarding?${params.toString()}`
}

export function buildOnboardingOAuthCallbackUrl(origin: string, returnPath: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(returnPath)}`
}

export function onboardingStepFromQuery(stepParam: string | null): number | null {
  if (stepParam === "workspace") return 1
  return null
}

export function isOnboardingAccountStepSatisfied(args: {
  firstName: string
  lastName: string
  email: string
  oauthAuthenticated: boolean
  password: string
}): boolean {
  if (!args.email.trim()) return false
  if (args.oauthAuthenticated) return true
  if (!args.firstName.trim() || !args.lastName.trim()) return false
  return Boolean(args.password.trim())
}
