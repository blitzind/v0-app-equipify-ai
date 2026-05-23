/**
 * Regression checks for Growth Engine Call Copilot (slice 6.2A).
 * Run: pnpm test:growth-call-copilot
 */
import assert from "node:assert/strict"
import {
  computeBriefEffectivenessScore,
  computeCallOutcomeConfidence,
  suggestCallDisposition,
} from "../lib/growth/call-copilot-heuristics"
import {
  resolveGrowthCallCopilotEnabled,
  resolveGrowthCallCopilotRequireSummaryApproval,
} from "../lib/growth/call-copilot-settings"
import type { GrowthCallCopilotBriefing, GrowthCallCopilotSession } from "../lib/growth/call-copilot-types"
import {
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS,
  GROWTH_CALL_COPILOT_LIVE_GUIDANCE_MODES,
  GROWTH_CALL_COPILOT_SESSION_STATUSES,
} from "../lib/growth/call-copilot-types"
import { GROWTH_LEAD_CALL_DISPOSITIONS } from "../lib/growth/call-types"

assert.deepEqual(GROWTH_CALL_COPILOT_SESSION_STATUSES, ["pre_call", "in_call", "completed", "discarded"])
assert.deepEqual(GROWTH_CALL_COPILOT_LIVE_GUIDANCE_MODES, ["manual", "future_realtime"])
assert.equal(GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS.length, 7)
assert.equal(GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS.length, 6)

const highRiskBriefing: GrowthCallCopilotBriefing = {
  whoToCall: {
    contactName: "Jordan",
    companyName: "Acme",
    phone: "+15551234567",
    decisionMakers: [],
  },
  whyNow: "Executive intervention",
  likelyObjections: ["Budget"],
  openingLine: "Hi Jordan",
  recommendedCta: "Book demo",
  doNotSay: ["Do not pitch"],
  riskWarnings: ["Executive tier", "Capacity critical", "Conflicts"],
  highRiskCall: true,
}

assert.equal(highRiskBriefing.highRiskCall, true)

const confidence = computeCallOutcomeConfidence({
  buyingSignalCount: 2,
  commitmentSignalCount: 1,
  objectionCount: 1,
  suggestedDisposition: "interested",
  highRiskCall: true,
})
assert.ok(confidence >= 0 && confidence <= 100)

const disposition = suggestCallDisposition({
  commitmentSignals: [{ key: "meeting_scheduled" }],
  buyingSignals: [],
  liveNotes: "",
})
assert.equal(disposition, "interested")

const followUp = suggestCallDisposition({
  commitmentSignals: [{ key: "call_back_date" }],
  buyingSignals: [],
  liveNotes: "",
})
assert.equal(followUp, "follow_up_later")

const effectiveness = computeBriefEffectivenessScore("disposition_approved", 80)
assert.ok(effectiveness >= 90)

const mockSession: GrowthCallCopilotSession = {
  id: "00000000-0000-4000-8000-000000000099",
  leadId: "00000000-0000-4000-8000-000000000001",
  callSessionId: null,
  status: "completed",
  liveGuidanceMode: "manual",
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  callGoal: "Qualify",
  callContextSnapshot: { briefing: highRiskBriefing },
  liveNotes: "Good conversation",
  detectedObjections: [],
  detectedBuyingSignals: [],
  detectedCommitmentSignals: [],
  recommendedResponses: {},
  postCallSummary: "Summary draft",
  recommendedNextStep: "Send proposal",
  suggestedDisposition: "interested",
  callOutcomeConfidence: confidence,
  postCallGenerationId: null,
  summaryApprovedAt: null,
  summaryApprovedBy: null,
  dispositionApprovedAt: null,
  dispositionApprovedBy: null,
  createdBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

assert.equal(mockSession.dispositionApprovedAt, null)
assert.ok(GROWTH_LEAD_CALL_DISPOSITIONS.includes(mockSession.suggestedDisposition!))

assert.equal(resolveGrowthCallCopilotEnabled({ callCopilotEnabled: true, aiCopilotEnabled: false }), true)
assert.equal(resolveGrowthCallCopilotEnabled({ callCopilotEnabled: false, aiCopilotEnabled: true }), false)
assert.equal(
  resolveGrowthCallCopilotEnabled({ callCopilotEnabled: undefined as unknown as boolean, aiCopilotEnabled: true }),
  true,
)
assert.equal(resolveGrowthCallCopilotRequireSummaryApproval({ callCopilotRequireSummaryApproval: undefined as unknown as boolean }), true)

console.log("growth call copilot tests passed")
