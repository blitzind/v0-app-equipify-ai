import type { User } from "@supabase/supabase-js"

export type ParsedOAuthProfile = {
  email: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
}

export const ONBOARDING_OAUTH_ERROR_MESSAGE =
  "Google sign-in could not be completed. Try again or continue with email."

export const ONBOARDING_OAUTH_START_ERROR_MESSAGE =
  "Unable to start Google sign-in. Try again or continue with email."

export const ONBOARDING_OAUTH_SESSION_STORAGE_KEY = "equipify.onboarding.oauthReturn"

export function isGoogleOAuthUser(user: User): boolean {
  if (user.app_metadata?.provider === "google") return true
  return user.identities?.some((identity) => identity.provider === "google") ?? false
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

export function parseOAuthProfileFromUser(user: User): ParsedOAuthProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const email = (user.email ?? String(meta.email ?? "")).trim().toLowerCase()

  let firstName = String(meta.given_name ?? meta.first_name ?? "").trim()
  let lastName = String(meta.family_name ?? meta.last_name ?? "").trim()

  if (!firstName && !lastName) {
    const split = splitFullName(String(meta.full_name ?? meta.name ?? "").trim())
    firstName = split.firstName
    lastName = split.lastName
  }

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(meta.full_name ?? meta.name ?? "").trim()

  const avatarUrl = String(meta.avatar_url ?? meta.picture ?? "").trim() || null

  return { email, firstName, lastName, fullName, avatarUrl }
}

/** Preserve onboarding marketing/invite query params when returning from Google OAuth. */
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
  if (!args.firstName.trim() || !args.lastName.trim() || !args.email.trim()) return false
  if (args.oauthAuthenticated) return true
  return Boolean(args.password.trim())
}
