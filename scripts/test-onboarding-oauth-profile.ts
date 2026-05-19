import assert from "node:assert/strict"
import type { User } from "@supabase/supabase-js"
import {
  buildOnboardingOAuthCallbackUrl,
  buildOnboardingOAuthReturnPath,
  isGoogleOAuthUser,
  isOnboardingAccountStepSatisfied,
  onboardingStepFromQuery,
  parseOAuthProfileFromUser,
  splitFullName,
} from "../lib/onboarding/oauth-profile"

assert.deepEqual(splitFullName("Josh Smith"), { firstName: "Josh", lastName: "Smith" })
assert.deepEqual(splitFullName("Madonna"), { firstName: "Madonna", lastName: "" })

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
const parsed = parseOAuthProfileFromUser(googleUser)
assert.equal(parsed.email, "josh@example.com")
assert.equal(parsed.firstName, "Josh")
assert.equal(parsed.lastName, "Smith")
assert.equal(parsed.avatarUrl, "https://example.com/avatar.jpg")

const nameOnlyUser = {
  id: "user-2",
  email: "alex@example.com",
  app_metadata: {},
  user_metadata: { full_name: "Alex Johnson" },
  identities: [{ provider: "google" }],
} as unknown as User

const parsedNameOnly = parseOAuthProfileFromUser(nameOnlyUser)
assert.equal(parsedNameOnly.firstName, "Alex")
assert.equal(parsedNameOnly.lastName, "Johnson")

const returnPath = buildOnboardingOAuthReturnPath(
  new URLSearchParams("plan=growth&firstName=Josh&email=josh@example.com"),
)
assert.match(returnPath, /^\/onboarding\?/)
assert.match(returnPath, /step=workspace/)
assert.match(returnPath, /plan=growth/)

const callbackUrl = buildOnboardingOAuthCallbackUrl("http://localhost:3000", returnPath)
assert.match(callbackUrl, /^http:\/\/localhost:3000\/auth\/callback\?next=/)

assert.equal(onboardingStepFromQuery("workspace"), 1)
assert.equal(onboardingStepFromQuery(null), null)

assert.equal(
  isOnboardingAccountStepSatisfied({
    firstName: "Josh",
    lastName: "Smith",
    email: "josh@example.com",
    oauthAuthenticated: true,
    password: "",
  }),
  true,
)
assert.equal(
  isOnboardingAccountStepSatisfied({
    firstName: "Josh",
    lastName: "Smith",
    email: "josh@example.com",
    oauthAuthenticated: false,
    password: "",
  }),
  false,
)

console.log("test-onboarding-oauth-profile: ok")
