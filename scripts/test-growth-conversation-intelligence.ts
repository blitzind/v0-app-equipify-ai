/**
 * Regression checks for Growth Engine conversation intelligence (slice 6.5A).
 * Run: pnpm test:growth-conversation-intelligence
 */
import assert from "node:assert/strict"
import { computeGrowthLeadConversationIntelligence } from "../lib/growth/conversation-score"
import {
  GROWTH_CONVERSATION_OBJECTION_SEVERITY,
  type GrowthLeadConversationInput,
} from "../lib/growth/conversation-types"
import { computeGrowthConversationCompetitorPressure } from "../lib/growth/conversation-competitors"
import { computeGrowthConversationMomentum } from "../lib/growth/conversation-momentum"
import { computeGrowthConversationResponsePattern } from "../lib/growth/conversation-response-pattern"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(
  partial: Partial<GrowthLeadConversationInput> = {},
): GrowthLeadConversationInput {
  return {
    leadId: "lead-1",
    isSuppressed: false,
    notInterested: false,
    notes: null,
    signals: [],
    replyLatenciesMs: [],
    previousScore: null,
    previousTrend: null,
    relationshipTrend: null,
    now: NOW,
    ...partial,
  }
}

assert.ok(GROWTH_CONVERSATION_OBJECTION_SEVERITY.already_using_solution > GROWTH_CONVERSATION_OBJECTION_SEVERITY.timing)

const strongBuyer = computeGrowthLeadConversationIntelligence(
  baseInput({
    signals: [
      {
        kind: "buying_intent",
        label: "Strong buying intent",
        points: 10,
        occurredAt: "2026-05-18T09:00:00.000Z",
        source: "email",
        text: "Ready to sign and move forward with pricing",
      },
      {
        kind: "email_reply_interested",
        label: "Interested reply",
        points: 18,
        occurredAt: "2026-05-18T08:00:00.000Z",
        source: "email",
      },
    ],
  }),
)
assert.equal(strongBuyer.buyingIntent, "moderate")
assert.ok(strongBuyer.score >= 70)

const objectionHeavy = computeGrowthLeadConversationIntelligence(
  baseInput({
    signals: [
      {
        kind: "objection_budget",
        label: "Budget objection",
        points: -6,
        occurredAt: "2026-05-17T10:00:00.000Z",
        source: "email",
      },
      {
        kind: "objection_already_using_solution",
        label: "Incumbent objection",
        points: -6,
        occurredAt: "2026-05-16T10:00:00.000Z",
        source: "call",
      },
    ],
  }),
)
assert.ok(objectionHeavy.objectionProfile.totalSeverityScore >= 24)
assert.ok(objectionHeavy.score < strongBuyer.score)

const competitorPressure = computeGrowthConversationCompetitorPressure(
  baseInput({
    signals: [
      {
        kind: "competitor_servicetitan",
        label: "Competitor mention: ServiceTitan",
        points: -4,
        occurredAt: "2026-05-18T09:00:00.000Z",
        source: "email",
        text: "We already use ServiceTitan",
      },
      {
        kind: "competitor_servicetitan",
        label: "Competitor mention: ServiceTitan",
        points: -4,
        occurredAt: "2026-05-17T09:00:00.000Z",
        source: "call",
      },
    ],
  }),
)
assert.ok(competitorPressure.pressure >= 40)

assert.equal(
  computeGrowthConversationResponsePattern(
    baseInput({ replyLatenciesMs: [2 * 60 * 60 * 1000] }),
  ),
  "very_fast",
)

assert.equal(
  computeGrowthConversationMomentum(
    baseInput({
      previousTrend: "at_risk",
      previousScore: 30,
      relationshipTrend: "cooling",
      signals: [
        {
          kind: "email_reply_interested",
          label: "Interested reply",
          points: 18,
          occurredAt: "2026-05-17T10:00:00.000Z",
          source: "email",
        },
      ],
    }),
    52,
    "improving",
  ),
  "recovering",
)

const immediateFollowUp = computeGrowthLeadNextBestAction({
  status: "replied",
  score: 80,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-05-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: null,
  conversationUrgencyLevel: "critical",
  now: NOW,
})
assert.equal(immediateFollowUp.action, "immediate_follow_up")

const recoveryMotion = computeGrowthLeadNextBestAction({
  status: "qualified",
  score: 70,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-05-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: null,
  conversationMomentum: "recovering",
  conversationHealthTier: "critical",
  conversationTrend: "improving",
  now: NOW,
})
assert.equal(recoveryMotion.action, "conversation_recovery_motion")

console.log("growth-conversation-intelligence: ok")
