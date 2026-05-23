/**
 * Regression checks for Growth Engine engagement intelligence (slice 5.4A).
 * Run: pnpm test:growth-engagement-intelligence
 */
import assert from "node:assert/strict"
import { decayEngagementSignalPoints, daysSince, isEngagementDormant } from "../lib/growth/engagement-decay"
import { computeGrowthLeadEngagementScore, tierFromEngagementScore } from "../lib/growth/engagement-score"
import type { GrowthLeadEngagementInput } from "../lib/growth/engagement-types"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(signals: GrowthLeadEngagementInput["signals"]): GrowthLeadEngagementInput {
  return {
    status: "qualified",
    signals,
    isSuppressed: false,
    dormancyExemptUntil: null,
    now: NOW,
  }
}

assert.ok(decayEngagementSignalPoints("email_reply", "2026-05-18T10:00:00.000Z", NOW) > 10)
assert.ok(
  decayEngagementSignalPoints("email_reply", "2026-04-03T10:00:00.000Z", NOW) <
    decayEngagementSignalPoints("email_reply", "2026-05-18T10:00:00.000Z", NOW),
)

assert.equal(tierFromEngagementScore(24, false), "cold")
assert.equal(tierFromEngagementScore(25, false), "warming")
assert.equal(tierFromEngagementScore(50, false), "engaged")
assert.equal(tierFromEngagementScore(75, false), "hot")
assert.equal(tierFromEngagementScore(90, true), "cold")

const hotLead = computeGrowthLeadEngagementScore(
  baseInput([
    { kind: "positive_reply", occurredAt: "2026-05-18T09:00:00.000Z", label: "Positive email reply" },
    { kind: "email_reply", occurredAt: "2026-05-18T08:30:00.000Z", label: "Email reply" },
    { kind: "call_connected", occurredAt: "2026-05-17T15:00:00.000Z", label: "Call connected" },
  ]),
)
assert.equal(hotLead.tier, "hot")
assert.ok(hotLead.score >= 75)
assert.ok(hotLead.topSignals.length <= 3)

const suppressed = computeGrowthLeadEngagementScore({
  ...baseInput([{ kind: "suppression", occurredAt: "2026-05-10T00:00:00.000Z", label: "Suppressed" }]),
  isSuppressed: true,
})
assert.ok(suppressed.score <= 10)

const dormant = isEngagementDormant("2026-03-01T00:00:00.000Z", null, NOW)
assert.equal(dormant, true)
assert.equal(isEngagementDormant("2026-05-10T00:00:00.000Z", null, NOW), false)

const callImmediately = computeGrowthLeadNextBestAction({
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
  emailSummary: {
    ...EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    interestedReply7d: true,
    latestReplyClassification: "interested",
    replyCount14d: 1,
  },
  engagementTier: "hot",
  engagementLastActivityAt: "2026-05-18T09:00:00.000Z",
  now: NOW,
})
assert.equal(callImmediately.action, "call_immediately")

const ownerReview = computeGrowthLeadNextBestAction({
  status: "call_ready",
  score: 90,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-05-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: "+15557654321",
  emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
  engagementTier: "hot",
  engagementLastActivityAt: "2026-05-18T09:00:00.000Z",
  now: NOW,
})
assert.equal(ownerReview.action, "escalate_owner_review")

const callNow = computeGrowthLeadNextBestAction({
  status: "qualified",
  score: 80,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-05-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "none",
  primaryDecisionMakerPhone: null,
  emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
  engagementTier: "engaged",
  engagementLastActivityAt: "2026-05-17T00:00:00.000Z",
  now: NOW,
})
assert.equal(callNow.action, "call_now")

const reengage = computeGrowthLeadNextBestAction({
  status: "qualified",
  score: 60,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-01-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "none",
  primaryDecisionMakerPhone: null,
  emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
  engagementTier: "cold",
  engagementLastActivityAt: "2026-02-01T00:00:00.000Z",
  now: NOW,
})
assert.equal(reengage.action, "reengage")

assert.ok(daysSince("2026-05-01T00:00:00.000Z", NOW) >= 17)

console.log("growth engagement intelligence tests passed")
