/**
 * AVA-GROWTH-HOTFIX-1F-1D — Canonical training state + activation restoration certification.
 * Run: pnpm test:ava-growth-hotfix-1f-1d-canonical-training-state
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "../lib/growth/ava-activation/growth-ava-activation-types-1c"
import { buildGrowthTrainingOverviewReadModel } from "../lib/growth/training/build-growth-training-overview-read-model"
import {
  buildGrowthAvaActivationFallbackFromTrainingProjection,
  buildGrowthCanonicalOrganizationTrainingDiagnostic,
} from "../lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix"
import {
  GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER,
  type GrowthCanonicalOrganizationTrainingProjection,
} from "../lib/growth/training/growth-canonical-organization-training-projection-types"
import { buildGrowthHomeRuntimeTrustViewModel } from "../lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { evaluateGrowthAvaActivationReadiness } from "../lib/growth/ava-activation/growth-ava-activation-readiness-1c"
import { synthesizeGrowthHomeLaunchMissionSetup } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import { createDefaultMissionRuntimeState } from "../lib/growth/mission-center/growth-mission-runtime-types"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"
import { GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"

export const AVA_GROWTH_HOTFIX_1F_1D_QA_MARKER =
  "ava-growth-hotfix-1f-1d-canonical-training-state-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildValidatedKnowledgeItem(): OrganizationalKnowledgeItem {
  const now = "2026-07-23T12:00:00.000Z"
  return {
    knowledge_id: "k-fixture-learning",
    organization_id: "org-fixture",
    source: "memory_events",
    specialist: "sales",
    category: "sales_process",
    finding: "Prospects respond better to ROI framing.",
    confidence: 0.9,
    supporting_event_count: 4,
    first_observed_at: now,
    last_confirmed_at: now,
    superseded_by: null,
    active: true,
    metadata: {},
  }
}

function buildReadyObjective(): GrowthObjective {
  return {
    id: "mission-fixture",
    organizationId: "org-fixture",
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
      running: true,
    } as never,
    executionContext: {
      qa_marker: "growth-objective-execution-context-v1",
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: createDefaultMissionRuntimeState({
        datamoon: {
          lastRunId: "run-fixture",
          importRequestJson: '{"filters":[]}',
          lastPollAt: null,
          lastImportedCount: 0,
          keepMonitoring: true,
        },
      }),
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function buildApprovedProfileFixture() {
  return {
    id: "profile-approved-fixture",
    organizationId: "org-fixture",
    status: "approved" as const,
    isActive: true,
    companyName: "Fixture Co",
    website: "https://fixture.example",
    input: {} as never,
    profile: {
      confidence: { score: 88, missingInformation: [] },
      businessStrategy: {
        companyWide: { mission: "Mission", coreValues: ["Value"] },
        messaging: { elevatorPitch: "Pitch", tone: "Direct" },
        positioning: { competitiveAdvantages: ["Speed"], pricingPhilosophy: "Value-based" },
        objections: { items: [{ objection: "Price", preferredResponse: "ROI" }] },
        salesPhilosophy: {
          qualificationStandards: ["Budget confirmed"],
          discoveryQuestions: ["What problem are you solving?"],
        },
        salesAndRelationships: {
          principles: ["Be helpful first"],
          notes: "Long-term partnerships",
        },
      },
    } as never,
    label: "Approved",
    createdBy: "user-fixture",
    approvedBy: "user-fixture",
    approvedAt: "2026-01-15T12:00:00.000Z",
    rejectedAt: null,
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
  }
}

function buildProjectionFixture(input?: {
  activationRecordPresent?: boolean
  readinessReady?: boolean
}): GrowthCanonicalOrganizationTrainingProjection {
  const activeApproved = buildApprovedProfileFixture()
  const objectives = [buildReadyObjective()]
  const readiness = evaluateGrowthAvaActivationReadiness({
    businessProfileApproved: true,
    objectives,
    mailboxWarnings: 0,
    expiredMailboxes: 0,
    connectedMailboxes: 1,
    aiTeammateOnboardingCompleted: true,
    approvalPolicies: {
      requireHumanApprovalBeforeOutreach: true,
      requireHumanApprovalBeforeMeetingBooking: true,
    },
  })

  const launchSetup = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: false,
    objectives,
    mailboxWarnings: 0,
    expiredMailboxes: 0,
    connectedMailboxes: 1,
    aiTeammateOnboardingCompleted: true,
    autonomyGuardrailsConfigured: true,
    calendarConnected: true,
    bookingPagesCount: 1,
  })

  const activationReadiness = input?.readinessReady === false
    ? { ...readiness, ready: false, blockers: [{ id: "growth_profile", label: "Growth Profile", summary: "Missing" }] }
    : readiness

  const knowledgeItems = [buildValidatedKnowledgeItem()]
  const organizationalKnowledge = {
    qaMarker: "ge-aios-organizational-knowledge-v1" as const,
    store: {
      organizationId: "org-fixture",
      capturedAt: "2026-07-23T12:00:00.000Z",
      items: knowledgeItems,
    },
    source: "database" as const,
    degraded: false,
    warning: null,
  }

  const diagnostic = buildGrowthCanonicalOrganizationTrainingDiagnostic({
    organizationId: "org-fixture",
    activeApproved,
    latestDraft: null,
    launchSetup,
    organizationalKnowledge,
    activationReadiness,
    activationRecordPresent: input?.activationRecordPresent ?? true,
    autonomousActivatedAt: input?.activationRecordPresent === false ? null : "2026-02-01T09:00:00.000Z",
  })

  return {
    qaMarker: GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER,
    organizationId: "org-fixture",
    generatedAt: "2026-07-23T12:00:00.000Z",
    activeApproved,
    latestDraft: null,
    launchSetup,
    organizationalKnowledge,
    activationReadiness,
    setupIncomplete: diagnostic.setupIncomplete,
    diagnostic,
  }
}

async function runCertification(): Promise<void> {
  console.log(`[${AVA_GROWTH_HOTFIX_1F_1D_QA_MARKER}] Canonical training + activation certification`)

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /loadGrowthCanonicalOrganizationTrainingProjection/)
  assert.match(summaryService, /canonicalOrganizationTraining/)
  assert.match(summaryService, /buildGrowthAvaActivationFallbackFromTrainingProjection/)

  const trainingHook = readSource("components/growth/training/use-growth-training-overview-data.ts")
  assert.match(trainingHook, /canonicalOrganizationTraining/)
  assert.match(trainingHook, /fetchJson/)

  const briefingDashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(briefingDashboard, /canonicalOrganizationTraining\?\.setupIncomplete/)

  const runtimePresenter = readSource("lib/growth/home/growth-home-runtime-trust-presenter-1b.ts")
  assert.match(runtimePresenter, /Autonomous mode is paused/)
  assert.match(runtimePresenter, /activation\?\.activatedAt && !input\.activation\.activated/)

  const projection = buildProjectionFixture()
  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved: projection.activeApproved,
    latestDraft: projection.latestDraft,
    organizationalKnowledge: projection.organizationalKnowledge,
    launchSetup: projection.launchSetup,
  })

  assert.equal(overview.areas.find((area) => area.id === "company_profile")?.status, "complete")
  assert.equal(overview.areas.find((area) => area.id === "business_strategy")?.status, "complete")
  assert.equal(overview.areas.find((area) => area.id === "runbook")?.status, "complete")
  assert.equal(overview.areas.find((area) => area.id === "learned")?.status, "available")
  assert.match(overview.headline, /understand your business/i)

  const incompleteProjection = buildProjectionFixture({ readinessReady: false })
  assert.equal(incompleteProjection.setupIncomplete, true)
  assert.equal(incompleteProjection.diagnostic.companyProfileState, "approved")

  const pausedActivation = buildGrowthAvaActivationFallbackFromTrainingProjection({
    projection: buildProjectionFixture({ activationRecordPresent: true }),
    autonomyEnabled: false,
    objectiveModeEnabled: false,
  })
  assert.equal(pausedActivation.qaMarker, GROWTH_AVA_ACTIVATION_1C_QA_MARKER)
  assert.equal(pausedActivation.activated, false)
  assert.ok(pausedActivation.activatedAt)
  assert.equal(pausedActivation.readiness.ready, true)

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: {
      qaMarker: "ge-aios-launch-1b-runtime-trust-v1",
      generatedAt: "2026-07-23T12:00:00.000Z",
      killSwitches: { autonomy_enabled: false, autonomy_objective_mode_enabled: false },
      autonomyTickHealth: null,
      canonicalActivity: null,
    },
    salesOutcomes: null,
    activeWork: null,
    pendingApprovals: 0,
    setupIncomplete: false,
    activation: pausedActivation,
    generatedAt: "2026-07-23T12:00:00.000Z",
  })

  assert.equal(runtimeTrust.startStatus.mode, "autonomous_paused")
  assert.match(runtimeTrust.startStatus.headline, /Autonomous mode is paused/)

  assert.equal(projection.diagnostic.validatedLearningCount >= 1, true)
  assert.equal(projection.launchSetup?.qaMarker, GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER)

  execSync("pnpm test:ava-growth-hotfix-1f-1b-home-summary-resilience", {
    cwd: ROOT,
    stdio: "inherit",
  })

  console.log(`[${AVA_GROWTH_HOTFIX_1F_1D_QA_MARKER}] PASS`)
}

void runCertification()
