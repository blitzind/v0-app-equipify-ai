/**
 * Regression checks for Inbox Assignment + Team Ownership (Phase 2K).
 * Run: pnpm test:growth-inbox-team-ownership
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeInboxThreadSlaDueAt,
  formatInboxThreadAgeLabel,
  isInboxReplyAging,
  resolveInboxThreadSlaStatus,
} from "../lib/growth/inbox-team-ownership/inbox-sla-tracker"
import {
  GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE,
  GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER,
  GROWTH_INBOX_ASSIGNMENT_RULE_TYPES,
  GROWTH_INBOX_OWNER_ACTIONS,
  GROWTH_INBOX_TEAM_QUEUE_VIEWS,
  inboxOwnerActionLabel,
  inboxTeamQueueViewLabel,
  maskInboxOwnerLabel,
} from "../lib/growth/inbox-team-ownership/inbox-team-ownership-types"
import { GROWTH_INBOX_TEAM_OWNERSHIP_SCHEMA_MIGRATION } from "../lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER, "growth-inbox-team-ownership-v1")
  assert.match(GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE, /human action/i)
  assert.match(GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE, /auto-assignment disabled/i)
  assert.equal(GROWTH_INBOX_ASSIGNMENT_RULE_TYPES.length, 4)
  assert.equal(GROWTH_INBOX_OWNER_ACTIONS.length, 4)
  assert.equal(GROWTH_INBOX_TEAM_QUEUE_VIEWS.length, 5)

  const migration = readSource(`supabase/migrations/${GROWTH_INBOX_TEAM_OWNERSHIP_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.inbox_assignment_settings/)
  assert.match(migration, /growth\.inbox_assignment_rules/)
  assert.match(migration, /growth\.inbox_thread_owner_history/)
  assert.match(migration, /auto_assign_enabled boolean not null default false/)
  assert.match(migration, /assigned_at timestamptz/)
  assert.match(migration, /sla_due_at timestamptz/)
  assert.match(migration, /thread_claimed/)
  assert.match(migration, /thread_handoff/)
  assert.match(migration, /thread_unassigned/)
  assert.match(migration, /service role only/)

  assert.equal(maskInboxOwnerLabel("abc12345-0000-0000-0000-000000000001", "Alex Rep"), "Alex Rep")
  assert.match(maskInboxOwnerLabel("abc12345-0000-0000-0000-000000000001"), /^Operator abc12345/)
  assert.equal(inboxOwnerActionLabel("handoff"), "handoff")
  assert.equal(inboxTeamQueueViewLabel("sla_risk"), "SLA Risk")

  const anchor = new Date("2026-01-01T12:00:00.000Z").toISOString()
  const dueCritical = computeInboxThreadSlaDueAt(anchor, "critical")
  assert.equal(new Date(dueCritical).getTime() - new Date(anchor).getTime(), 4 * 60 * 60 * 1000)
  assert.equal(resolveInboxThreadSlaStatus(dueCritical, new Date("2026-01-01T16:01:00.000Z").getTime()), "overdue")
  assert.equal(resolveInboxThreadSlaStatus(dueCritical, new Date("2026-01-01T15:30:00.000Z").getTime()), "at_risk")
  assert.equal(isInboxReplyAging("2026-01-01T00:00:00.000Z", new Date("2026-01-02T01:00:00.000Z").getTime()), true)
  assert.equal(formatInboxThreadAgeLabel(null), "—")

  const ownershipRepo = readSource("lib/growth/inbox-team-ownership/inbox-thread-ownership-repository.ts")
  assert.match(ownershipRepo, /claimInboxThread/)
  assert.match(ownershipRepo, /handoffInboxThread/)
  assert.match(ownershipRepo, /unassignInboxThread/)
  assert.match(ownershipRepo, /assignInboxThreadToUser/)
  assert.match(ownershipRepo, /insertInboxThreadOwnerHistory/)
  assert.doesNotMatch(ownershipRepo, /executeTransportSend|autoReply|auto_assign/i)

  const approveBlock = ownershipRepo
  assert.doesNotMatch(approveBlock, /executeTransportSend/)

  const suggestionSource = readSource("lib/growth/inbox-team-ownership/inbox-owner-suggestion.ts")
  assert.match(suggestionSource, /suggestInboxThreadOwner/)
  assert.match(suggestionSource, /lead_owner/)
  assert.match(suggestionSource, /round_robin/)
  assert.doesNotMatch(suggestionSource, /openai|anthropic|runAiTask/i)

  const rulesRepo = readSource("lib/growth/inbox-team-ownership/inbox-assignment-rules-repository.ts")
  assert.match(rulesRepo, /auto_assign_enabled/)
  assert.match(rulesRepo, /fetchInboxAssignmentSettings/)

  const dashboardSource = readSource("lib/growth/inbox-team-ownership/inbox-team-dashboard.ts")
  assert.match(dashboardSource, /fetchInboxTeamDashboard/)
  assert.match(dashboardSource, /myThreads/)
  assert.match(dashboardSource, /slaRisk/)
  assert.match(dashboardSource, /agingReplies/)

  const threadRepo = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(threadRepo, /computeInboxThreadSlaDueAt/)
  assert.match(threadRepo, /sla_due_at/)

  const claimRoute = readSource("app/api/platform/growth/inbox/thread/[id]/claim/route.ts")
  assert.match(claimRoute, /requireGrowthEnginePlatformAccess/)
  assert.match(claimRoute, /claimInboxThread/)

  const handoffRoute = readSource("app/api/platform/growth/inbox/thread/[id]/handoff/route.ts")
  assert.match(handoffRoute, /handoffNote/)
  assert.match(handoffRoute, /handoffInboxThread/)

  const unassignRoute = readSource("app/api/platform/growth/inbox/thread/[id]/unassign/route.ts")
  assert.match(unassignRoute, /unassignInboxThread/)

  const assignRoute = readSource("app/api/platform/growth/inbox/thread/[id]/assign/route.ts")
  assert.match(assignRoute, /assignInboxThreadToUser/)
  assert.doesNotMatch(assignRoute, /executeTransportSend/)

  const rulesRoute = readSource("app/api/platform/growth/inbox/assignment-rules/route.ts")
  assert.match(rulesRoute, /autoAssignEnabled/)
  assert.match(rulesRoute, /isGrowthInboxTeamOwnershipSchemaReady/)

  const teamDashboardRoute = readSource("app/api/platform/growth/inbox/team-dashboard/route.ts")
  assert.match(teamDashboardRoute, /fetchInboxTeamDashboard/)

  const panelSource = readSource("components/growth/growth-inbox-team-queue-panel.tsx")
  assert.match(panelSource, /GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER/)
  assert.match(panelSource, /Team Queue/)
  assert.match(panelSource, /My Threads/)
  assert.match(panelSource, /Unassigned/)
  assert.match(panelSource, /SLA Risk/)
  assert.match(panelSource, /Aging Replies/)
  assert.match(panelSource, /Owner History/)
  assert.match(panelSource, /Handoff notes/)
  assert.match(panelSource, /Assign Suggested Owner/)
  assert.doesNotMatch(panelSource, /api_key|password/i)

  const inboxUi = readSource("components/growth/growth-unified-inbox-dashboard.tsx")
  assert.match(inboxUi, /GrowthInboxTeamQueuePanel/)

  console.log("growth inbox team ownership tests passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
