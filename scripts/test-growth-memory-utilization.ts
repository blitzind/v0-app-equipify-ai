/**
 * Sprint 3 memory utilization integration checks.
 * Run: pnpm test:growth-memory-utilization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_LEAD_MEMORY_UTILIZATION_QA_MARKER,
  type GrowthLeadMemoryProfileView,
} from "../lib/growth/lead-memory/memory-types"
import {
  mergeMemoryObjectionSummaries,
  projectLeadMemoryInfluenceContext,
} from "../lib/growth/lead-memory/memory-influence-projection"

assert.equal(GROWTH_LEAD_MEMORY_UTILIZATION_QA_MARKER, "growth-lead-memory-utilization-v1")

const sampleView: GrowthLeadMemoryProfileView = {
  profile: {
    id: "p1",
    leadId: "lead-1",
    leadLabel: "Acme",
    relationshipStage: "evaluating",
    memoryCoverageScore: 72,
    eventCount: 3,
    objectionCount: 1,
    preferenceCount: 1,
    committeeMemberCount: 0,
    buyingSignalCount: 1,
    highestConfidence: "high",
    summary: "Prospect evaluating pricing after demo interest.",
    lastRebuiltAt: null,
    updatedAt: new Date().toISOString(),
  },
  relationshipContext: {
    id: "rc1",
    leadLabel: "Acme",
    accountLabel: "Acme",
    relationshipStage: "evaluating",
    progressionScore: 65,
    engagementTrend: "stable",
    topSignals: ["pricing_question"],
    riskFlags: ["competitive_mention"],
  },
  events: [
    {
      id: "e1",
      leadLabel: "Acme",
      memoryCategory: "meeting_signal",
      confidence: "high",
      title: "Demo requested",
      evidenceSnippet: "Can we schedule a demo next week?",
      sourceSystem: "inbox",
      recordedAt: new Date().toISOString(),
    },
  ],
  objections: [
    {
      id: "o1",
      leadLabel: "Acme",
      objectionType: "budget",
      objectionLabel: "Budget concern",
      severity: "high",
      confidence: "high",
      evidenceSnippet: "Budget is tight this quarter.",
      occurrenceCount: 2,
      resolved: false,
      lastSeenAt: new Date().toISOString(),
    },
  ],
  preferences: [
    {
      id: "pref1",
      leadLabel: "Acme",
      preferenceType: "communication_preference",
      preferenceKey: "channel",
      preferenceValue: "email follow-up",
      confidence: "medium",
      evidenceSnippet: "Prefer email over phone.",
    },
  ],
  committeeMembers: [],
  summarySnapshots: [],
}

const projected = projectLeadMemoryInfluenceContext(sampleView)
assert.equal(projected.available, true)
assert.equal(projected.unresolvedHighSeverityObjectionCount, 1)
assert.ok(projected.topObjections[0]?.includes("Budget concern"))
assert.ok(projected.avoidRepeating.length > 0)

const merged = mergeMemoryObjectionSummaries(["Legacy objection"], projected)
assert.ok(merged[0]?.includes("Budget concern"))

const files = [
  "lib/growth/lead-memory/memory-influence-projection.ts",
  "lib/growth/lead-memory/memory-influence-context.ts",
  "lib/growth/outreach/personalization/context-packet-builder.ts",
  "lib/growth/ai-copilot-input.ts",
  "lib/growth/replies/reply-context-builder.ts",
  "lib/growth/call-copilot-briefing.ts",
  "lib/growth/recompute-lead-next-best-action.ts",
  "lib/growth/opportunity-intelligence/crm-intelligence.ts",
  "lib/growth/realtime/realtime-lead-intelligence.ts",
]

for (const file of files) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8")
  assert.match(source, /buildLeadMemoryInfluenceContext|projectLeadMemoryInfluenceContext/)
}

const nbaSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/next-best-action.ts"), "utf8")
assert.match(nbaSource, /memoryUnresolvedHighSeverityObjectionCount/)
assert.match(nbaSource, /memoryCoverageScore/)

const promptSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/ai-copilot-prompts.ts"), "utf8")
assert.match(promptSource, /relationshipMemory/)
assert.match(promptSource, /avoidRepeatingTopics/)

const replyMemorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/reply-copilot-memory.ts"),
  "utf8",
)
assert.match(replyMemorySource, /buildMemoryAwareSuggestedReplyDraft/)
assert.match(replyMemorySource, /applyAvoidRepeatingToReplyDraft/)

console.log("growth-memory-utilization: all checks passed")
