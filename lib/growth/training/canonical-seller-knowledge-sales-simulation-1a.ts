/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Supervised sales simulation (dry-run, no sends).
 */

import {
  buildOutreachConversationStrategy,
  buildOutreachSellerTruth,
  type GrowthOutreachEvidenceCitation,
  type GrowthOutreachProspectTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import {
  buildOutreachSalesStrategyBrief,
  type GrowthOutreachSalesStrategyBrief,
} from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { evaluateGrowthLeadAdmission } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export type SalesSimulationProspectScenario = {
  id: string
  companyName: string
  industry: string
  serviceVertical: string
  website?: string | null
  employeeCount?: string | null
  contactName?: string | null
  contactTitle?: string | null
  contactEmail?: string | null
  operationalSignals: string[]
  expectedQualification: "qualified" | "disqualified" | "review"
  disqualificationReasons?: string[]
}

export type SalesSimulationProspectResult = {
  scenario: SalesSimulationProspectScenario
  qualifies: boolean
  admissionState: string
  admissionReasons: string[]
  disqualificationExplanation: string[]
  decisionMakers: Array<{ name: string | null; title: string | null; whyTheyCare: string }>
  companySummary: string
  operationalPainPoints: string[]
  solutionFit: string
  personalizedOutreach: string
  likelyObjections: Array<{ objection: string; response: string }>
  approvalPackageSummary: string
  salesStrategyBrief: GrowthOutreachSalesStrategyBrief
}

export type SalesSimulationReport = {
  organizationId: string
  simulatedAt: string
  outboundEnabled: false
  results: SalesSimulationProspectResult[]
}

export const DEFAULT_SALES_SIMULATION_SCENARIOS: SalesSimulationScenarioSet = {
  qualified: [
    {
      id: "hvac-regional-operator",
      companyName: "Summit Climate Services",
      industry: "HVAC-R",
      serviceVertical: "hvac_r",
      website: "https://summitclimateservices.example",
      employeeCount: "45-80",
      contactName: "Maria Chen",
      contactTitle: "Director of Operations",
      contactEmail: "mchen@summitclimateservices.example",
      operationalSignals: [
        "Commercial HVAC maintenance contracts across 3 counties",
        "Dispatch board described as spreadsheet-heavy on careers page",
        "Hiring field technicians and a dispatcher",
      ],
      expectedQualification: "qualified",
    },
    {
      id: "medical-equipment-service",
      companyName: "Precision Biomedical Field Service",
      industry: "Medical Equipment",
      serviceVertical: "medical_equipment",
      website: "https://precisionbiomed.example",
      employeeCount: "20-50",
      contactName: "James Okonkwo",
      contactTitle: "Service Manager",
      contactEmail: "jokonkwo@precisionbiomed.example",
      operationalSignals: [
        "On-site biomedical equipment repair and PM programs",
        "Calibration certificate tracking mentioned on website",
        "Multi-site hospital service contracts",
      ],
      expectedQualification: "qualified",
    },
    {
      id: "garage-door-operator",
      companyName: "Metro Door & Gate Service",
      industry: "Garage Door",
      serviceVertical: "garage_door",
      website: "https://metrodoor.example",
      employeeCount: "15-30",
      contactName: "Lisa Hartman",
      contactTitle: "Owner",
      contactEmail: "lisa@metrodoor.example",
      operationalSignals: [
        "Commercial overhead door installation and service",
        "Same-day dispatch for property management clients",
        "Work order volume growing per service area expansion",
      ],
      expectedQualification: "qualified",
    },
  ],
  disqualified: [
    {
      id: "pure-marketing-agency",
      companyName: "BrightPixel Marketing",
      industry: "Marketing",
      serviceVertical: "field_service",
      website: "https://brightpixel.example",
      employeeCount: "10-25",
      contactName: "Alex Rivera",
      contactTitle: "CEO",
      contactEmail: "alex@brightpixel.example",
      operationalSignals: [
        "Digital marketing and SEO services",
        "No field technicians or equipment maintenance",
      ],
      expectedQualification: "disqualified",
      disqualificationReasons: ["No field service operations", "No equipment servicing motion"],
    },
    {
      id: "ecommerce-retailer",
      companyName: "ShopNest Online",
      industry: "E-commerce",
      serviceVertical: "appliance_repair",
      website: "https://shopnest.example",
      employeeCount: "50-100",
      contactName: "Taylor Brooks",
      contactTitle: "COO",
      contactEmail: "taylor@shopnest.example",
      operationalSignals: ["Direct-to-consumer retail", "Warehouse fulfillment only"],
      expectedQualification: "disqualified",
      disqualificationReasons: ["Pure retail without service division"],
    },
  ],
}

export type SalesSimulationScenarioSet = {
  qualified: SalesSimulationProspectScenario[]
  disqualified: SalesSimulationProspectScenario[]
}

function buildEvidence(signals: string[]): GrowthOutreachEvidenceCitation[] {
  return signals.map((detail, index) => ({
    source: index === 0 ? "Website research" : "Operational signal",
    detail,
  }))
}

function buildProspectTruth(input: {
  scenario: SalesSimulationProspectScenario
  evidence: GrowthOutreachEvidenceCitation[]
  businessProblems: string[]
  fitReason: string
}): GrowthOutreachProspectTruth {
  return {
    companyName: input.scenario.companyName,
    evidence: input.evidence,
    businessProblems: input.businessProblems,
    decisionMaker: {
      name: input.scenario.contactName ?? null,
      title: input.scenario.contactTitle ?? null,
      whyThisPerson: input.scenario.contactTitle
        ? `${input.scenario.contactTitle} is the best available outreach contact for operational workflow conversations.`
        : "Role-agnostic outreach until a verified decision maker is confirmed.",
      whyTheyCare:
        input.scenario.contactTitle?.includes("Owner") || input.scenario.contactTitle?.includes("Director")
          ? "Operational clarity and dispatch-to-cash efficiency directly affect margins and customer retention."
          : "Service delivery friction and technician utilization are core responsibilities.",
    },
    opportunitySummary: input.businessProblems[0] ?? null,
    fitReason: input.fitReason,
    assumptions: [],
    missingEvidence: [],
    relationshipStage: "Cold",
  }
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(
      /^www\./,
      "",
    )
  } catch {
    return null
  }
}

export function simulateSalesProcessForProspect(input: {
  organizationId: string
  profile: BusinessProfileDraftContent
  profileId?: string | null
  scenario: SalesSimulationProspectScenario
  leadId?: string
}): SalesSimulationProspectResult {
  const sellerTruth = buildOutreachSellerTruth({
    profile: input.profile,
    profileId: input.profileId ?? null,
    sellerCompanyName: input.profile.company.companyName,
    prospectTitle: input.scenario.contactTitle ?? null,
    prospectIndustry: input.scenario.industry,
  })

  const admission = evaluateGrowthLeadAdmission(
    {
      companyName: input.scenario.companyName,
      website: input.scenario.website ?? null,
      domain: domainFromWebsite(input.scenario.website),
      industry: input.scenario.industry,
      email: input.scenario.contactEmail ?? null,
      contactName: input.scenario.contactName ?? null,
      identityUncertain: false,
      source: "manual",
      metadata: {},
    },
    {
      approvedProfile: input.profile,
      activeMissionTitle: input.profile.company.companyName,
    },
  )

  const evidence = buildEvidence(input.scenario.operationalSignals)
  const businessProblems = input.scenario.operationalSignals.map((signal) =>
    signal.includes("dispatch") || signal.includes("spreadsheet")
      ? "Dispatch and work-order coordination creates avoidable friction."
      : signal.includes("calibration") || signal.includes("certificate")
        ? "Service documentation and calibration records need tighter workflow linkage."
        : "Field service operations would benefit from clearer dispatch-to-cash visibility.",
  )
  const fitReason =
    admission.state === "accepted"
      ? `${input.scenario.companyName} matches the approved ICP for ${input.scenario.industry} field service operations.`
      : admission.state === "rejected"
        ? `${input.scenario.companyName} falls outside the approved ICP based on operational profile.`
        : `${input.scenario.companyName} requires operator review against ICP criteria.`

  const prospectTruth = buildProspectTruth({
    scenario: input.scenario,
    evidence,
    businessProblems,
    fitReason,
  })

  const conversationStrategy = buildOutreachConversationStrategy({
    seller: sellerTruth,
    prospect: prospectTruth,
    recommendedConversation: `Explore whether ${input.scenario.operationalSignals[0]?.toLowerCase() ?? "their service workflow"} is creating enough friction to warrant a short discovery conversation.`,
    primaryHook: `Noticed ${input.scenario.companyName} is scaling ${input.scenario.industry.toLowerCase()} service operations — curious whether dispatch-to-cash handoffs are still manual in places.`,
  })

  const brief = buildOutreachSalesStrategyBrief({
    leadId: input.leadId ?? `sim-${input.scenario.id}`,
    companyName: input.scenario.companyName,
    preparedAt: new Date().toISOString(),
    website: input.scenario.website ?? null,
    contactName: input.scenario.contactName ?? null,
    contactTitle: input.scenario.contactTitle ?? null,
    contactEmail: input.scenario.contactEmail ?? null,
    employees: input.scenario.employeeCount ?? null,
    verifiedEvidence: input.scenario.operationalSignals,
    industry: input.scenario.industry,
    sellerTruth,
    approvedProfile: input.profile,
    approvedProfileId: input.profileId ?? null,
    sellerCompanyName: input.profile.company.companyName,
    fitReason,
    opportunitySummary: businessProblems[0] ?? null,
  })

  const disqualificationExplanation =
    admission.state === "rejected"
      ? [
          ...(input.scenario.disqualificationReasons ?? []),
          ...sellerTruth.whenNotToRecommend.slice(0, 2),
        ]
      : sellerTruth.disqualifiers.slice(0, 2)

  const likelyObjections = sellerTruth.objections.slice(0, 3)
  if (likelyObjections.length === 0) {
    likelyObjections.push({
      objection: "We already have a system in place.",
      response:
        "Totally fair — many teams keep what works and still have gaps between dispatch, field completion, and billing. Worth a short conversation only if that handoff still costs time.",
    })
  }

  return {
    scenario: input.scenario,
    qualifies: admission.state === "accepted" || admission.state === "review",
    admissionState: admission.state,
    admissionReasons: admission.reasons,
    disqualificationExplanation,
    decisionMakers: [
      {
        name: input.scenario.contactName ?? null,
        title: input.scenario.contactTitle ?? null,
        whyTheyCare:
          prospectTruth.decisionMaker.whyTheyCare ||
          `As ${input.scenario.contactTitle ?? "decision maker"}, operational clarity directly affects service delivery and revenue capture.`,
      },
    ],
    companySummary: `${input.scenario.companyName} is a ${input.scenario.industry} operator (${input.scenario.employeeCount ?? "unknown size"}) with signals: ${input.scenario.operationalSignals.join("; ")}.`,
    operationalPainPoints: prospectTruth.businessProblems,
    solutionFit: conversationStrategy.whySeller,
    personalizedOutreach: brief.primaryHook || conversationStrategy.conversationThatEarnsReply,
    likelyObjections,
    approvalPackageSummary: [
      `Company: ${input.scenario.companyName}`,
      `Admission: ${admission.state}`,
      `Hook: ${brief.primaryHook}`,
      `Executive summary: ${brief.executiveSummary}`,
      `Recommended conversation: ${brief.recommendedConversation}`,
      `Objections prepared: ${likelyObjections.length}`,
      "Status: SIMULATION ONLY — not sent, outbound disabled",
    ].join("\n"),
    salesStrategyBrief: brief,
  }
}

export function runSalesSimulation(input: {
  organizationId: string
  profile: BusinessProfileDraftContent
  profileId?: string | null
  scenarios?: SalesSimulationScenarioSet
  simulatedAt?: string
}): SalesSimulationReport {
  const scenarios = input.scenarios ?? DEFAULT_SALES_SIMULATION_SCENARIOS
  const allScenarios = [...scenarios.qualified, ...scenarios.disqualified]

  return {
    organizationId: input.organizationId,
    simulatedAt: input.simulatedAt ?? new Date().toISOString(),
    outboundEnabled: false,
    results: allScenarios.map((scenario) =>
      simulateSalesProcessForProspect({
        organizationId: input.organizationId,
        profile: input.profile,
        profileId: input.profileId,
        scenario,
      }),
    ),
  }
}
