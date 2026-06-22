/**
 * Regression checks for outreach memory evidence guards (Phase 15.0D).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-outreach-memory-evidence-guard.ts
 */
import assert from "node:assert/strict"
import {
  isAutoReplyEvidence,
  isInternalMemoryPipelineTitle,
  isUnusableOutreachMemoryEvidence,
} from "../lib/growth/lead-memory/outreach-memory-evidence-guard"
import {
  applyMemoryCommunicationStyle,
  resolveMemoryCommunicationStyle,
} from "../lib/growth/outreach/personalization/memory-communication-style"
import type {
  OutreachContextPacket,
  SelectedMessageBlock,
} from "../lib/growth/outreach/personalization/personalization-types"

assert.equal(isAutoReplyEvidence("Automatic reply: [EXTERNAL] Field service workflow"), true)
assert.equal(isInternalMemoryPipelineTitle("Meeting interest detected"), true)
assert.equal(
  isUnusableOutreachMemoryEvidence({
    title: "Meeting interest detected",
    evidence: "Automatic reply: [EXTERNAL] Field service workflow",
  }),
  true,
)

const packet = {
  companyName: "Ballard Health Medical Equipment",
  memoryAvailable: true,
  memoryCoverageScore: 60,
  relationshipStage: "engaged",
  relationshipSummary: "Brief email preferred.",
  memoryPreferenceSummaries: ["communication preference: brief email"],
  memoryInteractionSummaries: [],
  memoryCommitmentSummaries: [],
  memoryAvoidRepeating: [],
  memoryRiskFlags: [],
  memoryCommitteeSummaries: [],
  memoryOpenLoopSummaries: [],
  memoryEngagementTrend: null,
  memoryProgressionScore: null,
  memoryUnresolvedObjectionCount: 0,
  industryLabel: null,
  website: null,
  employeeSize: null,
  location: null,
  decisionMakerName: "Thomas Helton",
  decisionMakerTitle: null,
  fitScore: null,
  engagementScore: null,
  opportunityReadinessTier: null,
  buyingIntent: null,
  competitorPressure: null,
  capacitySignals: [],
  websiteSummary: null,
  websiteTextExcerpt: null,
  websiteFindings: [],
  hiringSignals: [],
  enrichmentFindings: [],
  researchRecommendedNextAction: null,
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: null,
  researchPainPoints: [],
  equipmentServiceIndicators: [],
  companySummary: null,
  outreachAngles: [],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: false,
  hasDecisionMaker: true,
  leadEngineGuidance: null,
  industryContext: null,
} satisfies OutreachContextPacket

const opening =
  "Thomas Helton, peers in your segment often tighten dispatch before the next growth phase — thought of Ballard Health Medical Equipment."
const blocks: SelectedMessageBlock[] = [
  {
    key: "opening",
    blockId: "opening_peer_comparison",
    label: "Peer comparison",
    text: opening,
  },
  {
    key: "pain",
    blockId: "service_visibility",
    label: "Pain",
    text: "Without a clear service queue, teams spend time chasing status instead of closing jobs.",
  },
]

const style = resolveMemoryCommunicationStyle(packet)
const styled = applyMemoryCommunicationStyle({
  body: blocks.map((block) => block.text).join(" "),
  blocks,
  style,
  companyName: packet.companyName,
})

assert.match(styled.body, /Ballard Health Medical Equipment/)
assert.doesNotMatch(styled.body, /Ballad…/)
assert.doesNotMatch(styled.body, /tighten…/)

const longOpening =
  "Thomas Helton, had a dispatch note for Ballard Health Medical Equipment — peers in your segment often tighten workflow before the next growth phase."
const longStyled = applyMemoryCommunicationStyle({
  body: longOpening,
  blocks: [{ key: "opening", blockId: "opening_peer_comparison", label: "Peer comparison", text: longOpening }],
  style,
  companyName: "Ballard Health Medical Equipment",
})
assert.match(longStyled.body, /tighten workflow before the next growth phase/)

console.log("test-outreach-memory-evidence-guard: ok")
