/**
 * GS-GROWTH-SETTINGS-8D — Customer access, onboarding, and workspace wiring certification.
 * Run: pnpm test:growth-communications-settings-8d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
  growthCommunicationsWarmupHref,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES } from "../lib/growth/provider-setup/provider-setup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER, "growth-communications-settings-8k-v1")

  const apiAccessSource = readSource("lib/growth/settings/growth-workspace-settings-api-access.ts")
  assert.match(apiAccessSource, /growth-workspace-settings-api-access-8h-v1/)

  const pageAccessSource = readSource("lib/growth/settings/growth-workspace-settings-page-access.ts")
  assert.match(pageAccessSource, /growth-workspace-settings-page-access-8h-v1/)

  const workspaceRoutes = [
    "app/(growth)/growth/settings/communications/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/onboard/page.tsx",
    "app/(growth)/growth/settings/communications/sending-domains/page.tsx",
    "app/(growth)/growth/settings/communications/deliverability/page.tsx",
    "app/(growth)/growth/settings/communications/warmup/page.tsx",
    "app/(growth)/growth/settings/communications/sender-pools/page.tsx",
    "app/(growth)/growth/settings/communications/reputation/page.tsx",
  ]
  for (const route of workspaceRoutes) {
    assert.ok(fs.existsSync(route), `missing workspace route ${route}`)
  }

  const adminFallbacks = [
    "app/(admin)/admin/growth/infrastructure/mailboxes/page.tsx",
    "app/(admin)/admin/growth/infrastructure/mailboxes/onboard/page.tsx",
    "app/(admin)/admin/growth/infrastructure/warmup/page.tsx",
    "app/(admin)/admin/growth/infrastructure/deliverability/page.tsx",
    "app/(admin)/admin/growth/deliverability/page.tsx",
    "app/(admin)/admin/growth/providers/sender-pools/page.tsx",
  ]
  for (const route of adminFallbacks) {
    assert.ok(fs.existsSync(route), `missing admin fallback route ${route}`)
  }

  const deliveryRedirect = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(deliveryRedirect, /redirect/)
  assert.match(deliveryRedirect, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  const connectedRedirect = readSource("app/(growth)/growth/settings/connected-mailboxes/page.tsx")
  assert.match(connectedRedirect, /redirect/)

  const growthLayout = readSource("app/(growth)/layout.tsx")
  assert.match(growthLayout, /loadPlatformAdminIdentity\(\)/)
  assert.match(growthLayout, /resolveGrowthWorkspaceSettingsPageAccess/)
  assert.match(growthLayout, /isGrowthCommunicationsSettingsPath/)

  const onboardPage = readSource("app/(growth)/growth/settings/communications/mailboxes/onboard/page.tsx")
  assert.match(onboardPage, /GrowthMailboxOnboardingWizard/)
  assert.match(onboardPage, /GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedDashboard, /GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH/)

  const warmupPanel = readSource("components/growth/growth-warmup-dashboard.tsx")
  assert.match(warmupPanel, /useSearchParams/)
  assert.match(warmupPanel, /deepLinkSenderId/)
  assert.match(warmupPanel, /Start Warmup for this sender/)

  const operatorDashboardApi = readSource("app/api/platform/growth/mailboxes/operator-dashboard/route.ts")
  assert.match(operatorDashboardApi, /requireGrowthCommunicationsSettingsAccess/)

  const warmupApi = readSource("app/api/platform/growth/warmup/route.ts")
  assert.match(warmupApi, /requireGrowthCommunicationsSettingsAccess/)

  assert.ok(GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES.includes("/growth/settings/communications"))

  assert.equal(GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH, "/growth/settings/communications/mailboxes/onboard")
  assert.equal(
    growthCommunicationsWarmupHref("sender-id"),
    "/settings/growth-engine/warmup?sender=sender-id",
  )

  const aidenGuide = readSource("lib/growth/aiden/operator-guide.ts")
  assert.match(aidenGuide, /\/growth\/settings\/communications/)
  assert.doesNotMatch(aidenGuide, /\/growth\/settings\/delivery/)

  const outboundOps = readSource("components/growth/growth-outbound-operations-dashboard.tsx")
  assert.match(outboundOps, /\/growth\/settings\/communications/)
  assert.doesNotMatch(outboundOps, /\/growth\/settings\/delivery/)

  const navigationDestinations = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navigationDestinations, /\/admin\/growth\/infrastructure\/mailboxes/)

  console.log("growth-communications-settings-8d: ok")
}

main()
