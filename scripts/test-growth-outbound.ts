/**
 * Regression checks for Growth Engine outbound foundation.
 * Run: pnpm test:growth-outbound
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { computeGrowthContactTemperature } from "../lib/growth/outbound/contact-temperature"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { classifyOutboundReply } from "../lib/growth/outbound/reply-classifier"
import { envelopeToNormalized } from "../lib/growth/outbound/providers/types"
import { stubOutboundProviderAdapter } from "../lib/growth/outbound/providers/stub"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { computeGrowthCallPriority } from "../lib/growth/call-priority"
import { inferBatchAutoTags } from "../lib/growth/import/batch-tags"

assert.deepEqual(classifyOutboundReply("I am out of office until Monday").classification, "out_of_office")
assert.deepEqual(classifyOutboundReply("Not interested, please remove me").classification, "not_interested")
assert.deepEqual(classifyOutboundReply("Yes, schedule a call this week").classification, "interested")

const fixturePath = path.join(process.cwd(), "lib/growth/outbound/fixtures/sent-001.json")
const sentFixture = JSON.parse(readFileSync(fixturePath, "utf8"))
const normalized = stubOutboundProviderAdapter.normalizeEvent(sentFixture)
assert.equal(normalized.eventType, "sent")
assert.equal(normalized.email, "jane@acme.example")

const duplicate = envelopeToNormalized({
  ...sentFixture,
  providerEventId: "stub:evt:dup",
})
assert.equal(duplicate.providerEventId, "stub:evt:dup")

const suppressedSummary = { ...EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY, isSuppressed: true }
assert.equal(computeGrowthContactTemperature({ status: "in_outreach", emailSummary: suppressedSummary }), "suppressed")

const hotSummary = {
  ...EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
  interestedReply7d: true,
  replyCount14d: 1,
  latestReplyClassification: "interested" as const,
}
assert.equal(computeGrowthContactTemperature({ status: "replied", emailSummary: hotSummary }), "hot")

const nba = computeGrowthLeadNextBestAction({
  status: "in_outreach",
  score: 70,
  website: "https://acme.example",
  websiteFetchStatus: "ok",
  lastResearchedAt: new Date().toISOString(),
  latestResearchRunId: "run-1",
  contactPhone: "5551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: null,
  emailSummary: hotSummary,
})
assert.equal(nba.action, "call_after_email_reply")

const priority = computeGrowthCallPriority({
  researchPriority: "normal",
  score: 70,
  status: "replied",
  lastResearchedAt: new Date().toISOString(),
  recommendedNextAction: null,
  leadNotes: null,
  manualResearchNotes: null,
  callDisposition: null,
  followUpAt: null,
  callPriorityOverride: null,
  emailSummary: hotSummary,
})
assert.ok(priority.effectiveScore >= 14)

assert.deepEqual(inferBatchAutoTags({ batchName: "Medical Equipment" }), ["medical_equipment"])

console.log("growth outbound tests passed")
