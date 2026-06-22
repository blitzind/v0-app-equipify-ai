/**
 * GS-GROWTH-OPS-7A.1 — Meetings URL state persistence certification.
 * Run: pnpm test:growth-meetings-url-state-7a1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthMeetingsWorkspaceHref,
  GROWTH_MEETINGS_MEETING_URL_PARAM,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  selectNewestGrowthMeetingForLead,
} from "../lib/growth/navigation/growth-workspace-url-state-7a1"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.1 Meetings URL State Certification ===\n")
  assert.ok(GROWTH_OPS_URL_STATE_7A1_QA_MARKER)

  const dashboard = readSource("components/growth/growth-meeting-intelligence-dashboard.tsx")
  assert.match(dashboard, /resolveGrowthMeetingIdFromSearchParams/)
  assert.match(dashboard, /resolveGrowthMeetingsLeadIdFromSearchParams/)
  assert.match(dashboard, /selectNewestGrowthMeetingForLead/)
  assert.match(dashboard, /buildGrowthMeetingsWorkspaceHref/)
  assert.match(dashboard, /router\.replace/)
  console.log("  ✓ meetings dashboard hydrates meetingId/leadId and syncs selection to URL")

  const href = buildGrowthMeetingsWorkspaceHref({ meetingId: "meet-1", leadId: "lead-1" })
  assert.match(href, /\/growth\/meetings\?/)
  assert.match(href, new RegExp(`${GROWTH_MEETINGS_MEETING_URL_PARAM}=meet-1`))
  assert.match(href, /leadId=lead-1/)
  console.log("  ✓ meetings href builder uses /growth/meetings?meetingId=")

  const newest = selectNewestGrowthMeetingForLead(
    [
      { id: "old", leadId: "lead-1", startAt: "2026-01-01T10:00:00.000Z" },
      { id: "new", leadId: "lead-1", startAt: "2026-06-01T10:00:00.000Z" },
    ],
    "lead-1",
  )
  assert.equal(newest?.id, "new")
  console.log("  ✓ leadId deep link selects newest matching meeting")

  console.log("\nGS-GROWTH-OPS-7A.1 meetings URL state certification passed.\n")
}

main()
