/**
 * GS-GROWTH-OPS-6C — Backend notification deep-link normalization certification.
 * Run: pnpm test:growth-notification-link-normalization-6c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoAdminLeadUrls(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\/admin\/growth\/leads/, `${relativePath} must not use admin lead URLs`)
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6C Notification Link Normalization Certification ===\n")

  const notificationServices = [
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

  for (const file of notificationServices) {
    assertNoAdminLeadUrls(file)
  }
  console.log("  ✓ operator notification services avoid admin lead URLs")

  const commandCatalog = readSource("lib/growth/command/command-action-catalog.ts")
  assert.match(commandCatalog, /buildGrowthLeadHref/)
  assert.doesNotMatch(commandCatalog, /\/admin\/growth\/leads\?/)
  console.log("  ✓ commandLeadFocusHref uses workspace lead builder")

  const enrollmentNav = readSource("lib/growth/sequence-enrollment/enrollment-navigation.ts")
  assert.match(enrollmentNav, /buildGrowthLeadHref/)
  assert.match(enrollmentNav, /\/growth\/leads\/crm/)
  assert.doesNotMatch(enrollmentNav, /\/admin\/growth\/leads\//)
  console.log("  ✓ enrollment navigation uses canonical workspace lead hrefs")

  const humanExecution = readSource("lib/growth/human-execution/human-execution-notifications.ts")
  assert.match(humanExecution, /buildGrowthCallWorkspaceHref/)
  console.log("  ✓ call-now notifications route to call workspace")

  const meetingNotifications = readSource("lib/growth/meeting-intelligence/meeting-intelligence-notifications.ts")
  assert.match(meetingNotifications, /buildGrowthMeetingsHref/)
  console.log("  ✓ meeting notifications route to /growth/meetings")

  console.log("\nGS-GROWTH-OPS-6C notification link normalization certification passed.\n")
}

main()
