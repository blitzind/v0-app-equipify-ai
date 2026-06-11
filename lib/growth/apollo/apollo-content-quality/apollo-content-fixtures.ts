/** Varied Apollo content benchmark fixtures (Phase 11F). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { buildApolloUnifiedPersonalizationContextFromPacket } from "@/lib/growth/apollo/apollo-unified-personalization-context"

const INDUSTRIES = [
  { label: "Healthcare", industry: "medical_equipment" },
  { label: "HVAC Services", industry: "hvac" },
  { label: "Industrial Equipment", industry: "general" },
  { label: "Facilities Management", industry: "general" },
  { label: "Biomedical Services", industry: "medical_equipment" },
] as const

const COMPANY_NAMES = [
  "Summit Medical",
  "Northline HVAC",
  "Atlas Field Services",
  "Pioneer Biomed",
  "Cascade Industrial",
  "Meridian Ops",
  "Vertex Service Group",
  "Horizon Clinical",
  "Sterling Mechanical",
  "BluePeak Facilities",
]

const TITLES = [
  "VP Operations",
  "Director of Service",
  "COO",
  "Head of Field Operations",
  "Service Manager",
  "Clinical Engineering Director",
]

const FIRST_NAMES = ["Alex", "Jordan", "Maya", "Chris", "Elena", "Marcus", "Priya", "Sam", "Tanya", "David"]

const PAIN_POINTS = [
  "Dispatch coordination delays across multi-site teams",
  "Manual spreadsheet dispatch board slowing response times",
  "No online scheduling — phone-only service requests",
  "Field technician hiring backlog straining capacity",
  "Service visibility gaps between dispatch and field",
  "Paper route sheets causing missed SLA windows",
  "Compliance documentation scattered across sites",
  "Workflow double-entry between CRM and dispatch",
]

const MEMORY_SNIPPETS = [
  "Asked for benchmark comparison on dispatch workflows",
  "Committed to review scheduling process next quarter",
  "Objection: already evaluating another platform",
  "Preferred concise follow-ups after initial demo",
]

const COMMITTEE_SNIPPETS = [
  "Operations and clinical engineering stakeholders",
  "COO plus regional service managers",
  "IT and field ops committee for platform review",
]

function basePacket(index: number): OutreachContextPacket {
  const industry = INDUSTRIES[index % INDUSTRIES.length]
  const company = COMPANY_NAMES[index % COMPANY_NAMES.length]
  const name = `${FIRST_NAMES[index % FIRST_NAMES.length]}${index > 0 ? ` ${String.fromCharCode(65 + (index % 26))}` : ""}`.trim()
  const title = TITLES[index % TITLES.length]
  const pain = `${PAIN_POINTS[index % PAIN_POINTS.length]} (site ${index + 1})`
  const sparse = index % 7 === 0

  const hasMemory = index % 5 === 2
  const hasPriorTouch = index % 4 === 1
  const hasReply = index % 6 === 3

  return {
    companyName: company,
    industryLabel: industry.label,
    website: sparse ? null : `https://${company.toLowerCase().replace(/\s+/g, "")}.example`,
    employeeSize: index % 3 === 0 ? "50-200" : index % 3 === 1 ? "200-500" : "500-1000",
    location: index % 2 === 0 ? "Denver, CO" : "Chicago, IL",
    decisionMakerName: name,
    decisionMakerTitle: title,
    fitScore: sparse ? 55 : 70 + (index % 20),
    engagementScore: hasReply ? 55 : hasPriorTouch ? 35 : 20,
    opportunityReadinessTier: hasReply ? "warm" : "developing",
    buyingIntent: hasReply ? "moderate" : "low",
    competitorPressure: index % 8 === 0 ? "Legacy vendor renewal cycle" : null,
    capacitySignals: sparse ? [] : ["Field service backlog", "Multi-site expansion"],
    websiteSummary: sparse ? null : `${company} provides regional ${industry.label.toLowerCase()} services.`,
    websiteTextExcerpt: sparse
      ? null
      : "Call to schedule service. Manual dispatch coordination mentioned on careers page.",
    websiteFindings: sparse
      ? []
      : [
          "Multi-site service operations",
          index % 2 === 0 ? "No online scheduling on website" : "Request service form only",
        ],
    hiringSignals: index % 5 === 0 ? ["Hiring field technicians"] : [],
    enrichmentFindings: sparse ? [] : ["Verified service fleet operations"],
    researchRecommendedNextAction: sparse ? null : "Offer a brief workflow review.",
    priorTouchSummaries: hasPriorTouch ? ["Prior outreach on dispatch workflow"] : [],
    priorReplySummaries: hasReply ? ["Asked about scheduling visibility"] : [],
    objectionSummaries: index % 9 === 0 ? ["Concerned about implementation time"] : [],
    sequenceHistorySummaries: hasPriorTouch ? ["Step 1 email sent — no reply"] : [],
    timelineEventSummaries: [],
    researchConfidence: sparse ? 0.35 : 0.55 + (index % 4) * 0.1,
    researchPainPoints: sparse ? [] : [pain],
    equipmentServiceIndicators: sparse ? [] : ["Field service fleet maintenance"],
    companySummary: sparse ? null : `${company} maintains regional operations in ${industry.label}.`,
    outreachAngles: sparse
      ? []
      : [
          "Reduce downtime across service sites",
          `Playbook focus: ${COMMITTEE_SNIPPETS[index % COMMITTEE_SNIPPETS.length]}`,
        ],
    priorOutboundSubjects: hasPriorTouch ? [`Workflow question — ${company}`] : [],
    priorTouchCount: hasPriorTouch ? 1 : 0,
    hasWebsiteResearch: !sparse,
    hasDecisionMaker: true,
    memoryAvailable: hasMemory,
    memoryCoverageScore: hasMemory ? 65 : null,
    relationshipStage: hasMemory ? "engaged" : null,
    relationshipSummary: hasMemory ? "Prior evaluation conversation" : null,
    memoryPreferenceSummaries: hasMemory ? [MEMORY_SNIPPETS[index % MEMORY_SNIPPETS.length]] : [],
    memoryInteractionSummaries: hasMemory ? ["Discussed dispatch benchmarks in prior call"] : [],
    memoryCommitmentSummaries: hasMemory ? ["Committed to internal workflow review"] : [],
    memoryAvoidRepeating: [],
    memoryRiskFlags: [],
    memoryCommitteeSummaries: sparse ? [] : [COMMITTEE_SNIPPETS[index % COMMITTEE_SNIPPETS.length]],
    memoryOpenLoopSummaries: hasMemory ? ["Open loop on scheduling benchmark"] : [],
    memoryEngagementTrend: hasMemory ? "warming" : null,
    memoryProgressionScore: hasMemory ? 60 : null,
    memoryUnresolvedObjectionCount: index % 9 === 0 ? 1 : 0,
    leadEngineGuidance: null,
  }
}

export type ApolloContentFixture = {
  id: string
  leadId: string
  packet: OutreachContextPacket
  generationType: GrowthAiCopilotGenerationType
  unifiedContext: ReturnType<typeof buildApolloUnifiedPersonalizationContextFromPacket>
}

export function buildApolloContentFixture(index: number): ApolloContentFixture {
  const packet = basePacket(index)
  const generationType: GrowthAiCopilotGenerationType =
    index % 11 === 0
      ? "follow_up_email"
      : index % 13 === 0
        ? "executive_email"
        : "cold_email"

  const unifiedContext = buildApolloUnifiedPersonalizationContextFromPacket({
    packet,
    contact_full_name: packet.decisionMakerName ?? "Contact",
    contact_title: packet.decisionMakerTitle,
    contact_company_name: packet.companyName,
    qualification_score: packet.fitScore,
    apollo_evidence_summary: "Apollo Primary Contact Acquisition",
    account_playbook_summary: packet.memoryCommitteeSummaries[0] ?? "Expand operations stakeholders.",
    buying_committee_summary: packet.memoryCommitteeSummaries[0],
    attribution_chain: ["Apollo", "Qualification", "Enrollment"],
  })

  return {
    id: `fixture-${index}`,
    leadId: `lead-bench-${index}`,
    packet,
    generationType,
    unifiedContext,
  }
}

export function buildApolloContentFixtureBatch(count: number): ApolloContentFixture[] {
  return Array.from({ length: count }, (_, index) => buildApolloContentFixture(index))
}
