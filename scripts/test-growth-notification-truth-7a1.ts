/**
 * GS-GROWTH-OPS-7A.1 — Operator notification deep-link truth certification.
 * Run: pnpm test:growth-notification-truth-7a1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OPERATOR_NOTIFICATION_LINKS_QA_MARKER,
  growthOperatorFollowUpNotificationHref,
  growthOperatorOpportunityNotificationHref,
} from "../lib/growth/notifications/growth-operator-notification-links"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoAdminOperatorUrls(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\/admin\/growth\/leads/, `${relativePath} must not use admin lead URLs`)
  assert.doesNotMatch(
    source,
    /\/admin\/growth\/opportunities\/pipeline/,
    `${relativePath} must not use admin opportunity pipeline URLs`,
  )
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.1 Notification Truth Certification ===\n")
  assert.ok(GROWTH_OPERATOR_NOTIFICATION_LINKS_QA_MARKER)

  const operatorServices = [
    "lib/growth/notifications/notification-integrations.ts",
    "lib/growth/deal-intelligence/deal-intelligence-notification-integrations.ts",
    "lib/growth/revenue-operating/revenue-notification-integrations.ts",
    "lib/growth/human-execution/human-execution-notifications.ts",
    "lib/growth/meeting-intelligence/meeting-intelligence-notifications.ts",
    "lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-notifications.ts",
    "lib/growth/calendar/google-calendar-client.ts",
    "lib/growth/cadence/cadence-channel-engine.ts",
    "lib/growth/browser-intake/build-browser-intake-crm-context.ts",
    "lib/growth/outbound-launch/outbound-launch-motion.ts",
    "lib/growth/human-interventions/human-intervention-engine.ts",
    "lib/growth/aiden/aiden-revenue-journey-tracker.ts",
  ]

  for (const file of operatorServices) {
    assertNoAdminOperatorUrls(file)
  }
  console.log("  ✓ operator notification services avoid admin lead/pipeline URLs")

  const notificationIntegrations = readSource("lib/growth/notifications/notification-integrations.ts")
  assert.match(notificationIntegrations, /growthOperatorOpportunityNotificationHref/)
  assert.match(notificationIntegrations, /growthOperatorFollowUpNotificationHref/)
  assert.match(notificationIntegrations, /\/admin\/growth\/ownership/)
  assert.match(notificationIntegrations, /\/admin\/growth\/sequences\/execution/)
  console.log("  ✓ opportunity/follow-up notifications use workspace builders; control-plane URLs retained")

  const dealIntelligence = readSource("lib/growth/deal-intelligence/deal-intelligence-notification-integrations.ts")
  assert.match(dealIntelligence, /growthOperatorOpportunityNotificationHref/)
  console.log("  ✓ deal intelligence notifications route to workspace pipeline")

  const revenueOperating = readSource("lib/growth/revenue-operating/revenue-notification-integrations.ts")
  assert.match(revenueOperating, /growthOperatorOpportunityNotificationHref/)
  assert.match(revenueOperating, /\/admin\/growth\/revenue-operating/)
  console.log("  ✓ revenue operating deal alerts use workspace pipeline; aggregate dashboards stay admin")

  assert.match(growthOperatorOpportunityNotificationHref({ opportunityId: "opp-1" }), /\/growth\/opportunities\/pipeline\?opportunityId=opp-1/)
  assert.match(growthOperatorFollowUpNotificationHref("lead-1"), /\/growth\/activity\?/)
  console.log("  ✓ notification link builders resolve workspace routes")

  console.log("\nGS-GROWTH-OPS-7A.1 notification truth certification passed.\n")
}

main()
