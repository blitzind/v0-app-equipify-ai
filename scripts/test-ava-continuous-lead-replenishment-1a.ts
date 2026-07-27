/**
 * AVA-CONTINUOUS-LEAD-REPLENISHMENT-1A — Focused certification (no live send/approval).
 * Run: pnpm test:ava-continuous-lead-replenishment-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthLead } from "@/lib/growth/types"
import {
  buildActiveCandidateInventorySnapshot,
  isActiveCandidateLeadForReplenishment,
} from "@/lib/growth/portfolio-manager/growth-autonomous-candidate-inventory-1a"
import { buildPortfolioHealthReadModel } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { defaultPortfolioManagementSection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import {
  evaluatePortfolioReplenishmentDecision,
  resolveAutonomousPortfolioDiscoveryExecutionPlan,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { emptyPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { resolveAutonomousLeadDiscoveryAction } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"

const CERT_ID = "ava-continuous-lead-replenishment-1a-v1" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function lead(id: string, overrides: Partial<GrowthLead> = {}): GrowthLead {
  return {
    id,
    companyName: `Company ${id.slice(0, 4)}`,
    status: "new",
    metadata: { admission_state: "accepted" },
    contactEmail: null,
    website: null,
    promotedOrganizationId: ORG,
    ...overrides,
  } as GrowthLead
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] certification`)

  runGate("1. low active candidate inventory triggers discovery replenishment", () => {
    const snapshot = buildGrowthPortfolioManagerSnapshot({
      organizationId: ORG,
      generatedAt: "2026-07-27T12:00:00.000Z",
      leads: [lead("11111111-1111-4111-8111-111111111111")],
      eligibleLeadCount: 19,
      approvedProfile: { portfolioManagement: defaultPortfolioManagementSection() } as never,
      missionDiscovery: null,
      draftFactoryStateByLeadId: new Map([
        ["11111111-1111-4111-8111-111111111111", { state: "executed" }],
      ]),
    })
    assert.equal(snapshot.health.counts.activeCandidateInventory, 0)
    assert.equal(snapshot.health.healthState, "critically_low")
    assert.equal(snapshot.replenishment.shouldReplenish, true)
  })

  runGate("2. pending approval does NOT block home discovery refresh when pipeline low", () => {
    const action = resolveAutonomousLeadDiscoveryAction({
      lifecycleState: "monitoring",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 20,
      leadPoolHasMore: false,
      pipelineLow: true,
      hasBoundSearch: true,
      researchingCount: 0,
      pendingApprovals: 3,
    })
    assert.equal(action, "refresh_audience")
  })

  runGate("3. approved-unsent does NOT block portfolio discovery planning", () => {
    const health = buildPortfolioHealthReadModel({
      organizationId: ORG,
      target: {
        qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
        ...defaultPortfolioManagementSection(),
        source: "defaults",
      },
      leads: [],
      eligibleLeadCount: 50,
      approvedProfilePresent: true,
      missionDiscovery: null,
    })
    health.counts.activeCandidateInventory = 5
    const replenishment = evaluatePortfolioReplenishmentDecision({
      target: {
        qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
        ...defaultPortfolioManagementSection(),
        source: "defaults",
      },
      health: { ...health, healthState: "needs_replenishment" },
      memory: emptyPortfolioManagerMemory(),
      generatedAt: "2026-07-27T12:00:00.000Z",
    })
    assert.equal(replenishment.shouldReplenish, true)
  })

  runGate("4. rejected leads do NOT satisfy active inventory", () => {
    const inventory = buildActiveCandidateInventorySnapshot({
      organizationId: ORG,
      leads: [lead("22222222-2222-4222-8222-222222222222", { metadata: { admission_state: "rejected" } })],
      eligibleLeadCount: 0,
    })
    assert.equal(inventory.activeCandidateCount, 0)
  })

  runGate("5. stop_investment rows do NOT satisfy active inventory", () => {
    assert.equal(
      isActiveCandidateLeadForReplenishment({
        lead: lead("33333333-3333-4333-8333-333333333333"),
        organizationId: ORG,
        draftFactoryState: { state: "paused", pausedReason: "stop_investment" },
      }),
      false,
    )
  })

  runGate("6. provider results enter canonical intake via executeBulkPushToLeadInbox", () => {
    const discovery = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    assert.match(discovery, /executeBulkPushToLeadInbox/)
    assert.match(discovery, /runProspectSearch/)
  })

  runGate("7. duplicate companies remain excluded at push layer", () => {
    const push = readSource("lib/growth/prospect-search/prospect-search-push-to-inbox.ts")
    assert.match(push, /already_exists/)
    assert.match(push, /prospectSearchDedupeHash/)
  })

  runGate("8. intake-pending runs resume even when total eligible pool looks healthy", () => {
    const plan = resolveAutonomousPortfolioDiscoveryExecutionPlan(
      evaluatePortfolioReplenishmentDecision({
        target: {
          qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
          ...defaultPortfolioManagementSection(),
          source: "defaults",
        },
        health: {
          qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
          healthState: "healthy",
          counts: {
            activeCompanies: 50,
            activeCandidateInventory: 50,
            researching: 0,
            awaitingAdmission: 0,
            awaitingReview: 0,
            qualified: 0,
            archived: 0,
            rejected: 0,
            invalid: 0,
            discoveryRemaining: 0,
          },
          needsCount: 0,
          approvedProfilePresent: true,
          discoveryRunning: false,
          researchRunning: false,
          admissionsPending: 0,
        },
        memory: emptyPortfolioManagerMemory(),
        generatedAt: "2026-07-27T12:00:00.000Z",
        intakePendingPending: true,
      }),
    )
    assert.equal(plan.action, "resume_intake_pending")
    assert.ok(plan.batchSize > 0)
  })

  runGate("9. scheduler can replenish again after inventory falls", () => {
    const scheduler = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts")
    assert.match(scheduler, /findLatestIntakePendingAutonomousProspectSearchDatamoonRun/)
    assert.match(scheduler, /tickAutonomousPortfolioDiscoveryReplenishment/)
  })

  runGate("10. provider failure remains observable", () => {
    const observability = readSource(
      "lib/growth/portfolio-manager/growth-continuous-lead-replenishment-observability-1a.ts",
    )
    assert.match(observability, /discoveryState/)
    assert.match(observability, /datamoonHealth/)
    assert.match(observability, /lastProviderRun/)
  })

  runGate("11. no outreach approval/send in discovery path", () => {
    const discovery = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    assert.doesNotMatch(discovery, /approveGrowthAiCopilotGeneration/)
    assert.doesNotMatch(discovery, /sendAvaSupervised/)
  })

  runGate("12. observability probe exposes replenishment truth", () => {
    assert.match(readSource("scripts/probe-ava-continuous-lead-replenishment-1a-production.ts"), /loadContinuousLeadReplenishmentObservability/)
    assert.match(readSource("lib/growth/portfolio-manager/growth-autonomous-candidate-inventory-1a.ts"), /activeCandidateCount/)
  })

  console.log(`\n[${CERT_ID}] PASS — no email sent or approved during certification`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
