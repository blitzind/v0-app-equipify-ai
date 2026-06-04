/**
 * Pure regression checks for conversation objection profile normalization + context guards.
 * Run: pnpm test:growth-conversation-objection-profile-normalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeGrowthConversationObjectionProfile } from "../lib/growth/conversation-objection-profile"
import {
  buildOutreachObjectionSummaries,
  resolveConversationCompetitorMentionNames,
  resolveOperationalCapacityConstraintLabels,
} from "../lib/growth/outreach/personalization/context-lead-field-guards"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"

assert.deepEqual(normalizeGrowthConversationObjectionProfile({}), {
  clusters: [],
  totalSeverityScore: 0,
})

assert.deepEqual(normalizeGrowthConversationObjectionProfile(null), {
  clusters: [],
  totalSeverityScore: 0,
})

assert.deepEqual(normalizeGrowthConversationObjectionProfile(undefined), {
  clusters: [],
  totalSeverityScore: 0,
})

assert.deepEqual(normalizeGrowthConversationObjectionProfile({ totalSeverityScore: 12 }), {
  clusters: [],
  totalSeverityScore: 12,
})

assert.deepEqual(normalizeGrowthConversationObjectionProfile({ clusters: "invalid" }), {
  clusters: [],
  totalSeverityScore: 0,
})

const validProfile = normalizeGrowthConversationObjectionProfile({
  clusters: [
    {
      key: "budget",
      count: 2,
      severityWeight: 12,
      lastAt: "2026-06-01T12:00:00.000Z",
    },
    {
      count: 1,
    },
  ],
  totalSeverityScore: 36,
})

assert.equal(validProfile.clusters.length, 1)
assert.equal(validProfile.clusters[0]?.key, "budget")
assert.equal(validProfile.clusters[0]?.count, 2)
assert.equal(validProfile.totalSeverityScore, 36)

assert.deepEqual(
  buildOutreachObjectionSummaries({
    conversationObjectionProfile: {},
    conversationTopSignals: undefined,
  }),
  [],
)

assert.deepEqual(
  buildOutreachObjectionSummaries({
    conversationObjectionProfile: { clusters: [{ key: "timing", count: 1, severityWeight: 6, lastAt: null }] },
    conversationTopSignals: [{ label: "Budget objection on last call" }],
  }),
  ["timing", "Budget objection on last call"],
)

assert.deepEqual(resolveOperationalCapacityConstraintLabels(undefined), [])
assert.deepEqual(resolveOperationalCapacityConstraintLabels(null), [])
assert.deepEqual(
  resolveOperationalCapacityConstraintLabels([{ label: "Rep capacity" }]),
  ["Rep capacity"],
)

assert.deepEqual(resolveConversationCompetitorMentionNames(undefined), [])
assert.deepEqual(
  resolveConversationCompetitorMentionNames([{ name: "ServiceTitan" }]),
  ["ServiceTitan"],
)

const leadRepositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-repository.ts"),
  "utf8",
)
assert.match(leadRepositorySource, /normalizeGrowthConversationObjectionProfile/)

const contextBuilderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outreach/personalization/context-packet-builder.ts"),
  "utf8",
)
assert.match(contextBuilderSource, /buildOutreachObjectionSummaries/)

const harnessPacket: OutreachContextPacket = {
  companyName: "QA Reply Flow Harness",
  industryLabel: null,
  website: null,
  employeeSize: null,
  location: null,
  decisionMakerName: "QA Harness Contact",
  decisionMakerTitle: null,
  fitScore: null,
  engagementScore: null,
  opportunityReadinessTier: null,
  buyingIntent: null,
  competitorPressure: null,
  capacitySignals: [],
  websiteFindings: [],
  hiringSignals: [],
  enrichmentFindings: [],
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: buildOutreachObjectionSummaries({
    conversationObjectionProfile: {},
    conversationTopSignals: [],
  }),
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: null,
  researchPainPoints: [],
  equipmentServiceIndicators: [],
  companySummary: null,
  outreachAngles: [],
  priorTouchCount: 0,
  hasWebsiteResearch: false,
  hasDecisionMaker: true,
  memoryAvailable: false,
  memoryCoverageScore: null,
  relationshipStage: null,
  relationshipSummary: null,
  memoryPreferenceSummaries: [],
  memoryInteractionSummaries: [],
  memoryCommitmentSummaries: [],
  memoryAvoidRepeating: [],
  memoryRiskFlags: [],
}

const signals = extractPersonalizationSignals(harnessPacket)
const coldEmailDraft = buildPersonalizedOutreachDraft({
  leadId: "43b6b778-8a1e-4c6b-9163-148fde7becad",
  packet: harnessPacket,
  signals,
  generationType: "cold_email",
  maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
})

assert.ok(coldEmailDraft.draft.body.trim().length > 0)
assert.ok(coldEmailDraft.draft.subject?.includes("QA Reply Flow Harness"))
assert.equal(coldEmailDraft.strategy.blocks.length, 5)

console.log("growth conversation objection profile normalization tests passed")
