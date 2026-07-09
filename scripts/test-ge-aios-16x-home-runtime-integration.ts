/**
 * GE-AIOS-16X — Home runtime integration certification.
 * Run: pnpm test:ge-aios-16x-home-runtime-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeLeadPoolSummary } from "../lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildHomeRelationshipScaleLine,
  buildHomeRuntimeBriefingIntro,
  buildHomeWorkItemPresentation,
  enrichGrowthHomeWaitingOnYouItem,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
} from "../lib/growth/home/growth-home-runtime-presenter"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER } from "../lib/growth/relationship/relationship-lead-snapshot-types"
import { buildStubSpecialistStatusLabel } from "../lib/growth/home/growth-home-runtime-presenter"
import {
  normalizeGrowthHomeAvaHeroViewModel,
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "../lib/growth/home/growth-home-runtime-safe-defaults"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"

const PHASE = "GE-AIOS-16X" as const
const LEAD_ID = "11111111-1111-4111-8111-111111111111"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Home Runtime Integration certification`)

  assert.equal(GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER, "ge-aios-16x-home-runtime-integration-v1")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeAvaHeroSection/)
  assert.match(dashboard, /GrowthHomeAvaWorkSection/)
  assert.match(dashboard, /GrowthHomeAvaOperatingRhythmSection/)
  assert.match(dashboard, /GrowthHomeAvaMemorySection/)
  assert.match(dashboard, /GrowthHomeAvaSpecialistTeamSection/)
  assert.match(dashboard, /GrowthHomeAiOsWaitingOnYouSection/)
  assert.match(dashboard, /leadPool=\{workspaceSummary\?\.leadPool/)
  assert.match(dashboard, /relationshipSnapshotsById=\{workspaceSummary\?\.relationshipSnapshots/)
  assert.match(dashboard, /normalizeGrowthHomeAvaHeroViewModel/)
  assert.match(dashboard, /normalizeGrowthHomeAiOsUxViewModel/)
  assert.doesNotMatch(dashboard, /GrowthHomeDailyWorkQueueSection/)
  assert.doesNotMatch(dashboard, /GrowthHomeDailyBriefingSection/)
  assert.doesNotMatch(dashboard, /fetch\(/)

  assert.ok(dashboard.indexOf("<GrowthHomeAvaHeroSection") < dashboard.indexOf("<GrowthHomeAvaWorkSection"))
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaSpecialistTeamSection") <
      dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection") <
      dashboard.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.doesNotMatch(hook, /Promise\.all\(\[.*workspace-summary/)
  assert.match(hook, /normalizeGrowthHomeWorkspaceSummaryPayload/)

  const heroUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroUi, /buildHomeRelationshipScaleLine/)
  assert.match(heroUi, /dailyActivityNarrative/)
  assert.match(heroUi, /data-qa-field="home-relationship-scale-line"/)
  assert.doesNotMatch(heroUi, /Decision Engine|Work Manager|Operating Rhythm|Specialist Orchestrator|Business Intelligence/)

  const workUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx")
  assert.match(workUi, /buildHomeWorkItemPresentation/)
  assert.match(workUi, /HOME_RUNTIME_EMPTY_WORK_MESSAGE/)
  assert.doesNotMatch(workUi, /work_plan\.length === 0\) return null/)

  const rhythmUi = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
  )
  assert.match(rhythmUi, /buildHomeDefaultOperatingRhythmPhases/)
  assert.match(rhythmUi, /HOME_RUNTIME_EMPTY_PROGRESS_MESSAGE/)
  assert.doesNotMatch(rhythmUi, /phaseTimeline\.length === 0\) return null/)

  const memoryUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx")
  assert.match(memoryUi, /HOME_RUNTIME_EMPTY_MEMORY_MESSAGE/)
  assert.doesNotMatch(memoryUi, /bullets\.length === 0\) return null/)

  const teamUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx")
  assert.match(teamUi, /buildTeammateHandlingRows/)
  assert.match(teamUi, /GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE/)
  assert.doesNotMatch(teamUi, /specialist_name/)

  const waitingUi = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(waitingUi, /AVA_HOME_WAITING_ON_YOU_TITLE/)
  assert.match(waitingUi, /enrichGrowthHomeWaitingOnYouItems/)
  assert.match(waitingUi, /GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER/)
  assert.doesNotMatch(waitingUi, /GROWTH_HOME_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER/)
  assert.match(waitingUi, /item\.href/)
  assert.doesNotMatch(waitingUi, /Needs Your Decision/)

  const leadPool = buildGrowthHomeLeadPoolSummary({
    visibleLeads: Array.from({ length: 248 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      createdAt: new Date().toISOString(),
    })),
    totalEstimatedCount: 1_240,
    relationshipSnapshotCount: 250,
    fetchedHasMore: true,
  })
  const scaleLine = buildHomeRelationshipScaleLine(leadPool)
  assert.ok(scaleLine?.includes("248") || scaleLine?.includes("250") || scaleLine?.includes("1,240") || scaleLine?.includes("1240"))

  const workItem: AvaWorkItem = {
    id: "work:1",
    type: "outreach",
    title: "Prepare outreach — Precision Biomedical",
    description: "Ready for operator review.",
    status: "working",
    priority: 90,
    source: "decision_engine",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_minutes: 15,
    estimated_revenue_impact: null,
    requires_operator: true,
    can_execute_autonomously: false,
    depends_on: [],
    blocked_by: [],
    next_action: "review_outreach",
    decision_score: 92,
    confidence: 88,
    href: `/growth/leads/${LEAD_ID}`,
    company_name: "Precision Biomedical",
    decision_source_id: `research:${LEAD_ID}`,
    assigned_specialist: "sales",
    relationship_graph: {
      lead_id: LEAD_ID,
      relationship_stage: "qualified",
      waiting_on_operator: true,
      next_best_action: "review_outreach",
      next_best_action_reason: "Outreach draft needs approval.",
    },
  }

  const presentation = buildHomeWorkItemPresentation(workItem)
  assert.equal(presentation.companyName, "Precision Biomedical")
  assert.equal(presentation.specialistLabel, null)
  assert.ok(presentation.relationshipStage?.includes("qualif"))

  const enriched = enrichGrowthHomeWaitingOnYouItem(
    {
      id: "queue-waiting-1",
      label: "Account waiting",
      detail: "",
      href: `/growth/leads/${LEAD_ID}`,
    },
    {
      [LEAD_ID]: {
        qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
        lead_id: LEAD_ID,
        relationship_stage: "qualified",
        next_best_action: "review_outreach",
        next_best_action_reason: "Outreach draft needs approval.",
      },
    },
  )
  assert.doesNotMatch(enriched.label, /account waiting/i)
  assert.doesNotMatch(enriched.label, /this account waiting/i)
  assert.match(enriched.label, /Precision|review|outreach|qualification/i)

  const genericWaiting = enrichGrowthHomeWaitingOnYouItem(
    {
      id: "queue-waiting-1",
      label: "Account waiting",
      detail: "Human approval required before I can continue.",
      href: `/growth/leads/${LEAD_ID}`,
    },
    undefined,
    { [LEAD_ID]: "Precision Biomedical" },
  )
  assert.doesNotMatch(genericWaiting.label, /this account/i)
  assert.match(genericWaiting.label, /Precision Biomedical|Review next step|Review pending/i)

  const intro = buildHomeRuntimeBriefingIntro({
    leadPool,
    leadsNeedingAction: 12,
    pendingApprovals: 2,
    activeWork: workItem,
    waitingCount: 2,
    hasWorkPlan: true,
  })
  assert.ok(intro.length >= 2)
  assert.ok(intro.some((line) => /relationship|pipeline|approval|Precision|getting today/i.test(line)))

  const sparseIntro = buildHomeRuntimeBriefingIntro({
    leadsNeedingAction: 7,
    pendingApprovals: 7,
    waitingCount: 7,
    hasWorkPlan: false,
    statusLabel: "Waiting for approval",
  })
  assert.ok(sparseIntro.length >= 2)
  assert.ok(sparseIntro.some((line) => /don't have accounts|getting today/i.test(line)))
  assert.ok(sparseIntro.some((line) => /tracking 7 relationships/i.test(line)))

  const stubLabel = buildStubSpecialistStatusLabel({
    specialistId: "marketing",
    activeCount: 0,
    fallbackLabel: "unused",
  })
  assert.match(stubLabel, /marketing|No active work yet/i)

  const partialSummary = normalizeGrowthHomeWorkspaceSummaryPayload({ ok: true } as never)
  assert.ok(partialSummary.leadPool)
  assert.ok(partialSummary.relationshipSnapshots)

  const partialHero = normalizeGrowthHomeAvaHeroViewModel({
    qaMarker: "growth-ge-aios-7a-ava-home-experience-v1",
    greeting: "Good morning.",
    statusLabel: "Working",
    statusKind: "working",
    currentActivities: [],
    sinceLastVisit: [],
    primaryDecision: null,
    additionalDecisionCount: 0,
    reviewAllHref: null,
    allNormalLine: "All normal.",
    storyBlocks: undefined as never,
    briefingNarrative: undefined as never,
  })
  partialHero.storyBlocks.filter(() => true)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const newMigrations = fs.readdirSync(migrationDir).filter((name) => name.includes("16x"))
  assert.equal(newMigrations.length, 0, "16X must not add schema migrations")

  console.log(`[${PHASE}] PASS — Home Runtime Integration certified (local)`)
}

main()
