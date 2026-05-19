import assert from "node:assert/strict"
import type { User } from "@supabase/supabase-js"
import {
  buildLoginOAuthCallbackUrl,
  oauthProviderLabel,
  onboardingOAuthSignedInLabel,
} from "../lib/auth/supabase-oauth"
import {
  buildOnboardingOAuthCallbackUrl,
  buildOnboardingOAuthReturnPath,
  detectOAuthProviderFromUser,
  isAppleOAuthUser,
  isGoogleOAuthUser,
  isOnboardingAccountStepSatisfied,
  isSocialOAuthUser,
  onboardingStepFromQuery,
  parseOAuthProfileFromUser,
  splitFullName,
} from "../lib/onboarding/oauth-profile"

assert.equal(oauthProviderLabel("apple"), "Apple")
assert.equal(onboardingOAuthSignedInLabel("apple"), "Signed in with Apple")
assert.equal(buildLoginOAuthCallbackUrl("http://localhost:3000"), "http://localhost:3000/auth/callback")

assert.deepEqual(splitFullName("Josh Smith"), { firstName: "Josh", lastName: "Smith" })

const googleUser = {
  id: "user-1",
  email: "josh@example.com",
  app_metadata: { provider: "google" },
  user_metadata: {
    given_name: "Josh",
    family_name: "Smith",
    picture: "https://example.com/avatar.jpg",
  },
  identities: [{ provider: "google" }],
} as unknown as User

assert.equal(isGoogleOAuthUser(googleUser), true)
assert.equal(isSocialOAuthUser(googleUser), true)
assert.equal(detectOAuthProviderFromUser(googleUser), "google")

const appleUser = {
  id: "user-apple",
  email: "apple@example.com",
  app_metadata: { provider: "apple" },
  user_metadata: {
    name: { firstName: "Taylor", lastName: "Reed" },
    email: "apple@example.com",
  },
  identities: [{ provider: "apple" }],
} as unknown as User

assert.equal(isAppleOAuthUser(appleUser), true)
assert.equal(detectOAuthProviderFromUser(appleUser), "apple")
const parsedApple = parseOAuthProfileFromUser(appleUser)
assert.equal(parsedApple.firstName, "Taylor")
assert.equal(parsedApple.lastName, "Reed")
assert.equal(parsedApple.email, "apple@example.com")

const appleEmailOnly = {
  id: "user-apple-2",
  email: "relay@privaterelay.appleid.com",
  app_metadata: { provider: "apple" },
  user_metadata: {},
  identities: [{ provider: "apple" }],
} as unknown as User

const parsedAppleEmailOnly = parseOAuthProfileFromUser(appleEmailOnly)
assert.equal(parsedAppleEmailOnly.email, "relay@privaterelay.appleid.com")
assert.equal(parsedAppleEmailOnly.firstName, "")
assert.equal(parsedAppleEmailOnly.lastName, "")

const returnPath = buildOnboardingOAuthReturnPath(
  new URLSearchParams("plan=growth&firstName=Josh&email=josh@example.com"),
)
assert.match(returnPath, /step=workspace/)

const callbackUrl = buildOnboardingOAuthCallbackUrl("http://localhost:3000", returnPath)
assert.match(callbackUrl, /^http:\/\/localhost:3000\/auth\/callback\?next=/)

assert.equal(onboardingStepFromQuery("workspace"), 1)

assert.equal(
  isOnboardingAccountStepSatisfied({
    firstName: "",
    lastName: "",
    email: "relay@privaterelay.appleid.com",
    oauthAuthenticated: true,
    password: "",
  }),
  true,
)

console.log("test-onboarding-oauth-profile: ok")
