/**
 * Regression checks for Growth Engine Command Center (slice 6.8A).
 * Run: pnpm test:growth-command-center
 */
import assert from "node:assert/strict"
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
  GROWTH_COMMAND_CENTER_QA_MARKER,
} from "../lib/growth/command/command-action-types"
import {
  GROWTH_COMMAND_JUMP_DESTINATIONS,
  GROWTH_COMMAND_SECTION_TABS,
  GROWTH_COMMAND_COMM_SECTION_LINKS,
} from "../lib/growth/command/command-center-navigation"
import { buildBossBattles, buildCoachTips, buildHeatMap, detectComboChains } from "../lib/growth/command/command-dashboard-helpers"
import { describeSequenceStartUnavailable } from "../lib/growth/sequence-enrollment/sequence-enrollment-ui"
import type { GrowthLead } from "../lib/growth/types"

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

assert.ok(GROWTH_COMMAND_JUMP_DESTINATIONS.some((entry) => entry.label === "Inbox" && entry.href === "/admin/growth/leads"))
assert.ok(GROWTH_COMMAND_JUMP_DESTINATIONS.some((entry) => entry.label === "Dogfood Validation"))
assert.equal(GROWTH_COMMAND_SECTION_TABS.length, 6)
assert.equal(GROWTH_COMMAND_SECTION_TABS[0]?.anchor, "cc-today")
assert.equal(GROWTH_COMMAND_COMM_SECTION_LINKS.length, 5)

console.log("growth-command-center: all checks passed")
