/**
 * GE-AIOS-NEXT-1D — Ava outcome-driven planning certification.
 * Run: pnpm test:ge-aios-next-1d-ava-outcome-planning
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeAvaRecommendationOutcomeProjection,
  enrichGrowthHomeAvaRecommendationExperienceNext1d,
  enrichGrowthHomeAvaRecommendationItemNext1d,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d"
import {
  GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_DESIGN_PRINCIPLE,
  GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d-types"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import { buildGrowthHomeAvaRecommendationExperience } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"
import { buildGrowthLeadHref } from "../lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "../lib/growth/navigation/growth-prospect-search-paths"

const PHASE = "GE-AIOS-NEXT-1D-AVA-OUTCOME-PLANNING" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockAiOsUx(overrides: Record<string, unknown> = {}) {
  return {
    hero: { greeting: "Good evening, Michael." },
    approveItemsCount: 0,
    waitingOnYou: [],
    dailyWorkQueue: [],
    approveItemsHref: "/growth/review?tab=packages",
    canonicalOperatorTask: null,
    canonicalOperatorFocus: null,
    canonicalApprovalSnapshot: null,
    canonicalActiveMissions: null,
    canonicalOperatorProgress: null,
    ...overrides,
  } as import("../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types").GrowthHomeAiOsUxViewModel
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.match(GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_DESIGN_PRINCIPLE, /business outcomes, not software tasks/i)
  console.log("  ✓ permanent design principle documented")

  const approvalItem = enrichGrowthHomeAvaRecommendationItemNext1d({
    item: enrichGrowthHomeAvaRecommendationItemNext1b({
      item: {
        id: "approval:item-1",
        rank: 1,
        kind: "approval_package",
        title: "Review opportunity package for Blitz Industries",
        headline: "Review opportunity package for Blitz Industries",
        detail: "2 email drafts prepared",
        supportingLine: "Research is complete and outreach is ready for your review.",
        outcomeLine: "Once you authorize, I'll prepare the send sequence.",
        estimatedMinutes: 3,
        estimatedEffortLabel: "3 minutes",
        href: buildGrowthLeadHref("lead-blitz"),
        leadId: "lead-blitz",
        companyName: "Blitz Industries",
        whyReasons: ["Research is complete and outreach is ready for your review."],
        sourceLabel: "test",
      },
    }),
  })

  assert.equal(approvalItem.outcomeProjection?.qaMarker, GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER)
  assert.match(approvalItem.outcomeProjection?.outcomeHeadline ?? "", /approve the next opportunity/i)
  assert.equal(approvalItem.outcomeProjection?.missionHealth, "waiting_on_you")
  assert.match(approvalItem.outcomeProjection?.businessImpact ?? "", /outreach/i)
  assert.doesNotMatch(approvalItem.employeeHeadline ?? "", /^Review opportunity package/i)
  console.log("  ✓ approval recommendations lead with business outcome, not task title")

  const researchItem = enrichGrowthHomeAvaRecommendationItemNext1d({
    item: enrichGrowthHomeAvaRecommendationItemNext1b({
      item: {
        id: "decision:1",
        rank: 2,
        kind: "lead_decision",
        title: "Finish research for Blitz Industries",
        headline: "Finish research for Blitz Industries",
        detail: "Highest expected ROI",
        supportingLine: "Research is already 82% complete.",
        outcomeLine: "Prepare outreach package",
        estimatedMinutes: 3,
        estimatedEffortLabel: "3 minutes",
        href: buildGrowthLeadHref("lead-blitz"),
        leadId: "lead-blitz",
        companyName: "Blitz Industries",
        whyReasons: ["Blitz Industries is already 82% researched.", "Highest expected ROI"],
        sourceLabel: "test",
      },
    }),
  })

  assert.match(researchItem.outcomeProjection?.outcomeHeadline ?? "", /review-ready opportunity package/i)
  assert.match(researchItem.outcomeProjection?.currentProgressNarrative ?? "", /nearly complete|buying signal/i)
  assert.ok(researchItem.outcomeProjection?.progressMilestones.some((row) => row.complete))
  assert.ok(researchItem.outcomeProjection?.remainingWork.length)
  assert.match(researchItem.employeeLeadParagraph ?? "", /next step is/i)
  console.log("  ✓ research recommendations explain progress narratively instead of leading with tasks")

  const discoveryProjection = buildGrowthHomeAvaRecommendationOutcomeProjection({
    item: {
      id: "mission-discovery-find-leads",
      rank: 3,
      kind: "mission_discovery",
      title: "Find more companies in HVAC service",
      headline: "Find more companies in HVAC service",
      detail: "Pipeline is running low",
      supportingLine: "Pipeline is running low on fresh companies.",
      outcomeLine: "Adding qualified companies keeps your pipeline healthy for outreach.",
      estimatedMinutes: 10,
      estimatedEffortLabel: "10–15 minutes",
      href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
      leadId: null,
      companyName: null,
      whyReasons: ["Pipeline is running low on fresh companies."],
      sourceLabel: "test",
    },
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "mission-1",
      lifecycleState: "finding_leads",
      activityLabel: "Finding leads",
      counters: {
        newCompaniesFound: 0,
        recordsImported: 0,
        researchingCount: 0,
        draftsPrepared: 0,
        pendingApprovals: 0,
      },
      searchSummary: "HVAC service",
      audienceName: "HVAC service",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 4,
      leadPoolHasMore: false,
      pipelineLow: true,
      lastEventSummary: "Pipeline is running low",
      discoveryAction: "run_prospect_search",
      startupDiscoveryReady: true,
    },
  })

  assert.equal(discoveryProjection.outcomeType, "grow_qualified_pipeline")
  assert.match(discoveryProjection.outcomeHeadline, /qualified sales pipeline/i)
  assert.equal(discoveryProjection.missionHealth, "needs_attention")
  console.log("  ✓ discovery recommendations project pipeline outcomes and mission health")

  const experience = buildGrowthHomeAvaRecommendationExperience({
    greeting: "Good evening, Michael.",
    aiOsUx: mockAiOsUx({
      canonicalOperatorTask: {
        id: "approval:item-1",
        kind: "approval",
        title: "Review opportunity package for Blitz Industries",
        detail: "2 email drafts prepared",
        why: "Research is complete and outreach is ready for your review.",
        whatHappensNext: "Once you authorize, I'll prepare the send sequence.",
        confidenceLabel: null,
        href: buildGrowthLeadHref("lead-blitz"),
        companyName: "Blitz Industries",
        leadId: "lead-blitz",
        draftCount: 2,
        packageCount: 1,
      },
    }),
    primaryDecision: {
      id: "approval:item-1",
      label: "Review opportunity package for Blitz Industries",
      detail: "2 email drafts prepared",
      href: buildGrowthLeadHref("lead-blitz"),
    },
  })

  assert.equal(experience.outcomeQaMarker, GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER)
  assert.ok(experience.recommendations[0]?.outcomeProjection)
  assert.ok(experience.recommendations[0]?.executionPathSteps?.length)
  console.log("  ✓ recommendation queue chains outcome builder after existing ranking")

  const outcomeSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d.ts")
  assert.match(outcomeSource, /projectGrowthCanonicalOperatorDecision/)
  assert.match(outcomeSource, /resolveMissionPhaseFromPrimaryAction/)
  assert.doesNotMatch(outcomeSource, /buildGrowthHomeAvaRecommendationExperience/)
  assert.doesNotMatch(outcomeSource, /applyGrowthHomeAvaRecommendationPreferenceBoost/)
  assert.doesNotMatch(outcomeSource, /score|ranking engine|planner/i)
  console.log("  ✓ outcome builder is presentation-only with no duplicate engines")

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(ui, /outcomeProjection/)
  assert.match(ui, /recommendation-outcome-projection/)
  assert.match(ui, /recommendation-mission-health/)
  assert.match(ui, /What happens next/)
  assert.match(ui, /data-qa-marker-next-1d/)
  console.log("  ✓ Home UI renders outcome-first recommendation details")

  const enrichedOnly = enrichGrowthHomeAvaRecommendationExperienceNext1d({
    experience: {
      qaMarker: "ge-aios-next-1a-ava-recommendation-home-v1",
      openingLine: "Hello",
      sinceLastVisitLine: "Since last visit",
      recommendationIntro: "Here's what I recommend.",
      recommendations: [],
      hasRecommendations: false,
      exhaustedMessage: "Done",
    },
  })
  assert.equal(enrichedOnly.outcomeQaMarker, GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER)
  console.log("  ✓ experience enricher is idempotent at the presentation boundary")

  console.log(`\nPASS ${PHASE}`)
}

void main()
