/**
 * GE-AIOS-8A-8 — Business Intelligence projection into Ava Lead Discovery context.
 * Run: pnpm test:ge-aios-8a-8-bi-lead-discovery-context
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaLedLeadDiscoveryContext,
  GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
import {
  assertLeadDiscoveryDefaultsUnchangedByUnapprovedBi,
  buildBusinessIntelligenceLeadDiscoverySignals,
  enrichLeadDiscoveryContextWithBusinessIntelligence,
} from "../lib/growth/business-intelligence/business-intelligence-lead-discovery-context"
import {
  GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY,
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_PHASE,
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY,
} from "../lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const PHASE = GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_PHASE

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const approvedProfile: BusinessProfileDraftContent = {
  company: {
    companyName: "Northstar Logistics",
    website: "https://northstar-logistics.example",
    shortDescription: "Fleet optimization software for regional carriers.",
    productsServices: ["Route planning SaaS"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Reduce empty miles for regional fleets.",
  },
  idealCustomers: {
    targetIndustries: ["Regional trucking", "Freight brokers"],
    companySizeRanges: ["51–200"],
    geography: ["United States"],
    buyerPersonas: ["VP Operations", "Fleet Director"],
    disqualifiers: ["Owner-operator only"],
  },
  problemsAndTriggers: {
    painPoints: ["Manual dispatch"],
    buyingTriggers: ["Fleet expansion"],
    competitorsAlternatives: ["Spreadsheets"],
    keywords: ["fleet optimization", "route planning"],
    negativeKeywords: ["consumer"],
  },
  salesAndMarketing: {
    averageDealSize: "$25k ACV",
    salesCycleEstimate: "60 days",
    messagingAngles: ["Fewer empty miles"],
    qualificationCriteria: ["Regional carrier focus"],
  },
  confidence: {
    score: 0.9,
    assumptions: [],
    missingInformation: [],
  },
}

const biDerivedDraftProfile: BusinessProfileDraftContent = {
  ...approvedProfile,
  idealCustomers: {
    ...approvedProfile.idealCustomers,
    targetIndustries: ["Should not be used as live targeting"],
    buyerPersonas: ["Should not be used as live targeting"],
  },
  confidence: {
    score: 0.6,
    assumptions: ["Updated from Business Intelligence review decisions (draft — requires separate approval)."],
    missingInformation: [],
  },
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] BI → Lead Discovery context certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER, "ge-aios-8a-8-bi-lead-discovery-context-v1")
  assert.equal(
    GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_API_PATH,
    "/api/platform/growth/business-intelligence/lead-discovery-context",
  )

  // Approved profile still drives actual Lead Discovery defaults.
  const baseline = buildAvaLedLeadDiscoveryContext({
    profile: approvedProfile,
    companyName: "Northstar Logistics",
    missionTitle: "Expand Midwest carrier pipeline",
  })
  assert.equal(baseline.businessProfileUsed, true)
  assert.ok(baseline.draft.topics.some((topic) => /regional trucking|freight brokers|fleet optimization/i.test(topic)))
  assert.ok(baseline.explainability.some((line) => line.source === "approved_business_profile"))

  const reviewedSignals = buildBusinessIntelligenceLeadDiscoverySignals({
    hasReport: true,
    hasReviewDecisions: true,
    latestDraft: null,
    activeApprovedProfileId: "approved-profile-1",
    reviewedFields: [
      {
        field_key: "market.industries_served",
        label: "Industries served",
        decision: "approved",
        confidence: 0.82,
        supporting_evidence_ids: ["evidence-industry-1"],
        explanation: "Website and approved profile agree on regional trucking focus.",
      },
      {
        field_key: "sales.likely_buyer_personas",
        label: "Buyer personas",
        decision: "edited",
        confidence: 0.75,
        supporting_evidence_ids: ["evidence-persona-1"],
        explanation: "Operator edited buyer personas during BI review.",
      },
    ],
  })

  const enriched = buildAvaLedLeadDiscoveryContext({
    profile: approvedProfile,
    companyName: "Northstar Logistics",
    missionTitle: "Expand Midwest carrier pipeline",
    businessIntelligenceSignals: reviewedSignals,
  })

  assert.equal(JSON.stringify(enriched.draft), JSON.stringify(baseline.draft))
  assert.ok(
    enriched.explainability.some(
      (line) =>
        line.source === "reviewed_business_intelligence" &&
        line.id === "bi-industries" &&
        line.supporting_evidence_ids?.includes("evidence-industry-1"),
    ),
  )
  assert.ok(enriched.businessIntelligence?.review_enriched)
  assert.ok(
    enriched.assumptions.some((line) =>
      /approved Growth Profile still drives targeting defaults/i.test(line),
    ),
  )

  // Unapproved BI does not alter defaults — advisory only.
  const unreviewedBiSignals = buildBusinessIntelligenceLeadDiscoverySignals({
    hasReport: true,
    hasReviewDecisions: false,
    latestDraft: null,
    activeApprovedProfileId: "approved-profile-1",
    reviewedFields: [],
  })
  assert.equal(unreviewedBiSignals.suggestions_only, true)
  assert.equal(unreviewedBiSignals.advisory, GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY)

  const unreviewedContext = buildAvaLedLeadDiscoveryContext({
    profile: approvedProfile,
    companyName: "Northstar Logistics",
    businessIntelligenceSignals: unreviewedBiSignals,
  })
  assert.equal(JSON.stringify(unreviewedContext.draft), JSON.stringify(baseline.draft))
  assert.ok(unreviewedContext.assumptions.includes(GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY))
  assert.equal(
    assertLeadDiscoveryDefaultsUnchangedByUnapprovedBi({
      baselineDraft: baseline.draft,
      enrichedDraft: unreviewedContext.draft,
      signals: unreviewedBiSignals,
    }),
    true,
  )

  // Pending BI-generated profile draft is surfaced but not used as approved context.
  const pendingDraftSignals = buildBusinessIntelligenceLeadDiscoverySignals({
    hasReport: true,
    hasReviewDecisions: true,
    latestDraft: { id: "draft-from-bi-1", profile: biDerivedDraftProfile },
    activeApprovedProfileId: "approved-profile-1",
    reviewedFields: reviewedSignals.reviewed_fields,
  })
  assert.equal(pendingDraftSignals.bi_draft_pending_approval, true)
  assert.equal(pendingDraftSignals.advisory, GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY)

  const pendingDraftContext = buildAvaLedLeadDiscoveryContext({
    profile: approvedProfile,
    companyName: "Northstar Logistics",
    businessIntelligenceSignals: pendingDraftSignals,
  })
  assert.equal(JSON.stringify(pendingDraftContext.draft), JSON.stringify(baseline.draft))
  assert.equal(pendingDraftContext.businessIntelligence?.pending_draft, true)
  assert.equal(pendingDraftContext.businessIntelligence?.pending_draft_profile_id, "draft-from-bi-1")
  assert.ok(pendingDraftContext.assumptions.includes(GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY))

  // No BI — existing behavior unchanged.
  const noBiContext = buildAvaLedLeadDiscoveryContext({
    profile: approvedProfile,
    companyName: "Northstar Logistics",
    businessIntelligenceSignals: null,
  })
  assert.equal(JSON.stringify(noBiContext.draft), JSON.stringify(baseline.draft))
  assert.equal(noBiContext.businessIntelligence?.advisory ?? null, null)
  assert.equal(noBiContext.businessIntelligence?.review_enriched, false)

  const noProfileNoBi = buildAvaLedLeadDiscoveryContext({ profile: null })
  assert.equal(noProfileNoBi.businessProfileUsed, false)
  assert.ok(noProfileNoBi.explainability.some((line) => line.source === "fallback"))

  // Safety gates — no auto-run side effects in projection modules or workbench wiring.
  const contextModule = readSource("lib/growth/business-intelligence/business-intelligence-lead-discovery-context.ts")
  const readService = readSource("lib/growth/business-intelligence/business-intelligence-lead-discovery-read-service.ts")
  const apiRoute = readSource("app/api/platform/growth/business-intelligence/lead-discovery-context/route.ts")
  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  const defaultsLib = readSource("lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults.ts")

  for (const source of [contextModule, readService, apiRoute, defaultsLib]) {
    assert.doesNotMatch(source, /runBusinessIntelligence|runEvidenceEngine|ava-launch-run|createLeadCandidate/i)
    assert.doesNotMatch(source, /sendEmail|enrollSequence|launchCampaign|Revenue Queue|prospect research/i)
    assert.doesNotMatch(source, /applyToBusinessProfile|apply-to-business-profile/i)
  }

  assert.match(apiRoute, /loadBusinessIntelligenceLeadDiscoverySignals/)
  assert.match(apiRoute, /GET/)
  assert.doesNotMatch(apiRoute, /POST/)

  assert.match(workbench, /GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_API_PATH/)
  assert.match(workbench, /businessIntelligenceSignals/)
  assert.match(workbench, /buildAvaLedLeadDiscoveryContext/)
  assert.match(defaultsLib, /enrichLeadDiscoveryContextWithBusinessIntelligence/)
  assert.match(defaultsLib, /businessIntelligenceSignals/)

  assert.equal(GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER, "ge-aios-find-leads-7c-v1")

  // Enrichment helper preserves draft when suggestions only.
  const enrichedOnly = enrichLeadDiscoveryContextWithBusinessIntelligence(baseline, unreviewedBiSignals)
  assert.equal(JSON.stringify(enrichedOnly.draft), JSON.stringify(baseline.draft))

  console.log(`[${PHASE}] PASS — BI Lead Discovery context certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
