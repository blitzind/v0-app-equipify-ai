/**
 * Regression checks for Unified Inbox + Reply Intelligence Foundation (Phase 2B).
 * Run: pnpm test:growth-unified-inbox
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildInboxDashboard, buildReplyIntelligenceSummary } from "../lib/growth/inbox/inbox-dashboard"
import { classifyReply, classificationLabel } from "../lib/growth/inbox/reply-classifier"
import { resolveGrowthInboxWorkspaceV2FromSearchParams } from "../lib/growth/inbox/inbox-workspace-types"
import {
  buildClassificationEvent,
  buildReplyDetectedEvent,
  buildReplyIntelligenceEvents,
  buildThreadOwnerAssignedEvent,
} from "../lib/growth/inbox/reply-event-builder"
import { extractReplySignals } from "../lib/growth/inbox/reply-signals"
import { evaluateThreadHealth } from "../lib/growth/inbox/thread-health"
import { computeThreadPriorityScore, priorityScoreToTier } from "../lib/growth/inbox/thread-priority"
import {
  GROWTH_INBOX_TIMELINE_EVENT_TYPES,
  GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER,
  GROWTH_UNIFIED_INBOX_PRIVACY_NOTE,
} from "../lib/growth/inbox/inbox-types"
import { GROWTH_UNIFIED_INBOX_SCHEMA_MIGRATION } from "../lib/growth/inbox/inbox-schema-health"

function sampleThread(overrides: Partial<{
  id: string
  classification: string
  priority_tier: string
  thread_status: string
  priority_score: number
}> = {}) {
  return {
    id: overrides.id ?? "t1",
    lead_id: "l1",
    lead_label: "Acme",
    provider_family: "custom",
    mailbox_connection_id: null,
    subject: "Re: demo",
    thread_status: (overrides.thread_status ?? "open") as "open",
    reply_count: 1,
    last_message_at: new Date().toISOString(),
    owner_user_id: null,
    owner_label: null,
    priority_score: overrides.priority_score ?? 50,
    priority_tier: (overrides.priority_tier ?? "normal") as "normal",
    classification: (overrides.classification ?? "unknown") as "unknown",
    classification_confidence: 75,
    requires_human_review: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER, "growth-unified-inbox-foundation-v1")
  assert.match(GROWTH_UNIFIED_INBOX_PRIVACY_NOTE, /no mailbox sync|manual/i)
  assert.equal(GROWTH_INBOX_TIMELINE_EVENT_TYPES.length, 12)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_UNIFIED_INBOX_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.inbox_threads/)
  assert.match(migration, /growth\.inbox_messages/)
  assert.match(migration, /growth\.reply_intelligence_events/)
  assert.match(migration, /reply_detected/)
  assert.match(migration, /thread_owner_assigned/)
  assert.match(migration, /service role only/)

  assert.equal(classifyReply({ body: "What is your pricing for this?" }).classification, "budget")
  assert.equal(classifyReply({ body: "Maybe next quarter we can revisit." }).classification, "timeline")
  assert.equal(classifyReply({ body: "Can we book a call on your calendar?" }).classification, "meeting_intent")
  assert.equal(classifyReply({ body: "We already use another vendor." }).classification, "competitor")
  assert.equal(classifyReply({ body: "Not interested, please remove me." }).classification, "unsubscribe")
  assert.equal(classifyReply({ body: "Sounds good — tell me more." }).classification, "positive_interest")
  assert.equal(classifyReply({ body: "Thanks for reaching out." }).classification, "unknown")

  assert.equal(computeThreadPriorityScore({ classification: "positive_interest" }), 80)
  assert.equal(computeThreadPriorityScore({ classification: "meeting_intent" }), 90)
  assert.equal(computeThreadPriorityScore({ classification: "budget" }), 60)
  assert.equal(computeThreadPriorityScore({ classification: "timeline" }), 60)
  assert.equal(computeThreadPriorityScore({ classification: "competitor" }), 70)
  assert.equal(computeThreadPriorityScore({ classification: "unsubscribe" }), 0)

  assert.equal(priorityScoreToTier(95), "critical")
  assert.equal(priorityScoreToTier(75), "high")
  assert.equal(priorityScoreToTier(55), "normal")
  assert.equal(priorityScoreToTier(25), "low")

  const meetingSignals = extractReplySignals({ body: "Let's schedule a meeting call" })
  assert.equal(meetingSignals.contains_meeting_language, true)

  const health = evaluateThreadHealth({
    classification: "unsubscribe",
    priority_tier: "low",
    has_owner: false,
  })
  assert.equal(health.thread_status, "needs_review")
  assert.equal(health.requires_human_review, true)

  const ownerEvent = buildThreadOwnerAssignedEvent("Acme", "Operator")
  assert.equal(ownerEvent.timeline_type, "thread_owner_assigned")
  assert.equal(ownerEvent.event_type, "thread_owner_assigned")

  const replyEvents = buildReplyIntelligenceEvents({
    leadLabel: "Acme",
    subject: "Re: pricing",
    classification: "budget",
    isInbound: true,
  })
  assert.ok(replyEvents.some((event) => event.event_type === "reply_detected"))
  assert.ok(replyEvents.some((event) => event.event_type === "budget_objection_detected"))

  assert.equal(buildReplyDetectedEvent("Acme", "Hello").timeline_type, "reply_detected")
  assert.equal(buildClassificationEvent("Acme", "meeting_intent")?.timeline_type, "meeting_interest_detected")
  assert.equal(buildClassificationEvent("Acme", "unknown"), null)

  const threads = [
    sampleThread({ id: "t1", thread_status: "open", priority_tier: "critical", classification: "meeting_intent", priority_score: 95 }),
    sampleThread({ id: "t2", thread_status: "needs_review", classification: "budget" }),
    sampleThread({ id: "t3", thread_status: "waiting", classification: "timeline" }),
    sampleThread({ id: "t4", thread_status: "open", classification: "positive_interest" }),
    sampleThread({ id: "t5", thread_status: "open", classification: "competitor" }),
    sampleThread({ id: "t6", thread_status: "needs_review", classification: "unsubscribe" }),
  ]

  const dashboard = buildInboxDashboard(threads)
  assert.equal(dashboard.qa_marker, GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER)
  assert.equal(dashboard.open_count, 3)
  assert.equal(dashboard.needs_review_count, 2)
  assert.equal(dashboard.waiting_count, 1)
  assert.equal(dashboard.critical_priority_count, 1)

  const intelligence = buildReplyIntelligenceSummary(threads)
  assert.equal(intelligence.budget, 1)
  assert.equal(intelligence.timeline, 1)
  assert.equal(intelligence.meeting_intent, 1)
  assert.equal(intelligence.positive_interest, 1)
  assert.equal(intelligence.competitor, 1)
  assert.equal(intelligence.unsubscribe, 1)

  assert.equal(classificationLabel("positive_interest"), "Positive interest")

  const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/inbox/thread-repository.ts"), "utf8")
  assert.match(repoSource, /assignThreadOwner/)
  assert.match(repoSource, /addInboxMessage/)
  assert.match(repoSource, /persistReplyEventDrafts/)
  assert.match(repoSource, /classifyReply/)
  assert.match(repoSource, /from "@\/lib\/growth\/lead-label"/)
  assert.match(repoSource, /formatLeadLabel/)
  assert.doesNotMatch(repoSource, /pollMailbox|syncMailbox|sendMail|autoReply|openai|anthropic/i)

  for (const route of [
    "app/api/platform/growth/inbox/route.ts",
    "app/api/platform/growth/inbox/dashboard/route.ts",
    "app/api/platform/growth/inbox/thread/route.ts",
    "app/api/platform/growth/inbox/thread/[id]/route.ts",
    "app/api/platform/growth/inbox/message/route.ts",
    "app/api/platform/growth/inbox/thread/[id]/assign/route.ts",
    "app/api/platform/growth/inbox/thread/[id]/resolve/route.ts",
  ]) {
    const apiSource = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
    assert.doesNotMatch(apiSource, /pollMailbox|syncMailbox|sendMail/i)
  }

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-unified-inbox-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /GrowthInboxDiagnosticsPanel/)
  assert.match(uiSource, /Threads/)
  assert.match(uiSource, /Message Viewer/)
  assert.match(uiSource, /GrowthInboxExtendedPanels/)
  assert.match(uiSource, /Assign Owner/)
  assert.match(uiSource, /GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER/)
  assert.match(uiSource, /GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER/)
  assert.match(uiSource, /GrowthInboxSetupEmptyState/)

  const extendedPanels = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-extended-panels.tsx"),
    "utf8",
  )
  assert.match(extendedPanels, /GrowthInboxWidgetErrorBoundary/)
  assert.match(extendedPanels, /GrowthInboxTeamQueuePanel/)
  assert.match(extendedPanels, /Reply Intelligence/)

  const diagnosticsPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-diagnostics-panel.tsx"),
    "utf8",
  )
  assert.match(diagnosticsPanel, /Inbox Health/)
  assert.match(diagnosticsPanel, /Sync Health/)
  assert.match(diagnosticsPanel, /Sync Runs/)
  assert.match(diagnosticsPanel, /Provider Mailbox Controls/)
  assert.match(diagnosticsPanel, /GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/inbox/)
  assert.match(navSource, /unified-inbox/)
  assert.match(navSource, /inbox-diagnostics/)
  assert.match(navSource, /\/admin\/growth\/inbox\/diagnostics/)

  const workspaceTypes = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox/inbox-workspace-types.ts"),
    "utf8",
  )
  assert.match(workspaceTypes, /GROWTH_INBOX_WORKSPACE_V2/)
  assert.match(workspaceTypes, /GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER/)
  assert.match(workspaceTypes, /isGrowthInboxWorkspaceV2Enabled/)

  assert.equal(resolveGrowthInboxWorkspaceV2FromSearchParams(new URLSearchParams()), true)
  assert.equal(resolveGrowthInboxWorkspaceV2FromSearchParams(new URLSearchParams("inboxWorkspaceV2=1")), true)
  assert.equal(resolveGrowthInboxWorkspaceV2FromSearchParams(new URLSearchParams("inboxWorkspaceV2=true")), true)
  assert.equal(resolveGrowthInboxWorkspaceV2FromSearchParams(new URLSearchParams("inboxWorkspaceV2=0")), false)
  assert.equal(resolveGrowthInboxWorkspaceV2FromSearchParams(new URLSearchParams("inboxWorkspaceV2=false")), false)

  const memoryStrip = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-relationship-memory-strip.tsx"),
    "utf8",
  )
  assert.match(memoryStrip, /No relationship memory yet/)
  assert.match(memoryStrip, /Objections/)
  assert.match(memoryStrip, /Risk/)

  const timelinePanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-relationship-timeline.tsx"),
    "utf8",
  )
  assert.match(timelinePanel, /Relationship Timeline/)
  assert.match(timelinePanel, /inboxTimelineEventTypeLabel/)

  const leadContext = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-lead-context-provider.tsx"),
    "utf8",
  )
  assert.match(leadContext, /replies\/timeline/)

  const actionCenter = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-action-center-column.tsx"),
    "utf8",
  )
  assert.match(actionCenter, /GrowthInboxRecommendedActionCard/)
  assert.match(actionCenter, /GrowthInboxQuickActions/)
  assert.match(actionCenter, /GrowthInboxActionCenterWorkflowEmbeds/)

  assert.match(
    fs.readFileSync(path.join(process.cwd(), "lib/growth/inbox/inbox-action-center-resolver.ts"), "utf8"),
    /orchestrateGrowthInboxRecommendations/,
  )
  assert.match(workspaceTypes, /GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER/)

  const queueFilters = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox/inbox-thread-queue-filters.ts"),
    "utf8",
  )
  assert.match(queueFilters, /needs_action/)
  assert.match(queueFilters, /meeting_intent/)

  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox/inbox-recommendation-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestrator, /orchestrateGrowthInboxRecommendations/)
  assert.match(orchestrator, /revenue_execution/)
  assert.match(orchestrator, /playbook/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/inbox/growth-inbox-workspace-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /GrowthInboxWorkspaceShell/)
  assert.match(shellSource, /24%/)
  assert.match(shellSource, /52%/)

  const diagnosticsPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/inbox/diagnostics/page.tsx"),
    "utf8",
  )
  assert.match(diagnosticsPage, /Inbox Diagnostics/)
  assert.match(diagnosticsPage, /GrowthInboxDiagnosticsPanel/)

  console.log("growth-unified-inbox: all checks passed")
}

void main()
