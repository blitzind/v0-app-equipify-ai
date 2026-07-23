/**
 * AVA-GROWTH-OPERATOR-1D — Executive experience alignment certification.
 * Run: pnpm test:ava-growth-operator-1d-executive-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_GROWTH_OPERATOR_1D_QA_MARKER,
  GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL,
  alignExecutiveHomeRecommendations,
  formatExecutiveConfidenceBand,
  formatExecutiveConfidenceLabel,
  humanizeExecutiveCopy,
} from "../lib/growth/aios/operator-experience/growth-executive-experience-1d"
import { projectExecutiveApprovalPackage1D } from "../lib/growth/workspace/ux-1d/review/growth-executive-approval-package-1d"
import { GROWTH_AVA_COGNITIVE_SECTION_TITLES } from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import {
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_HOME,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK,
} from "../lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"
import type { GrowthHomeAvaRecommendationItem } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const AVA_GROWTH_OPERATOR_1D_QA_MARKER = "ava-growth-operator-1d-executive-experience-v1" as const

const ROOT = process.cwd()
const LEAD = "11111111-1111-4111-8111-111111111111"

function recommendationFixture(
  overrides: Partial<GrowthHomeAvaRecommendationItem> & Pick<GrowthHomeAvaRecommendationItem, "id" | "kind">,
): GrowthHomeAvaRecommendationItem {
  return {
    id: overrides.id,
    kind: overrides.kind,
    rank: overrides.rank ?? 1,
    title: overrides.title ?? "Fixture",
    headline: overrides.headline ?? "Fixture",
    detail: overrides.detail ?? null,
    supportingLine: overrides.supportingLine ?? null,
    outcomeLine: overrides.outcomeLine ?? null,
    estimatedMinutes: overrides.estimatedMinutes ?? 3,
    estimatedEffortLabel: overrides.estimatedEffortLabel ?? "3 minutes",
    href: overrides.href ?? `/growth/leads/${LEAD}`,
    leadId: overrides.leadId ?? LEAD,
    companyName: overrides.companyName ?? "Fixture Co",
    whyReasons: overrides.whyReasons ?? [],
    sourceLabel: overrides.sourceLabel ?? "fixture",
  }
}

function buildMinimalPacket() {
  return {
    company: {
      name: "Acme Service Co",
      website: "https://acme.example",
      industry: "Field service",
      location: "Austin, TX",
      equipmentServiced: ["HVAC"],
      employees: "50",
      revenueEstimate: null,
      researchConfidence: 0.72,
    },
    decisionMaker: {
      name: "Jordan Lee",
      title: "Operations Director",
      email: "jordan@acme.example",
      phone: null,
      linkedIn: null,
      verificationStatus: "verified",
      contactConfidence: 0.7,
    },
    drafts: [
      {
        channel: "email",
        label: "Primary email",
        prepared: true,
        preview: "Hi Jordan — quick question about maintenance visibility.",
        versionStatus: "generated",
      },
    ],
    risk: {
      overallConfidence: 0.68,
      researchCompleteness: "moderate",
      contactVerification: "verified",
      spamRisk: "low",
      bounceRisk: "low",
      unknownFields: [],
      autonomousSendBlockedReasons: [],
      relationshipStrength: null,
    },
    operatorReviewLayout: {
      researchSummary: ["Services commercial HVAC in Austin."],
      revenueStrategyEssentials: [],
      relationshipStrategyEssentials: [],
      conversationStrategyEssentials: [],
      sellerTruthEssentials: [],
      canonicalDecisionEssentials: [],
      canonicalDecisionEnforcementEssentials: [],
      expandable: {
        sellerTruthDetail: [],
        prospectTruthDetail: [],
        relationshipStrategyDetail: [],
        revenueStrategyDetail: [],
        observationIntelligence: [],
        consultantDiscoveryDetail: [],
        explainabilityDetail: [],
        strategyDetail: [],
        transparencyDetail: [],
      },
    },
    explainability: { supportingEvidence: [], unknownAssumptions: [], whyContact: null },
    knowledgeLayers: { prospectTruth: [] },
    whySelected: ["Strong ICP fit for recurring maintenance workflows."],
    evidenceCards: [],
    memoryReview: [],
    salesStrategy: null,
    transparency: { packageVersion: "fixture-v1" },
  }
}

function runCertification(): void {
  console.log(`[${AVA_GROWTH_OPERATOR_1D_QA_MARKER}] AVA-GROWTH-OPERATOR-1D certification`)

  assert.equal(GROWTH_AIOS_GROWTH_OPERATOR_1D_QA_MARKER, AVA_GROWTH_OPERATOR_1D_QA_MARKER)

  const docPath = path.join(ROOT, "docs/AVA-GROWTH-OPERATOR-1D_EXECUTIVE_EXPERIENCE_ALIGNMENT.md")
  assert.ok(fs.existsSync(docPath), "1D documentation must exist")

  assert.equal(GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL, "Show Ava's Work")
  assert.equal(GROWTH_AVA_COGNITIVE_SECTION_TITLES.raw_intelligence, GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL)

  assert.equal(formatExecutiveConfidenceBand(0.8), "high")
  assert.equal(formatExecutiveConfidenceBand(0.5), "moderate")
  assert.equal(formatExecutiveConfidenceBand(0.2), "low")
  assert.match(formatExecutiveConfidenceLabel(0.8), /High confidence/)
  assert.doesNotMatch(formatExecutiveConfidenceLabel(0.8), /%/)

  const sanitized = humanizeExecutiveCopy("Waiting on transport approval for pipeline stage workflow")
  assert.doesNotMatch(sanitized, /transport|pipeline stage|workflow|waiting/i)

  const aligned = alignExecutiveHomeRecommendations([
    recommendationFixture({
      id: "decision",
      kind: "lead_decision",
      rank: 2,
      title: "Research this account",
    }),
    recommendationFixture({
      id: "approval",
      kind: "approval_package",
      rank: 1,
      title: "Review opportunity package",
    }),
  ])
  assert.equal(aligned.length, 1)
  assert.equal(aligned[0]?.kind, "approval_package")

  const packet = buildMinimalPacket()
  const recommendation = {
    qaMarker: "ge-aios-operator-ux-2d-package-recommendation-quality-v1" as const,
    executiveRecommendation: "Acme Service Co appears to be a strong fit because they service commercial HVAC.",
    whyThisAccount: ["Strong ICP fit for recurring maintenance workflows."],
    whyNow: "No verified timing event was found.",
    whyNowHasTrigger: false,
    recommendedBuyer: {
      name: "Jordan Lee",
      title: "Operations Director",
      roleRationale: "Operations leadership owns service execution pain.",
      confidenceLabel: "High confidence",
      weakContact: false,
    },
    primaryAngle: {
      label: "Recurring maintenance visibility",
      rationale: "Observed evidence points to maintenance coordination as the entry point.",
      equipifyValue: "Preventive maintenance scheduling",
    },
    firstConversation: {
      openingPremise: "Lead with how the team tracks recurring maintenance.",
      discoveryQuestion: "Where do PM schedules break down today?",
      proofPoint: "Preventive maintenance scheduling",
      desiredNextStep: "Earn a short workflow review.",
    },
    evidenceAndUncertainty: { verified: ["Services commercial HVAC."], inferred: [], unknown: [] },
    draftAlignment: { aligned: true, warnings: [] },
    qualityState: "ready" as const,
    qualityNotes: [],
    weakEvidenceIntro: null,
  }

  const summary = {
    companyName: packet.company.name,
    companyContext: "Field service · Austin, TX",
    confidenceLabel: "High confidence",
    contactReadySummary: "Email on file",
    contentReadySummary: "Email draft prepared",
    transportSummary: "Sending not yet approved",
    contactWarning: null,
    riskStatement: null,
    channelReadiness: [],
    primaryEmailDraft: packet.drafts[0],
    secondaryPreparedDrafts: [],
  }

  const executive = projectExecutiveApprovalPackage1D({
    packet: packet as never,
    summary: summary as never,
    recommendation,
  })

  assert.equal(executive.showAvaWorkLabel, GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL)
  assert.ok(executive.company.name)
  assert.ok(executive.decisionMaker.contactSummary.includes("@"))
  assert.ok(executive.company.icpFitSummary.length >= 1)
  assert.match(executive.confidenceLabel, /confidence/i)
  assert.doesNotMatch(executive.confidenceLabel, /%/)
  assert.ok(executive.preparedMessages.length >= 1)
  assert.deepEqual(executive.availableActions, ["approve", "edit", "reject"])

  for (const copy of [GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_HOME, GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK]) {
    assert.doesNotMatch(copy, /\btransport\b/i)
  }

  const layoutPath = path.join(
    ROOT,
    "components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx",
  )
  const layoutSource = fs.readFileSync(layoutPath, "utf8")
  assert.match(layoutSource, /GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL/)
  assert.match(layoutSource, /Executive recommendation/)

  console.log(`[${AVA_GROWTH_OPERATOR_1D_QA_MARKER}] PASS`)
}

runCertification()
