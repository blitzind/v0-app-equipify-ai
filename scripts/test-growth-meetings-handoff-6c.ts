/**
 * GS-GROWTH-OPS-6C — Meetings operator handoff certification.
 * Run: pnpm test:growth-meetings-handoff-6c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadHref,
  buildGrowthMeetingsHref,
  GROWTH_OPS_HANDOFF_6C_QA_MARKER,
} from "../lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_MEETING_OPERATOR_HANDOFF_PANEL_QA_MARKER } from "../components/growth/growth-meeting-operator-handoff-panel"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6C Meetings Handoff Certification ===\n")
  assert.ok(GROWTH_OPS_HANDOFF_6C_QA_MARKER)
  assert.ok(GROWTH_MEETING_OPERATOR_HANDOFF_PANEL_QA_MARKER)

  const leadId = "550e8400-e29b-41d4-a716-446655440000"
  const meetingId = "660e8400-e29b-41d4-a716-446655440001"
  assert.match(buildGrowthMeetingsHref({ leadId, meetingId }), /\/growth\/meetings\?/)
  assert.match(buildGrowthLeadHref(leadId, { focus: "meetings", highlight: meetingId }), /\/growth\/leads\/crm\?/)
  console.log("  ✓ meetings deep-link builders")

  const dashboard = readSource("components/growth/growth-meeting-intelligence-dashboard.tsx")
  assert.match(dashboard, /GrowthMeetingOperatorHandoffPanel/)
  assert.match(dashboard, /GrowthMeetingPrepPanel/)
  assert.match(dashboard, /buildGrowthLeadHref/)
  assert.doesNotMatch(dashboard, /\/admin\/growth\/leads/)
  console.log("  ✓ meetings dashboard surfaces prep + operator handoff panel")

  const handoffPanel = readSource("components/growth/growth-meeting-operator-handoff-panel.tsx")
  assert.match(handoffPanel, /Save outcome/)
  assert.match(handoffPanel, /GrowthPersonalizationEmbeddedPanel/)
  assert.match(handoffPanel, /buildGrowthActivityHref/)
  assert.match(handoffPanel, /buildGrowthOpportunityHref/)
  assert.match(handoffPanel, /GrowthNextBestActionBanner/)
  console.log("  ✓ handoff panel includes personalization, outcome capture, and shortcuts")

  console.log("\nGS-GROWTH-OPS-6C meetings handoff certification passed.\n")
}

main()
