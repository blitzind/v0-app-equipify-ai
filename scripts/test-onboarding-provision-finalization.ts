/**
 * Regression checks for onboarding finalization (sample data non-blocking + redirect).
 * Run: pnpm test:onboarding-provision-finalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  isBlockingProvisioningFailure,
  resolveOnboardingRedirectTarget,
  sampleDataWarningMessage,
} from "../lib/onboarding/provision-finalization"

assert.equal(isBlockingProvisioningFailure({ ok: false, organizationId: null }), true)
assert.equal(isBlockingProvisioningFailure({ ok: false, organizationId: "00000000-0000-4000-8000-000000000001" }), false)
assert.equal(isBlockingProvisioningFailure({ ok: true, organizationId: "00000000-0000-4000-8000-000000000001" }), false)

assert.equal(resolveOnboardingRedirectTarget({ inviteFlow: true, selectedPlanFromQuery: true, selectedPlan: "growth" }), "/")
assert.match(
  resolveOnboardingRedirectTarget({ inviteFlow: false, selectedPlanFromQuery: true, selectedPlan: "growth" }),
  /\/settings\/billing\?plan=growth/,
)
assert.equal(resolveOnboardingRedirectTarget({ inviteFlow: false, selectedPlanFromQuery: false, selectedPlan: "growth" }), "/")

assert.match(sampleDataWarningMessage("failed_non_blocking") ?? "", /Settings → Sample data/)
assert.equal(sampleDataWarningMessage("created"), null)

const errorMapping = fs.readFileSync(
  path.join(process.cwd(), "lib/onboarding/error-mapping.ts"),
  "utf8",
)
assert.doesNotMatch(errorMapping, /Please try again — your account is otherwise ready/)
assert.match(errorMapping, /Settings → Sample data/)

const provisionRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/onboarding/provision/route.ts"),
  "utf8",
)
assert.match(provisionRoute, /onboarding_completed/)
assert.match(provisionRoute, /sampleDataStatus/)
assert.match(provisionRoute, /demo_seed_failed_non_blocking/)
assert.doesNotMatch(provisionRoute, /return failure\("seed_failed"/)

const onboardingPage = fs.readFileSync(
  path.join(process.cwd(), "app/(auth)/onboarding/page.tsx"),
  "utf8",
)
assert.match(onboardingPage, /isBlockingProvisioningFailure/)
assert.match(onboardingPage, /window\.location\.assign/)
assert.match(onboardingPage, /refreshSession/)
assert.match(onboardingPage, /redirectScheduled/)
assert.match(onboardingPage, /Finishing setup/)
assert.match(onboardingPage, /disabled=\{isSubmitting\}/)

console.log("onboarding-provision-finalization checks passed")
