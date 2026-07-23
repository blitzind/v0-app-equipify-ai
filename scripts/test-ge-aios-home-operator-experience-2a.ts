/**
 * GE-AIOS-HOME-OPERATOR-EXPERIENCE-2A — Human-centered executive briefing certification.
 *
 * Run:
 *   pnpm test:ge-aios-home-operator-experience-2a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import { GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_MISSION_PURPOSE_1A_QA_MARKER } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  resolveOperatorFocusPresentation,
  resolveRuntimeExecutionPresentation,
} from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import {
  buildHeroExecutiveBriefing,
  GROWTH_HOME_OPERATOR_EXPERIENCE_2A_QA_MARKER,
  humanizeOperatorFacingCopy,
  parseOperatorFocusConfidenceLine,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

const PHASE = "GE-AIOS-HOME-OPERATOR-EXPERIENCE-2A" as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function mission(partial: Partial<GrowthHomeMissionDiscoverySnapshot> = {}): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER,
    missionId: "mission-1",
    lifecycleState: "finding_leads",
    activityLabel: "Finding leads",
    counters: {
      draftsPrepared: 0,
      recordsImported: 0,
      pendingApprovals: 0,
      researchingCount: 0,
      newCompaniesFound: 0,
    },
    searchSummary: "Industrial equipment buyers",
    audienceName: "Industrial equipment buyers",
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 12,
    leadPoolHasMore: true,
    pipelineLow: true,
    lastEventSummary: null,
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
    ...partial,
  }
}

function portfolio(partial: Partial<GrowthPortfolioManagerOperatorProjection> = {}): GrowthPortfolioManagerOperatorProjection {
  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    targetActiveCompanies: 25,
    currentActiveCompanies: 8,
    minimumHealthyCompanies: 15,
    needsCount: 17,
    healthState: "needs_replenishment",
    healthLabel: "Portfolio needs more qualified companies.",
    discoveryRunning: true,
    discoveryRunningCount: 0,
    discoveryStatusDisplay: "Next batch: 25",
    nextBatchSize: 25,
    showEstimatedHealthy: false,
    researchRunning: false,
    researchRunningCount: 0,
    admissionsPending: 0,
    projectedCompletionLabel: null,
    manualFindOptions: [10, 25, 50, 100],
    ...partial,
  }
}

function productionAuthority(
  partial: Partial<GrowthProductionMissionAuthority> = {},
): GrowthProductionMissionAuthority {
  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    title: "Equipify Growth Mission",
    objectiveStatement: "Maintain portfolio capacity.",
    portfolioBelowTarget: true,
    discoveryActive: true,
    operatorSummaryLines: ["Portfolio is below target, so I'm actively discovering new opportunities."],
    primaryFocus: "discovery",
    ...partial,
  }
}

function operatorFocus(partial: Partial<GrowthCanonicalOperatorFocus> = {}): GrowthCanonicalOperatorFocus {
  return {
    qaMarker: "ge-aios-operator-story-implementation-1a-v1",
    leadId: "lead-focus",
    companyName: "Less Stress Property Management",
    source: "revenue_queue",
    title: "Research Package",
    detail: "82% confidence — Waiting on buying committee verification",
    href: "/growth/leads/lead-focus",
    priorityRank: 4,
    ...partial,
  }
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function main(): void {
  console.log(`[${PHASE}] Human-centered executive briefing certification`)

  runGate("QA marker exported", () => {
    assert.equal(GROWTH_HOME_OPERATOR_EXPERIENCE_2A_QA_MARKER, "ge-aios-home-operator-experience-2a-v1")
  })

  runGate("Hero briefing visible in closure mode (component always renders paragraphs)", () => {
    const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
    assert.doesNotMatch(heroSource, /!compact\s*\?\s*executiveBriefing\.paragraphs/)
    assert.match(heroSource, /executiveBriefing\.paragraphs\.map/)
  })

  runGate("Current assignment removed when runtime authority grid is visible", () => {
    const runtimeSource = readSource(
      "components/growth/workspace/executive-briefing/growth-home-ava-runtime-trust-section.tsx",
    )
    assert.match(runtimeSource, /currentActivity && !closureMode/)
    assert.doesNotMatch(runtimeSource, /Current assignment/)
  })

  runGate("Closure mode surfaces Waiting on You before Runtime Trust", () => {
    const dashboardSource = readSource(
      "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
    )
    assert.match(dashboardSource, /operatorClosureMode \? \([\s\S]*GrowthHomeAiOsWaitingOnYouSection[\s\S]*GrowthHomeAvaRuntimeTrustSection/)
  })

  runGate("Portfolio activity labels are humanized", () => {
    assert.match(humanizeOperatorFacingCopy("Next batch: 25"), /Running discovery batch \(25 companies\)/i)
    const runtime = resolveRuntimeExecutionPresentation({
      pendingApprovals: 0,
      portfolioOperator: portfolio(),
      missionDiscovery: mission(),
      productionMissionAuthority: productionAuthority(),
    })
    assert.match(runtime.currentActivityLabel ?? "", /discovery batch \(25 companies\)/i)
    assert.doesNotMatch(runtime.currentActivityLabel ?? "", /Next batch:/i)
  })

  runGate("Operator focus enrichment uses canonical title/detail", () => {
    const focus = resolveOperatorFocusPresentation({ canonicalOperatorFocus: operatorFocus() })
    assert.equal(focus.operatorFocusCompanyName, "Less Stress Property Management")
    assert.equal(focus.operatorFocusTitle, "Research Package")
    assert.equal(focus.operatorFocusConfidenceLine, "82% confidence")
    assert.match(focus.operatorFocusDetail ?? "", /buying committee verification/i)

    const parsed = parseOperatorFocusConfidenceLine("82% confidence — Waiting on buying committee verification")
    assert.equal(parsed.confidenceLine, "82% confidence")
    assert.match(parsed.explanation ?? "", /buying committee verification/i)
  })

  runGate("Discovery mode hero leads with outcome and forward-looking close", () => {
    const runtime = resolveRuntimeExecutionPresentation({
      pendingApprovals: 0,
      portfolioOperator: portfolio(),
      missionDiscovery: mission(),
      productionMissionAuthority: productionAuthority(),
    })
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Finding Leads",
      missionDiscovery: mission(),
      pendingApprovals: 0,
      portfolioOperator: portfolio(),
      productionMissionAuthority: productionAuthority(),
      primaryMissionLabel: runtime.primaryMissionLabel,
      currentActivityLabel: runtime.currentActivityLabel,
      repliesToday: 2,
      canonicalOperatorFocus: operatorFocus(),
    })
    assert.equal(briefing.paragraphs.length, 3)
    assert.match(briefing.paragraphs[0] ?? "", /sales pipeline growing/i)
    assert.match(briefing.paragraphs[0] ?? "", /Right now I'm researching 25 new prospects/i)
    assert.match(briefing.paragraphs[0] ?? "", /below target/i)
    assert.match(briefing.paragraphs[0] ?? "", /in parallel/i)
    assert.match(briefing.paragraphs[1] ?? "", /don't currently need anything from you/i)
    assert.match(briefing.paragraphs[2] ?? "", /buying committee verification is complete/i)
    assert.doesNotMatch(briefing.paragraphs[2] ?? "", /^Waiting on buying committee verification/i)
  })

  runGate("Review mode hero leads with business outcome and approval path", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Preparing outreach",
      missionDiscovery: mission(),
      pendingApprovals: 1,
      readyForOutreachReview: 0,
      canonicalOperatorFocus: operatorFocus({ source: "approval", title: "Review Less Stress Property Management" }),
    })
    assert.match(briefing.paragraphs[0] ?? "", /sales momentum/i)
    assert.match(briefing.paragraphs[1] ?? "", /need your review on one outreach package/i)
    assert.match(briefing.paragraphs[2] ?? "", /After your review/i)
  })

  runGate("Active lead hero explains advancement toward review-ready outreach", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Researching companies",
      missionDiscovery: mission(),
      pendingApprovals: 0,
      primaryMissionLabel: "Prospect Research",
      currentActivityLabel: "Researching ABC Mechanical",
    })
    assert.match(briefing.paragraphs[0] ?? "", /sales opportunity/i)
    assert.match(briefing.paragraphs[0] ?? "", /ABC Mechanical/i)
    assert.match(briefing.paragraphs[2] ?? "", /Once research is complete/i)
  })

  runGate("Idle healthy portfolio hero reinforces operator confidence", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Idle",
      missionDiscovery: mission({ discoveryAction: "monitoring", startupDiscoveryReady: false }),
      pendingApprovals: 0,
      portfolioOperator: portfolio({
        discoveryRunning: false,
        nextBatchSize: null,
        currentActiveCompanies: 25,
        healthState: "healthy",
        healthLabel: "Portfolio healthy. No action required.",
      }),
      productionMissionAuthority: productionAuthority({
        portfolioBelowTarget: false,
        discoveryActive: false,
        primaryFocus: "portfolio_health",
      }),
      primaryMissionLabel: "Portfolio Maintenance",
    })
    assert.match(briefing.paragraphs[0] ?? "", /portfolio is healthy/i)
    assert.match(briefing.paragraphs[0] ?? "", /continue monitoring the pipeline/i)
    assert.match(briefing.paragraphs[0] ?? "", /review-ready opportunity needs your attention/i)
    assert.match(briefing.paragraphs[1] ?? "", /don't currently need anything from you/i)
    assert.match(briefing.paragraphs[2] ?? "", /qualifying companies until the next review-ready opportunity/i)
  })

  runGate("Runtime trust VM passes operator focus presentation fields", () => {
    const vm = buildGrowthHomeRuntimeTrustViewModel({
      server: {
        qaMarker: GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
        generatedAt: new Date().toISOString(),
        killSwitches: { autonomy_enabled: true, autonomy_objective_mode_enabled: true },
        autonomyTickHealth: null,
        lastSchedulerRunAt: null,
        lastSchedulerOk: null,
        nextSchedulerEstimateAt: null,
      },
      salesOutcomes: null,
      activeWork: null,
      pendingApprovals: 0,
      setupIncomplete: false,
      missionDiscovery: mission(),
      activation: {
        qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
        activated: true,
        activatedAt: "2026-07-22T12:00:00.000Z",
        autonomyEnabled: true,
        objectiveModeEnabled: true,
        readiness: { qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER, ready: true, blockers: [] },
        employment: null,
      },
      canonicalOperatorFocus: operatorFocus(),
      portfolioOperator: portfolio(),
      productionMissionAuthority: productionAuthority(),
    })
    assert.equal(vm.operatorFocusTitle, "Research Package")
    assert.equal(vm.operatorFocusConfidenceLine, "82% confidence")
    assert.match(vm.currentActivityLabel ?? "", /discovery batch/i)
  })

  console.log(`[${PHASE}] PASS`)
}

main()
