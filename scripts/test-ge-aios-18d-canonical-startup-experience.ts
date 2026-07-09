/**
 * GE-AIOS-18D — Canonical startup experience certification.
 * Run: pnpm test:ge-aios-18d-canonical-startup-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createDefaultMissionRuntimeState } from "../lib/growth/mission-center/growth-mission-runtime-types"
import {
  GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER,
  GROWTH_HOME_GET_AVA_READY_TITLE,
  GROWTH_HOME_STARTUP_API_PATHS,
  areStartupAutonomyGuardrailsConfigured,
  computeStartupProgressPercent,
  shouldPromoteGetAvaReadyAboveFold,
} from "../lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS,
} from "../lib/growth/home/growth-home-surface-consolidation-17f"
import {
  GROWTH_PROSPECT_SEARCH_BUSINESS_PROFILE_ICP_18D_QA_MARKER,
  mapBusinessProfileContentToProspectSearchIcp,
  resolveProspectSearchAiIcpProfile,
} from "../lib/growth/prospect-search/map-business-profile-to-prospect-search-icp"
import { EQUIPIFY_DEFAULT_AI_ICP_PROFILE } from "../lib/growth/prospect-search/prospect-search-ai-icp-config"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
} from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import {
  synthesizeGrowthHomeLaunchMissionSetup,
} from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"

const PHASE = "GE-AIOS-18D" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function indexOfComponent(source: string, componentName: string): number {
  const tag = `<${componentName}`
  const index = source.indexOf(tag)
  assert.ok(index >= 0, `Expected ${componentName} in source`)
  return index
}

function baseObjective(overrides: Partial<GrowthObjective> = {}): GrowthObjective {
  return {
    id: "mission-1",
    organizationId: "org-1",
    title: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
    description: null,
    objectiveType: "customers_acquired",
    targetValue: 10,
    currentValue: 0,
    startDate: null,
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "high",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: {
      qa_marker: "growth-objective-ge-auto-2g-v1",
      currentStageId: "discover",
      stageStates: {} as never,
      startedAt: new Date().toISOString(),
      lastTickAt: new Date().toISOString(),
      stoppedAt: null,
      estimatedCompletionDate: null,
      running: true,
    },
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: "growth-objective-ge-auto-2g-v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function main(): void {
  console.log(`[${PHASE}] Canonical startup experience certification`)

  assert.equal(
    GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER,
    "ge-aios-18d-canonical-startup-experience-v1",
  )
  assert.equal(GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE, GROWTH_HOME_GET_AVA_READY_TITLE)
  assert.equal(GROWTH_PROSPECT_SEARCH_BUSINESS_PROFILE_ICP_18D_QA_MARKER, "ge-aios-18d-prospect-search-business-profile-icp-v1")
  assert.ok(GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS.includes("get-ava-ready"))
  assert.equal(computeStartupProgressPercent({ completedSteps: 3, totalSteps: 7 }), 43)
  console.log("  ✓ constants and surface audit")

  assert.equal(
    shouldPromoteGetAvaReadyAboveFold({ setupComplete: false, showCard: true }),
    true,
  )
  assert.equal(
    shouldPromoteGetAvaReadyAboveFold({ setupComplete: true, showCard: false }),
    false,
  )
  console.log("  ✓ above-fold promotion rules")

  assert.equal(
    areStartupAutonomyGuardrailsConfigured({
      approvalPolicies: { email_outbound: "always_require_approval" },
    }),
    true,
  )
  assert.equal(
    areStartupAutonomyGuardrailsConfigured({
      approvalPolicies: { email_outbound: "fully_autonomous" },
    }),
    false,
  )
  console.log("  ✓ autonomy guardrails validate real approval policies")

  const incomplete = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: false,
    hasBusinessProfileDraft: false,
    objectives: [],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
    aiTeammateOnboardingCompleted: false,
    autonomyGuardrailsConfigured: false,
    connectedMailboxes: 0,
  })
  assert.equal(incomplete.showCard, true)
  assert.equal(incomplete.setupComplete, false)
  assert.equal(incomplete.currentStepId, "meet_ava")
  assert.equal(incomplete.steps.length, 7)
  assert.equal(incomplete.steps[4]?.id, "approval_guardrails")
  assert.equal(incomplete.steps[4]?.status, "pending")
  assert.equal(incomplete.steps[4]?.actionKind, "open_autonomy_settings")
  assert.ok(incomplete.progressPercent >= 0 && incomplete.progressPercent < 100)
  console.log("  ✓ linear stepper with real autonomy validation")

  const autonomyComplete = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [
      baseObjective({
        executionContext: {
          qa_marker: "growth-objective-execution-context-v1",
          version: 1,
          stages: {},
          recoveredAt: null,
          missionRuntime: createDefaultMissionRuntimeState({
            datamoon: {
              lastRunId: "run-1",
              importRequestJson: '{"filters":[]}',
              lastPollAt: null,
              lastImportedCount: 0,
              keepMonitoring: true,
            },
          }),
        },
      }),
    ],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
    aiTeammateOnboardingCompleted: true,
    autonomyGuardrailsConfigured: true,
    connectedMailboxes: 1,
    calendarConnected: true,
  })
  assert.equal(autonomyComplete.setupComplete, true)
  assert.equal(autonomyComplete.readyForLaunch, true)
  assert.equal(autonomyComplete.showCard, false)
  assert.equal(autonomyComplete.progressPercent, 100)
  console.log("  ✓ ready-to-launch state hides wizard")

  const profileContent: BusinessProfileDraftContent = {
    company: {
      companyName: "Acme Rentals",
      website: "https://acme.example",
      shortDescription: "Equipment rental",
      productsServices: ["Excavators"],
      businessModel: "Rental",
      primaryValueProposition: "Fleet rental for contractors",
    },
    idealCustomers: {
      targetIndustries: ["Construction"],
      companySizeRanges: ["11-50"],
      geography: ["Texas"],
      buyerPersonas: ["Operations manager"],
      disqualifiers: [],
    },
    problemsAndTriggers: {
      painPoints: ["Equipment downtime"],
      buyingTriggers: ["New project"],
      competitorsAlternatives: [],
      keywords: [],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: "$50k",
      salesCycleEstimate: "30 days",
      messagingAngles: [],
      qualificationCriteria: [],
    },
    confidence: { score: 0.8, assumptions: [], missingInformation: [] },
  }
  const mapped = mapBusinessProfileContentToProspectSearchIcp(profileContent, "Acme Rentals")
  assert.equal(mapped.companyLabel, "Acme Rentals")
  assert.match(mapped.whatWeSell, /Fleet rental/)
  assert.deepEqual(mapped.industries, ["Construction"])
  const resolved = resolveProspectSearchAiIcpProfile({ approvedProfileContent: profileContent })
  assert.notDeepEqual(resolved, EQUIPIFY_DEFAULT_AI_ICP_PROFILE)
  const fallback = resolveProspectSearchAiIcpProfile({ approvedProfileContent: null })
  assert.deepEqual(fallback, EQUIPIFY_DEFAULT_AI_ICP_PROFILE)
  console.log("  ✓ Prospect Search uses approved Growth Profile when present")

  const setupComponent = readSource(
    "components/growth/workspace/executive-briefing/growth-home-start-ava-setup-section.tsx",
  )
  assert.match(setupComponent, /data-qa-marker-18d=\{GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER\}/)
  assert.match(setupComponent, /placement\?: "primary" \| "secondary"/)
  assert.match(setupComponent, /GROWTH_HOME_STARTUP_API_PATHS\.autonomy/)
  assert.match(setupComponent, /GROWTH_HOME_STARTUP_API_PATHS\.aiTeammate/)
  assert.match(setupComponent, /GROWTH_HOME_STARTUP_API_PATHS\.operatorSetupHealth/)
  assert.match(setupComponent, /<Progress value=\{setup\.progressPercent\}/)
  assert.doesNotMatch(setupComponent, /GetAvaReadyWizard|StartupWizard|OnboardingWizard/)
  console.log("  ✓ single Start Ava wizard extended — no duplicate wizard")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  const heroIndex = indexOfComponent(dashboard, "GrowthHomeAvaHeroSection")
  const primarySetupIndex = dashboard.indexOf('placement="primary"')
  const workIndex = indexOfComponent(dashboard, "GrowthHomeAvaWorkSection")
  const secondarySetupIndex = dashboard.indexOf('placement="secondary"')
  const setupDiagnosticsIndex = dashboard.indexOf('sectionId="setup-diagnostics"')
  assert.ok(primarySetupIndex >= 0)
  assert.ok(heroIndex < primarySetupIndex)
  assert.ok(primarySetupIndex < workIndex)
  assert.ok(secondarySetupIndex > setupDiagnosticsIndex)
  assert.doesNotMatch(dashboard, /fetch\(/)
  console.log("  ✓ Home promotes Get Ava Ready above fold without workspace-summary fetch")

  const prospectShell = readSource("components/growth/prospect-search/prospect-search-shell.tsx")
  const prospectWorkspace = readSource("components/growth/prospect-search/prospect-search-ai-first-workspace.tsx")
  assert.match(prospectShell, /resolveProspectSearchAiIcpProfile/)
  assert.match(prospectShell, /GROWTH_BUSINESS_PROFILE_API_PATH/)
  assert.match(prospectWorkspace, /resolveProspectSearchAiIcpProfile/)
  console.log("  ✓ Prospect Search wired to approved business profile")

  assert.equal(GROWTH_HOME_STARTUP_API_PATHS.autonomy, "/api/growth/workspace/settings/autonomy")
  assert.equal(GROWTH_HOME_STARTUP_API_PATHS.aiTeammate, "/api/growth/workspace/settings/ai-teammate")

  console.log(`[${PHASE}] PASS — ${GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER}`)
}

main()
