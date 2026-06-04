/**
 * Phase 5.3 — SMS personalization & message intelligence validation.
 * Run: pnpm test:growth-sms-personalization
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildPersonalizedSmsDraft } from "../lib/growth/sms/personalization/assemble-sms-draft"
import { buildGrowthSmsPersonalizationArchitectureAudit } from "../lib/growth/sms/personalization/sms-personalization-audit"
import {
  summarizeSmsContextUsed,
  summarizeSmsMemoryUsed,
} from "../lib/growth/sms/personalization/sms-audit-summaries"
import { projectSmsPersonalizationContext } from "../lib/growth/sms/personalization/sms-context-projection"
import { hasSmsBlastLanguage } from "../lib/growth/sms/personalization/sms-memory-awareness"
import { isGenericSmsOpener } from "../lib/growth/sms/personalization/sms-opening-hooks"
import {
  SMS_PERSONALIZATION_DEFAULT_MAX_CHARS,
  type SmsMessageType,
} from "../lib/growth/sms/personalization/sms-personalization-types"
import type { OutreachContextPacket } from "../lib/growth/outreach/personalization/personalization-types"

const LEAD_ID = "00000000-0000-4000-8000-00000000e533"

const memoryEmpty = {
  memoryAvailable: false,
  memoryCoverageScore: null,
  relationshipStage: null,
  relationshipSummary: null,
  memoryPreferenceSummaries: [] as string[],
  memoryInteractionSummaries: [] as string[],
  memoryCommitmentSummaries: [] as string[],
  memoryAvoidRepeating: [] as string[],
  memoryRiskFlags: [] as string[],
  memoryCommitteeSummaries: [] as string[],
  memoryOpenLoopSummaries: [] as string[],
  memoryEngagementTrend: null as string | null,
  memoryProgressionScore: null as number | null,
  memoryUnresolvedObjectionCount: 0,
}

const phase44Empty = {
  websiteSummary: null as string | null,
  websiteTextExcerpt: null as string | null,
  researchRecommendedNextAction: null as string | null,
  leadEngineGuidance: null,
}

const basePacket: OutreachContextPacket = {
  companyName: "Summit HVAC Services",
  industryLabel: "HVAC contractor",
  website: "https://summithvac.example",
  employeeSize: "25-50",
  location: "Denver, CO",
  decisionMakerName: "Jordan Lee",
  decisionMakerTitle: "Operations Manager",
  fitScore: 82,
  engagementScore: 55,
  opportunityReadinessTier: "qualified",
  buyingIntent: "moderate",
  competitorPressure: null,
  capacitySignals: ["Growing call volume"],
  websiteSummary: "Summit HVAC runs 24/7 emergency dispatch with phone-only booking.",
  websiteTextExcerpt: null,
  websiteFindings: ["Manual dispatch and phone-only booking"],
  hiringSignals: ["Hiring service technicians"],
  enrichmentFindings: ["Field service operator"],
  researchRecommendedNextAction: null,
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: 72,
  researchPainPoints: ["Manual dispatch process"],
  equipmentServiceIndicators: ["HVAC maintenance"],
  companySummary: "Summit HVAC Services provides commercial HVAC maintenance across Colorado.",
  outreachAngles: ["Growing commercial HVAC footprint across Denver metro"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryEmpty,
  ...phase44Empty,
  leadEngineGuidance: null,
}

function sample(
  label: string,
  packet: OutreachContextPacket,
  options?: { messageType?: SmsMessageType; draftType?: "outbound" | "reply"; priorSms?: string[] },
) {
  const context = projectSmsPersonalizationContext({
    packet,
    priorSmsPreviews: options?.priorSms ?? [],
  })
  const { audit, draft } = buildPersonalizedSmsDraft({
    leadId: LEAD_ID,
    context,
    messageType: options?.messageType,
    draftType: options?.draftType,
    maxChars: SMS_PERSONALIZATION_DEFAULT_MAX_CHARS,
  })

  const contextUsed = summarizeSmsContextUsed(audit)
  const memoryUsed = summarizeSmsMemoryUsed(audit)

  console.log(`\n=== ${label} ===`)
  console.log(`Message type: ${audit.messageType}`)
  console.log(`SMS: ${draft.body}`)
  console.log(`Chars: ${draft.charCount} · Segments: ${draft.segmentCount}`)
  console.log(`Hook (${audit.openingHook.strategy}): ${audit.openingHook.evidenceSource ?? "none"}`)
  console.log(`CTA (${audit.cta.category}): ${audit.cta.selectionReason}`)
  console.log(`Context used: ${contextUsed.join(", ") || "none"}`)
  console.log(`Memory used: ${memoryUsed.join(" · ") || "none"}`)
  console.log(
    `Quality — overall ${audit.qualityScore.overall}, personalization ${audit.qualityScore.specificity}, memory ${audit.qualityScore.memoryAlignment}, context ${audit.qualityScore.contextAlignment}`,
  )

  return { audit, draft, contextUsed, memoryUsed }
}

const architecture = buildGrowthSmsPersonalizationArchitectureAudit()
console.log("\n=== Phase 5.3A Architecture Audit ===")
console.log(`QA marker: ${architecture.qa_marker}`)
console.log("Transfers from email:")
for (const item of architecture.transfersFromEmail) console.log(`  + ${item}`)
console.log("Do NOT transfer:")
for (const item of architecture.doNotTransfer) console.log(`  - ${item}`)
console.log("Architecture map:", JSON.stringify(architecture.architectureMap, null, 2))

const coldLead = sample("Cold lead", basePacket)
assert.equal(coldLead.audit.messageType, "cold_sms")
assert.ok(coldLead.draft.charCount <= SMS_PERSONALIZATION_DEFAULT_MAX_CHARS)
assert.ok(coldLead.draft.body.includes("?"))
assert.ok(!hasSmsBlastLanguage(coldLead.draft.body))
assert.ok(!isGenericSmsOpener(coldLead.draft.body))
assert.ok(coldLead.audit.openingHook.strategy === "research_question" || coldLead.audit.openingHook.strategy === "pain_question")
assert.ok(coldLead.audit.cta.category === "quick_question" || coldLead.audit.cta.category === "yes_no")

const warmLead = sample("Warm lead", {
  ...basePacket,
  companyName: "FrontRange Mechanical",
  priorReplySummaries: ["Asked for more detail on technician routing (interested)"],
  priorTouchSummaries: ["Prior outreach on dispatch workflow"],
  priorTouchCount: 2,
  engagementScore: 62,
  memoryAvailable: true,
  memoryCoverageScore: 58,
  relationshipStage: "engaged",
  memoryInteractionSummaries: ["Discussed manual dispatch board in prior email thread"],
  memoryOpenLoopSummaries: ["Asked for more detail on technician routing"],
  memoryEngagementTrend: "improving",
  memoryProgressionScore: 64,
})
assert.equal(warmLead.audit.messageType, "follow_up_sms")
assert.ok(warmLead.audit.qualityScore.overall >= 40)

const memoryRich = sample(
  "Memory-rich lead",
  {
    ...basePacket,
    companyName: "Alpine Service Group",
    memoryAvailable: true,
    memoryCoverageScore: 72,
    relationshipStage: "evaluating",
    relationshipSummary: "Ops lead asked for a lighter follow-up after reviewing dispatch notes.",
    memoryInteractionSummaries: ["Discussed manual dispatch board in prior email thread"],
    memoryCommitmentSummaries: ["Send revised dispatch workflow proposal by Friday"],
    memoryPreferenceSummaries: ["communication preference: concise text updates"],
    memoryOpenLoopSummaries: ["Asked for pricing breakdown after demo"],
    priorReplySummaries: ["Asked for pricing breakdown after demo (interested)"],
    priorTouchCount: 2,
    engagementScore: 62,
  },
  { priorSms: ["Thanks — can you send pricing breakdown?"] },
)
assert.ok(memoryRich.memoryUsed.length > 0)
assert.ok(
  memoryRich.audit.openingHook.strategy === "memory_continuation" ||
    memoryRich.audit.openingHook.strategy === "follow_up_question",
)

const existingCustomer = sample("Existing customer", {
  ...basePacket,
  companyName: "Horizon Mechanical",
  memoryAvailable: true,
  memoryCoverageScore: 78,
  relationshipStage: "customer",
  relationshipSummary: "Active customer evaluating technician routing improvements.",
  memoryInteractionSummaries: ["Customer team asked for next-step rollout guidance"],
  memoryCommitmentSummaries: ["Share rollout checklist before next ops review"],
  memoryEngagementTrend: "stable",
  memoryProgressionScore: 82,
  engagementScore: 74,
  priorReplySummaries: ["Confirmed interest in next-step rollout guidance"],
})
assert.equal(existingCustomer.audit.messageType, "customer_check_in_sms")
assert.ok(existingCustomer.audit.openingHook.strategy === "customer_check_in" || existingCustomer.audit.openingHook.strategy === "memory_continuation")
assert.ok(existingCustomer.audit.cta.category === "soft_reply" || existingCustomer.audit.cta.category === "commitment_continuation")

const objectionHeavy = sample(
  "Objection-heavy lead",
  {
    ...basePacket,
    companyName: "BlueSky HVAC",
    memoryAvailable: true,
    memoryCoverageScore: 61,
    relationshipStage: "evaluating",
    objectionSummaries: ["pricing: Budget approval needed before any rollout"],
    memoryAvoidRepeating: ["Do not re-ask for a live demo this week"],
    memoryPreferenceSummaries: ["communication preference: brief written follow-up"],
    memoryInteractionSummaries: ["Requested pricing breakdown after initial walkthrough"],
    memoryOpenLoopSummaries: ["Requested pricing breakdown after initial walkthrough"],
    engagementScore: 35,
  },
  { draftType: "reply", messageType: "sms_reply" },
)
assert.equal(objectionHeavy.audit.messageType, "sms_reply")
assert.ok(objectionHeavy.audit.cta.category === "clarification" || objectionHeavy.audit.cta.category === "yes_no")
assert.ok(!objectionHeavy.draft.body.toLowerCase().includes("hope this finds you"))

const actionCenterSource = readFileSync(
  resolve(process.cwd(), "components/growth/inbox/growth-inbox-action-center-column.tsx"),
  "utf8",
)
assert.match(actionCenterSource, /GrowthInboxActionCenterSmsDraftEmbed/)

const apiRouteSource = readFileSync(
  resolve(process.cwd(), "app/api/platform/growth/sms/personalization/draft/route.ts"),
  "utf8",
)
assert.match(apiRouteSource, /buildSmsInboxDraftSuggestion/)

console.log("\nPhase 5.3 SMS personalization validation passed")
