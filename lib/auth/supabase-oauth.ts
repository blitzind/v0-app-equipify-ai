export type EquipifyOAuthProvider = "google" | "apple"

export const LOGIN_OAUTH_ERROR_MESSAGE =
  "Sign-in could not be completed. Try again or use your email and password."

export const ONBOARDING_OAUTH_ERROR_MESSAGE =
  "Sign-in could not be completed. Try again or continue with email."

export const ONBOARDING_OAUTH_START_ERROR_MESSAGE =
  "Unable to start sign-in. Try again or continue with email."

export function oauthProviderLabel(provider: EquipifyOAuthProvider): string {
  return provider === "google" ? "Google" : "Apple"
}

export function buildLoginOAuthCallbackUrl(origin: string): string {
  return `${origin}/auth/callback`
}

export function onboardingOAuthRedirectMessage(provider: EquipifyOAuthProvider): string {
  return `Redirecting to ${oauthProviderLabel(provider)}…`
}

export function onboardingOAuthSignedInLabel(provider: EquipifyOAuthProvider | null): string {
  if (provider === "apple") return "Signed in with Apple"
  if (provider === "google") return "Signed in with Google"
  return "Signed in"
}

export const ONBOARDING_OAUTH_PROVIDER_STORAGE_KEY = "equipify.onboarding.oauthProvider"

export function readStoredOnboardingOAuthProvider(): EquipifyOAuthProvider | null {
  if (typeof window === "undefined") return null
  try {
    const value = sessionStorage.getItem(ONBOARDING_OAUTH_PROVIDER_STORAGE_KEY)
    return value === "google" || value === "apple" ? value : null
  } catch {
    return null
  }
}

export function storeOnboardingOAuthProvider(provider: EquipifyOAuthProvider): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(ONBOARDING_OAUTH_PROVIDER_STORAGE_KEY, provider)
  } catch {
    /* ignore */
  }
}

export function clearStoredOnboardingOAuthProvider(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(ONBOARDING_OAUTH_PROVIDER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
