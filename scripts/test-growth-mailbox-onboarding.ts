/**
 * Regression checks for GE-MAIL-1C Mailbox onboarding wizard.
 * Run: pnpm test:growth-mailbox-onboarding
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MAILBOX_ONBOARDING_QA_MARKER,
  GROWTH_MAILBOX_ONBOARDING_STEPS,
} from "../lib/growth/mailboxes/mailbox-onboarding-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_MAILBOX_ONBOARDING_QA_MARKER, "growth-mailbox-onboarding-1c-v1")
  assert.equal(GROWTH_MAILBOX_ONBOARDING_STEPS.length, 6)
  assert.deepEqual(GROWTH_MAILBOX_ONBOARDING_STEPS, [
    "create_sender",
    "connect_gmail",
    "validate",
    "warmup",
    "pool",
    "activation",
  ])

  const serviceSource = readSource("lib/growth/mailboxes/mailbox-onboarding-service.ts")
  assert.match(serviceSource, /buildMailboxOnboardingStatus/)
  assert.match(serviceSource, /ensureMailboxConnectionForSender/)
  assert.match(serviceSource, /finalizeMailboxOnboarding/)
  assert.match(serviceSource, /createMailboxConnection/)
  assert.match(serviceSource, /generateWarmupSchedule/)
  assert.match(serviceSource, /addSenderPoolMember/)

  const statusRoute = readSource("app/api/platform/growth/mailboxes/onboard/status/route.ts")
  assert.match(statusRoute, /buildMailboxOnboardingStatus/)

  const prepareRoute = readSource("app/api/platform/growth/mailboxes/onboard/prepare/route.ts")
  assert.match(prepareRoute, /ensureMailboxConnectionForSender/)

  const finalizeRoute = readSource("app/api/platform/growth/mailboxes/onboard/finalize/route.ts")
  assert.match(finalizeRoute, /finalizeMailboxOnboarding/)

  const wizardSource = readSource("components/growth/mailboxes/growth-mailbox-onboarding-wizard.tsx")
  assert.match(wizardSource, /GrowthMailboxOnboardingWizard/)
  assert.match(wizardSource, /Connect Google/)
  assert.match(wizardSource, /Activate sender/)
  assert.match(wizardSource, /provider-setup\/google\/start/)

  const pageSource = readSource("app/(admin)/admin/growth/infrastructure/mailboxes/onboard/page.tsx")
  assert.match(pageSource, /GrowthMailboxOnboardingWizard/)

  const catalogSource = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(catalogSource, /infrastructure\/mailboxes\/onboard/)

  console.log("growth mailbox onboarding wizard checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
