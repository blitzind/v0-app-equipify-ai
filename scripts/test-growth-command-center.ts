/**
 * Regression checks for Growth Engine Command Center (slice 6.8A).
 * Run: pnpm test:growth-command-center
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  COMMAND_AUTONOMOUS_KINDS,
  OPERATOR_RANK_THRESHOLDS,
  commandLeadFocusHref,
  commandOutreachHref,
} from "../lib/growth/command/command-action-catalog"
import {
  computeCommandActionImpact,
  computeMomentumState,
  computeOperatorScore,
  rankCommandActions,
  selectFocusSprintActions,
} from "../lib/growth/command/command-action-engine"
import type { GrowthCommandAction } from "../lib/growth/command/command-action-types"
import {
  commandActionImpactTone,
  displayCommandActionImpact,
  GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER,
  GROWTH_COMMAND_CENTER_QA_MARKER,
} from "../lib/growth/command/command-action-types"
import {
  GROWTH_COMMAND_JUMP_DESTINATIONS,
  GROWTH_COMMAND_SECTION_TABS,
  GROWTH_COMMAND_COMM_SECTION_LINKS,
} from "../lib/growth/command/command-center-navigation"
import {
  GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER,
  GROWTH_COMMAND_CENTER_QUICK_ACTIONS,
} from "../lib/growth/command/command-center-quick-actions"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "../lib/growth/navigation/growth-workspace-cleanup-audit"
import { GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER } from "../lib/growth/command/command-center-daily-action-queue"
import { GROWTH_COMMAND_OPEN_OPPORTUNITIES_QA_MARKER } from "../lib/growth/command/command-center-open-opportunities"
import { GROWTH_COMMAND_SEQUENCE_QUEUE_QA_MARKER } from "../lib/growth/command/command-center-sequence-queue"
import { PLATFORM_ADMIN_GROWTH_LEADS_TAB } from "../components/admin/platform-admin-shell"
import { buildBossBattles, buildCoachTips, buildHeatMap, detectComboChains } from "../lib/growth/command/command-dashboard-helpers"
import { describeSequenceStartUnavailable } from "../lib/growth/sequence-enrollment/sequence-enrollment-ui"
import { buildCommandCenterHiringMetrics, buildCommandCenterSignalMomentumSummary, buildCommandCenterWatchlistMetrics } from "../lib/growth/signals/integrations/command-center-bridge"
import { buildCommandCenterAiSignalBriefing } from "../lib/growth/signals/ai/signal-copilot-safe-summary"
import { GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER } from "../lib/growth/signals/ai/signal-copilot-types"
import type { GrowthLead } from "../lib/growth/types"
import type { GrowthSignalRow } from "../lib/growth/signals/signal-types"

function action(partial: Partial<GrowthCommandAction> & Pick<GrowthCommandAction, "id" | "kind" | "leadId">): GrowthCommandAction {
  return {
    bossBattle: null,
    companyName: "Acme HVAC",
    title: partial.kind.replace(/_/g, " "),
    why: "Test",
    impactScore: partial.impactScore ?? 80,
    effortMinutes: 10,
    revenueInfluence: 50,
    ctaLabel: "Open",
    ctaHref: commandLeadFocusHref(partial.leadId, "command"),
    referenceId: null,
    ...partial,
  }
}

const sampleActions: GrowthCommandAction[] = [
  action({ id: "a1", kind: "executive_intervention", leadId: "l1", impactScore: 95, bossBattle: "executive_attention" }),
  action({ id: "a2", kind: "revenue_rescue", leadId: "l2", impactScore: 92, bossBattle: "revenue_rescue" }),
  action({ id: "a3", kind: "approve_outreach", leadId: "l3", impactScore: 85, bossBattle: "sequence_cleanup" }),
  action({ id: "a4", kind: "start_call_copilot", leadId: "l4", impactScore: 80, bossBattle: "follow_up_sprint" }),
  action({ id: "a5", kind: "run_research", leadId: "l5", impactScore: 60 }),
  action({ id: "a6", kind: "confirm_sequence", leadId: "l6", impactScore: 88, bossBattle: "sequence_cleanup" }),
  action({ id: "a7", kind: "follow_up_now", leadId: "l7", impactScore: 78, bossBattle: "follow_up_sprint" }),
  action({ id: "a8", kind: "queue_sequence_step", leadId: "l8", impactScore: 86, bossBattle: "sequence_cleanup" }),
]

const ranked = rankCommandActions(sampleActions)
assert.ok(ranked.length >= 5)
assert.equal(ranked[0]?.impactScore, 95)
assert.ok(ranked[0]!.impactScore >= (ranked[ranked.length - 1]?.impactScore ?? 0))

for (const entry of ranked) {
  const countForLead = ranked.filter((item) => item.leadId === entry.leadId).length
  assert.ok(countForLead <= 2, "ranking should allow at most two actions per lead")
}

const executiveImpact = computeCommandActionImpact({
  kind: "executive_intervention",
  executivePriorityTier: "executive_now",
  revenueTrajectory: "at_risk",
})
assert.ok(executiveImpact >= 90)

const momentumBuilding = computeMomentumState({
  actionsCompletedToday: 5,
  approvalsWaiting: 2,
  revenueAtRisk: 1,
  criticalActions: 3,
})
assert.equal(momentumBuilding.state, "momentum_building")

const revenueRiskMomentum = computeMomentumState({
  actionsCompletedToday: 0,
  approvalsWaiting: 2,
  revenueAtRisk: 6,
  criticalActions: 4,
})
assert.equal(revenueRiskMomentum.state, "revenue_at_risk")

const operatorScore = computeOperatorScore({
  actionsCompleted: 4,
  sequencesAdvanced: 2,
  forecastProtected: 1,
  relationshipsRecovered: 1,
  approvalsWaiting: 3,
  executiveAlertsIgnored: 1,
})
assert.equal(operatorScore, 4 * 25 + 2 * 20 + 1 * 15 + 1 * 20 - 3 * 3 - 1 * 8)

const rankEntry =
  OPERATOR_RANK_THRESHOLDS.find((entry) => operatorScore >= entry.min) ??
  OPERATOR_RANK_THRESHOLDS[OPERATOR_RANK_THRESHOLDS.length - 1]!
assert.equal(rankEntry.rank, "coordinator")

const sprint = selectFocusSprintActions(ranked)
assert.ok(sprint.length <= 5)
assert.ok(sprint.some((entry) => entry.kind === "start_call_copilot" || entry.kind === "follow_up_now"))
assert.ok(sprint.some((entry) => entry.kind === "approve_outreach" || entry.kind === "review_draft"))
assert.ok(sprint.some((entry) => entry.kind === "run_research"))

const bossBattles = buildBossBattles(ranked)
assert.equal(bossBattles.length, 4)
assert.ok(bossBattles.some((battle) => battle.kind === "revenue_rescue" && battle.actionsRequired >= 1))
assert.ok(bossBattles.every((battle) => battle.actionIds.length <= 10))

const heatMap = buildHeatMap([
  { id: "h1", engagementTier: "hot", revenueProbabilityScore: 80, revenueTrajectory: "steady" },
  { id: "h2", revenueTrajectory: "at_risk", conversationHealthTier: "critical" },
  { id: "h3", engagementTier: "warm", opportunityReadinessTier: "sales_ready" },
])
assert.ok(heatMap.find((bucket) => bucket.bucket === "hot")!.count >= 1)
assert.ok(heatMap.find((bucket) => bucket.bucket === "at_risk")!.count >= 1)

const coachTips = buildCoachTips({
  approvalsWaiting: 6,
  revenueRescueCount: 4,
  researchActions: 8,
  executionActions: 3,
  relationshipRecoveryCount: 2,
  relationshipRecoveryCompleted: 0,
})
assert.ok(coachTips.some((tip) => tip.message.includes("Approval backlog")))
assert.ok(coachTips.some((tip) => tip.message.includes("Revenue Rescue")))

const combos = detectComboChains([
  ["research_completed", "decision_maker_added", "call_started"],
])
assert.equal(combos.find((combo) => combo.id === "research-dm-call")?.completed, true)

assert.deepEqual(COMMAND_AUTONOMOUS_KINDS, [])

const leadWithRec = {
  id: "lead-1",
  recommendedSequencePatternId: "pattern-1",
  recommendedSequenceConfidence: 70,
  sequenceFatigueRisk: "low",
} as GrowthLead

const draftUnavailable = describeSequenceStartUnavailable(leadWithRec, {
  hasEnrollment: true,
  enrollmentStatus: "draft",
})
assert.equal(draftUnavailable.canStart, false)
assert.equal(draftUnavailable.code, "draft_enrollment")
assert.match(draftUnavailable.message ?? "", /Draft sequence ready for confirmation/i)

const activeUnavailable = describeSequenceStartUnavailable(leadWithRec, {
  hasEnrollment: true,
  enrollmentStatus: "active",
})
assert.equal(activeUnavailable.code, "active_enrollment")
assert.match(activeUnavailable.message ?? "", /Existing sequence in progress/i)

assert.match(commandLeadFocusHref("lead-1", "call-copilot"), /open=lead-1/)
assert.match(commandLeadFocusHref("lead-1", "call-copilot"), /focus=call-copilot/)
assert.match(commandOutreachHref("queue-1"), /highlight=queue-1/)

assert.equal(GROWTH_COMMAND_CENTER_QA_MARKER, "command-center-v2")
assert.equal(GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER, "command-center-daily-workspace-v1")
assert.equal(GROWTH_COMMAND_CENTER_DAILY_ACTION_QUEUE_QA_MARKER, "growth-command-center-daily-action-queue-v1")
assert.equal(GROWTH_COMMAND_SEQUENCE_QUEUE_QA_MARKER, "growth-command-sequence-queue-v1")
assert.equal(GROWTH_COMMAND_OPEN_OPPORTUNITIES_QA_MARKER, "growth-command-open-opportunities-v1")

const commandCenterDashboard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-center-dashboard.tsx"),
  "utf8",
)
assert.match(commandCenterDashboard, /AidenDailyBriefingPanel/)
assert.match(commandCenterDashboard, /GrowthCommandDailyActionQueue/)
assert.match(commandCenterDashboard, /GrowthReplyWorkflowActionsPanel/)
assert.match(commandCenterDashboard, /GrowthCommandSequenceQueueSection/)
assert.match(commandCenterDashboard, /GrowthCommandOpenOpportunitiesSection/)
assert.match(commandCenterDashboard, /GrowthCommandQuickActionsRail/)
assert.match(commandCenterDashboard, /GROWTH_COMMAND_CENTER_DAILY_WORKSPACE_QA_MARKER/)
assert.doesNotMatch(commandCenterDashboard, /GrowthCommandPipelineRevenueSection/)
assert.doesNotMatch(commandCenterDashboard, /GrowthCommandSignalIntelligenceSection/)
assert.doesNotMatch(commandCenterDashboard, /GrowthOperatorAttentionStrip/)
assert.doesNotMatch(commandCenterDashboard, /GrowthOperatorDailyWorkflow/)

assert.equal(displayCommandActionImpact(95), 10)
assert.equal(displayCommandActionImpact(92), 9)
assert.equal(displayCommandActionImpact(85), 9)
assert.equal(displayCommandActionImpact(60), 6)
assert.equal(displayCommandActionImpact(55), 6)
assert.equal(displayCommandActionImpact(45), 5)

assert.equal(commandActionImpactTone(95), "critical")
assert.equal(commandActionImpactTone(85), "critical")
assert.equal(commandActionImpactTone(75), "high")
assert.equal(commandActionImpactTone(60), "high")
assert.equal(commandActionImpactTone(45), "neutral")

assert.ok(GROWTH_COMMAND_JUMP_DESTINATIONS.some((entry) => entry.label === "Queue" && entry.href === "/admin/growth/queue"))
assert.ok(GROWTH_COMMAND_JUMP_DESTINATIONS.some((entry) => entry.label === "Dogfood Validation"))
assert.equal(GROWTH_COMMAND_SECTION_TABS.length, 7)
assert.equal(GROWTH_COMMAND_SECTION_TABS[0]?.anchor, "cc-today")
assert.equal(GROWTH_COMMAND_COMM_SECTION_LINKS.length, 5)

assert.equal(GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER, "growth-command-center-actions-v4")
assert.equal(GROWTH_COMMAND_CENTER_QUICK_ACTIONS.length, 6)
assert.deepEqual(
  GROWTH_COMMAND_CENTER_QUICK_ACTIONS.map((action) => action.label),
  [
    "Prospect Search",
    "Inbox",
    "Meetings",
    "Opportunities",
    "Launch Campaign",
    "Open Aiden",
  ],
)
assert.equal(GROWTH_COMMAND_CENTER_QUICK_ACTIONS[0]?.href, "/admin/growth/search")
assert.equal(GROWTH_COMMAND_CENTER_QUICK_ACTIONS[1]?.href, GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox)
assert.ok(!GROWTH_COMMAND_CENTER_QUICK_ACTIONS.some((action) => action.label === "Import Leads"))
assert.ok(!GROWTH_COMMAND_CENTER_QUICK_ACTIONS.some((action) => action.label === "View Intent Activity"))

const quickActionsRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-quick-actions-rail.tsx"),
  "utf8",
)
assert.match(quickActionsRail, /GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER/)
assert.match(quickActionsRail, /data-qa-marker=\{GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER\}/)

assert.equal(PLATFORM_ADMIN_GROWTH_LEADS_TAB.label, "Growth Engine")
assert.equal(PLATFORM_ADMIN_GROWTH_LEADS_TAB.key, "growth_leads")
assert.equal(PLATFORM_ADMIN_GROWTH_LEADS_TAB.href, "/admin/growth/command")

const hiringMetrics = buildCommandCenterHiringMetrics({
  hire_signals: [
    {
      id: "h1",
      organization_id: null,
      signal_type: "hire",
      provider_key: "hiring_velocity_derived",
      provider_event_id: "domain:acmehealth.com",
      dedupe_hash: "x",
      confidence: 0.8,
      signal_score: 60,
      urgency: "normal",
      routing_priority: 6,
      occurred_at: new Date().toISOString(),
      detected_at: new Date().toISOString(),
      expires_at: null,
      company_id: null,
      company_name: "Acme Health Systems",
      domain: "acmehealth.com",
      contact_id: null,
      contact_display_label: null,
      title: "Active hiring: 4 open roles",
      previous_title: null,
      seniority: null,
      geography: "Nashville, TN",
      industry: null,
      category: "Field Service",
      evidence_summary: "hire aggregate",
      workflow_state: "new",
      suppression_state: "active",
      processed_to_lead_inbox: false,
      lead_inbox_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        no_employee_records: true,
        hiring_velocity: {
          open_role_count: 4,
          hiring_velocity_7d: 2,
          hiring_velocity_30d: 4,
          hiring_spike: true,
          hiring_intensity: "medium",
          department_distribution: { "Field Service": 2 },
          geographies: ["Nashville, TN"],
        },
      },
    } satisfies GrowthSignalRow,
  ],
})
assert.ok(hiringMetrics.recent_hiring_signals_count >= 1)
assert.equal(hiringMetrics.top_hiring_companies[0]?.company_name, "Acme Health Systems")
assert.equal(hiringMetrics.hiring_spikes.length, 1)

const watchlistMetrics = buildCommandCenterWatchlistMetrics({
  active_watchlists: 3,
  matches_last_24h: 12,
  top_watchlists: [
    { id: "w1", name: "Medical hiring", match_count: 8 },
    { id: "w2", name: "News alerts", match_count: 4 },
  ],
  high_urgency_unmatched: 5,
})
assert.equal(watchlistMetrics.active_watchlists, 3)
assert.equal(watchlistMetrics.matches_last_24h, 12)
assert.equal(watchlistMetrics.top_watchlists[0]?.name, "Medical hiring")
assert.equal(watchlistMetrics.high_urgency_unmatched, 5)

const momentumSummary = buildCommandCenterSignalMomentumSummary({
  signals: [
    {
      id: "sig-1",
      organization_id: null,
      signal_type: "news_event",
      provider_key: "manual",
      provider_event_id: null,
      dedupe_hash: "d1",
      confidence: 0.8,
      signal_score: 72,
      urgency: "high",
      routing_priority: 1,
      occurred_at: new Date().toISOString(),
      detected_at: new Date().toISOString(),
      expires_at: null,
      company_id: null,
      company_name: "Acme Health Systems",
      domain: "acmehealth.com",
      contact_id: null,
      contact_display_label: null,
      title: "Expansion",
      previous_title: null,
      seniority: null,
      geography: "Nashville, TN",
      industry: null,
      category: "Field Service",
      evidence_summary: "Regional expansion",
      workflow_state: "new",
      suppression_state: "active",
      processed_to_lead_inbox: false,
      lead_inbox_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {},
    } satisfies GrowthSignalRow,
  ],
  watchlist_metrics: watchlistMetrics,
})
assert.equal(momentumSummary.qa_marker, "growth-signal-momentum-v1")
assert.ok(momentumSummary.top_companies_by_momentum.length >= 1)
assert.ok(momentumSummary.high_urgency_signals_count >= 1)

const ccSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-signal-intelligence-section.tsx"),
  "utf8",
)
assert.match(ccSection, /GROWTH_SIGNAL_MOMENTUM_QA_MARKER/)
assert.match(ccSection, /ai_briefing/)
assert.match(ccSection, /GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER/)

const aiBriefing = buildCommandCenterAiSignalBriefing({ momentum: momentumSummary })
assert.ok(aiBriefing)
assert.equal(aiBriefing!.qa_marker, GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER)
assert.doesNotMatch(JSON.stringify(aiBriefing), /auto_enroll|raw_payload/)

console.log("growth-command-center: all checks passed")
