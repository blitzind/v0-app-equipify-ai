/**
 * Regression checks for Growth Engine AI Communication Copilot (slice 6.0A).
 * Run: pnpm test:growth-ai-copilot
 */
import assert from "node:assert/strict"
import {
  computeGrowthAiCopilotEffectivenessScore,
  evaluateGrowthAiCopilotRules,
} from "../lib/growth/ai-copilot-rules"
import {
  estimateGrowthAiCopilotCost,
  growthAiCopilotInputHash,
} from "../lib/growth/ai-copilot-provider-types"
import {
  buildGrowthAiCopilotSystemPrompt,
  buildGrowthAiCopilotUserPrompt,
} from "../lib/growth/ai-copilot-prompts"
import { resolveGrowthAiCopilotFrameworkKeys } from "../lib/growth/ai-copilot-frameworks"
import {
  growthAiCopilotModelSchema,
  mapGrowthAiCopilotModelOutput,
} from "../lib/growth/ai-copilot-schema"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import type { GrowthLead } from "../lib/growth/types"

const cost = estimateGrowthAiCopilotCost({ promptChars: 4000 })
assert.ok(cost.promptTokensEstimate > 0)

const sampleLead = {
  id: "00000000-0000-4000-8000-000000000001",
  companyName: "Acme Service Co",
  contactName: "Jordan Lee",
  score: 82,
  status: "qualified",
  engagementTier: "engaged",
  engagementScore: 72,
  engagementSummary: "Opened recent email",
  relationshipStrengthTier: "trusted",
  relationshipTrend: "stable",
  opportunityReadinessTier: "sales_ready",
  opportunityBlockers: [],
  opportunityAccelerators: [{ key: "positive_reply", label: "Positive reply" }],
  revenueProbabilityTier: "forecasted",
  revenueTrajectory: "steady",
  executivePriorityTier: "important",
  executiveRecommendation: "Monitor close motion",
  operationalCapacityTier: "healthy",
  capacityProtectionRecommendation: "Capacity healthy",
  latestResearchRunId: "run-1",
  followUpAt: null,
  decisionMakerStatus: "confirmed",
  nextBestAction: "call_now",
  nextBestActionReason: "Hot engagement",
} as unknown as GrowthLead

const frameworks = resolveGrowthAiCopilotFrameworkKeys(sampleLead)
assert.ok(frameworks.buyingSignals.length > 0)

const snapshot = {
  companyName: sampleLead.companyName,
  contactName: sampleLead.contactName,
  fitScore: sampleLead.score,
  engagementTier: sampleLead.engagementTier,
  engagementSummary: sampleLead.engagementSummary,
  relationshipTier: sampleLead.relationshipStrengthTier,
  relationshipTrend: sampleLead.relationshipTrend,
  opportunityTier: sampleLead.opportunityReadinessTier,
  opportunityBlockers: [],
  opportunityAccelerators: ["Positive reply"],
  revenueTier: sampleLead.revenueProbabilityTier,
  revenueTrajectory: sampleLead.revenueTrajectory,
  executiveTier: sampleLead.executivePriorityTier,
  executiveRecommendation: sampleLead.executiveRecommendation,
  capacityTier: sampleLead.operationalCapacityTier,
  capacityProtection: sampleLead.capacityProtectionRecommendation,
  researchSummary: "Field service operator",
  researchNextAction: "Qualify fleet size",
  decisionMakers: [{ name: "Jordan Lee", title: "Owner", status: "confirmed" }],
  nextBestAction: sampleLead.nextBestAction,
  nextBestActionReason: sampleLead.nextBestActionReason,
  recentOutbound: [],
  replyPreview: "Can you share pricing?",
  frameworks,
}

const serialized = JSON.stringify(snapshot)
assert.equal(serialized.includes(sampleLead.id), false)

const systemPrompt = buildGrowthAiCopilotSystemPrompt("response_draft", "default")
const userPrompt = buildGrowthAiCopilotUserPrompt("response_draft", snapshot)
assert.ok(systemPrompt.includes("You do NOT send email"))
assert.ok(userPrompt.includes("Acme Service Co"))

const parsed = growthAiCopilotModelSchema.parse({
  subject: "Re: pricing",
  content: "Thanks for reaching out — happy to share context on pricing.",
  classification: {
    primary: "budget",
    sentiment: "neutral",
    confidence: 0.7,
  },
})

const mapped = mapGrowthAiCopilotModelOutput(parsed, "call_risk_brief")
assert.ok(mapped.generatedContent.length > 0)
assert.ok(mapped.classification.callPrep)

const blocked = evaluateGrowthAiCopilotRules({
  lead: sampleLead,
  generationType: "cold_email",
  rules: [{ ruleKey: "block_suppressed_leads", enabled: true } as never],
  emailSummary: { ...EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY, isSuppressed: true },
})
assert.equal(blocked.allowed, false)

assert.equal(
  computeGrowthAiCopilotEffectivenessScore({ outcome: "approved", classificationConfidence: 0.8 }),
  94,
)

assert.ok(growthAiCopilotInputHash({ a: 1 }).length === 32)

console.log("growth-ai-copilot: ok")
