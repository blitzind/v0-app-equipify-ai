/**
 * GE-AIOS-18E — Living Home (Ava Feels Like an Employee) certification.
 * Run: pnpm test:ge-aios-18e-living-home
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyActivityNarrative } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import {
  buildPersonalizedHomeGreeting,
  formatLivingWaitingSummary,
  GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER,
  HOME_LIVING_EMPTY_MEMORY_MESSAGE,
  HOME_LIVING_EMPTY_WORK_MESSAGE,
  HOME_LIVING_GET_AVA_READY_TITLE,
} from "../lib/growth/home/growth-home-living-experience-18e"
import { buildNarrativeIntelligenceOpeningLine } from "../lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { buildWhatIveLearnedBullets } from "../lib/growth/memory/bridges/narrative-memory"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "../lib/growth/memory/types"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "../lib/growth/operating-rhythm/types"
import { buildSpecialistTeamStatus } from "../lib/growth/specialists/bridges/work-manager-bridge"
import { GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER } from "../lib/growth/specialists/types"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"
import { GROWTH_HOME_AI_OS_UX_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { synthesizeGrowthHomeLaunchMissionSetup } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "../lib/growth/work-manager/types"

const PHASE = "GE-AIOS-18E" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function emptyWorkManagerResult() {
  return {
    qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
    active_work: null,
    work_plan: [],
    operator_queue: [],
    blocked: [],
    completed_today: [],
    deferred: [],
    interruptions: [],
    all_work_items: [],
  }
}

function emptyOperatingRhythm() {
  return {
    qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
    current_phase: "morning_planning" as const,
    completed_phases: [],
    next_phase: null,
    active_cycle: null,
    today_plan: [],
    phase_timeline: [],
    interruptions: [],
    waiting_on_operator: [],
    end_of_day_summary: null,
  }
}

function knowledgeItem(finding: string): OrganizationalKnowledgeItem {
  const now = new Date().toISOString()
  return {
    knowledge_id: `k-${finding.slice(0, 8)}`,
    organization_id: "org-1",
    source: "memory_events",
    specialist: "sales",
    category: "company_size",
    finding,
    confidence: 0.82,
    supporting_event_count: 3,
    first_observed_at: now,
    last_confirmed_at: now,
    superseded_by: null,
    active: true,
    metadata: {},
  }
}

function approvalWorkItem(): AvaWorkItem {
  const now = new Date().toISOString()
  return {
    id: "approval-1",
    type: "approval",
    status: "blocked",
    title: "Approve outreach draft",
    description: null,
    company_name: "Acme",
    href: "/growth/approvals/1",
    priority: 1,
    source: "operator_queue",
    created_at: now,
    updated_at: now,
    estimated_minutes: null,
    estimated_revenue_impact: null,
    requires_operator: true,
    can_execute_autonomously: false,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 0.8,
    confidence: 0.8,
    decision_source_id: "decision-1",
    assigned_specialist: "sales",
  }
}

function main(): void {
  console.log(`[${PHASE}] Living Home certification`)

  assert.equal(GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER, "ge-aios-18e-living-home-v1")
  assert.equal(GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE, HOME_LIVING_GET_AVA_READY_TITLE)
  console.log("  ✓ 18E constants and Get Ava Ready title")

  const greeting = buildPersonalizedHomeGreeting({
    hour: 9,
    greeting: "Good morning",
    operatorDisplayName: "Mike Johnson",
  })
  assert.equal(greeting, "Good morning, Mike.")
  const greetingNoName = buildPersonalizedHomeGreeting({ hour: 14, greeting: null, operatorDisplayName: null })
  assert.equal(greetingNoName, "Good afternoon.")
  console.log("  ✓ personalized greeting restored with first name")

  const hero = buildAvaHomeHero({
    greeting: "Good morning",
    hour: 9,
    employeeStatus: { kind: "idle", label: "Getting oriented" },
    aiOsUx: {
      qaMarker: GROWTH_HOME_AI_OS_UX_QA_MARKER,
      hero: { greeting: "Good morning", headline: "", subheadline: "" },
      waitingOnYou: [],
      waitingOnYouOverflow: 0,
      approveItemsCount: 0,
      approveItemsHref: null,
      liveStatus: null,
      dailyWorkQueueBuckets: null,
      dailyWorkQueue: [],
      throughput: [],
      mailboxDomainHealth: null,
      autonomousReadiness: null,
    },
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    operatorDisplayName: "Mike Johnson",
  })
  assert.match(hero.greeting, /Mike/)
  console.log("  ✓ user name appears in hero greeting")

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: {
      qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
      period_summary: null,
      learned_insights: [],
      organizational_knowledge: [
        knowledgeItem("Medical equipment companies with 20–100 technicians respond more frequently."),
      ],
      detected_patterns: [],
      recent_events: [],
      timeline: [],
      important_events: [],
      preferences: [],
      corrections: [],
      unanswered_questions: [],
    },
    workResult: emptyWorkManagerResult(),
    operatingRhythm: emptyOperatingRhythm(),
    hour: 10,
  })
  assert.equal(narrative.qaMarker, GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER)
  assert.ok(narrative.learned_today.length > 0)
  assert.match(narrative.learned_today[0] ?? "", /learned/i)
  console.log("  ✓ narrative learned lines come from organizational knowledge")

  const emptyNarrative = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: emptyWorkManagerResult(),
    operatingRhythm: emptyOperatingRhythm(),
    hour: 10,
  })
  assert.equal(emptyNarrative.working_next[0], HOME_LIVING_EMPTY_WORK_MESSAGE)
  console.log("  ✓ home gracefully degrades when runtime empty")

  const knowledgeBullets = buildWhatIveLearnedBullets({
    qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
    period_summary: null,
    learned_insights: ["Legacy insight"],
    organizational_knowledge: [
      knowledgeItem("Shorter outreach subject lines improved reply rates this week."),
    ],
    detected_patterns: [],
    recent_events: [],
    timeline: [],
    important_events: [],
    preferences: [],
    corrections: [],
    unanswered_questions: [],
  })
  assert.match(knowledgeBullets[0] ?? "", /reply rates/i)
  console.log("  ✓ learning section prefers organizational knowledge")

  const emptyKnowledge = buildWhatIveLearnedBullets(null)
  assert.deepEqual(emptyKnowledge, [])
  assert.match(HOME_LIVING_EMPTY_MEMORY_MESSAGE, /patterns/i)
  console.log("  ✓ empty learning copy explains naturally")

  const specialistStatus = buildSpecialistTeamStatus([], {
    workManagerResult: {
      ...emptyWorkManagerResult(),
      interruptions: [],
      operator_queue: [approvalWorkItem()],
    },
  })
  const sales = specialistStatus.find((row) => row.specialist_id === "sales")
  assert.ok(sales)
  assert.match(sales?.status_label ?? "", /approval/i)
  console.log("  ✓ specialist cards explain idle state with runtime context")

  const setup = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: false,
    hasBusinessProfileDraft: false,
    objectives: [],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
    connectedMailboxes: 0,
    aiTeammateOnboardingCompleted: false,
    autonomyGuardrailsConfigured: false,
  })
  const mailboxStep = setup.steps.find((step) => step.id === "mailbox_readiness")
  const leadStep = setup.steps.find((step) => step.id === "lead_source")
  assert.match(mailboxStep?.summary ?? "", /^I need an email account/i)
  assert.match(leadStep?.summary ?? "", /^I need/i)
  assert.ok(setup.steps.every((step) => !/^Connect (mailbox|your mailbox)/i.test(step.summary)))
  console.log("  ✓ Get Ava Ready wizard uses Ava first-person voice")

  const opening = buildNarrativeIntelligenceOpeningLine({
    focus: emptyNarrative.focus,
    hasPrimaryDecision: false,
  })
  assert.match(opening ?? "", /preparing|oriented/i)
  const waitingSummary = formatLivingWaitingSummary({ approvalCount: 2 })
  assert.match(waitingSummary, /I've prepared 2 outreach drafts/)
  console.log("  ✓ living opening and waiting copy in Ava voice")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  const heroSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx",
  )
  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  const appDir = path.join(process.cwd(), "app/api/platform/growth/home")

  assert.doesNotMatch(dashboard, /fetch\(/)
  assert.match(dashboard, /operatorDisplayName/)
  assert.match(dashboard, /useAdmin\(\)/)
  assert.match(dashboard, /buildAvaHomeHero\(/)
  assert.match(dashboard, /organizationalKnowledge/)
  assert.match(heroSection, /data-qa-marker-18e/)
  assert.match(heroSection, /buildNarrativeIntelligenceOpeningLine/)
  assert.match(heroSection, /HOME_LIVING_ALL_CLEAR_WITH_NARRATIVE/)
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.doesNotMatch(hook, /Promise\.all\(\[.*workspace-summary/)
  console.log("  ✓ single workspace-summary fetch preserved; no dashboard fetch")

  const apiRoutes = fs
    .readdirSync(appDir, { recursive: true })
    .filter((entry) => typeof entry === "string" && entry.endsWith("route.ts"))
    .map((entry) => path.join(appDir, entry as string))
  const livingHomeApiCandidates = apiRoutes.filter((routePath) =>
    /living|narrative-engine|daily-report/i.test(fs.readFileSync(routePath, "utf8")),
  )
  assert.equal(livingHomeApiCandidates.length, 0)
  console.log("  ✓ no new Home APIs")

  const livingModule = readSource("lib/growth/home/growth-home-living-experience-18e.ts")
  assert.doesNotMatch(livingModule, /runNarrativeEngine|new.*Engine|schedule/i)
  const briefingEngine = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(briefingEngine, /buildAvaDailyActivityNarrative/)
  assert.doesNotMatch(heroSection, /buildAvaDailyActivityNarrative/)
  console.log("  ✓ no duplicate narrative engine on Home UI")

  const memorySection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx",
  )
  const rhythmSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
  )
  const waitingSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )

  assert.match(memorySection, /buildWhatIveLearnedBullets/)
  assert.match(rhythmSection, /phase\.summary/)
  assert.match(waitingSection, /formatLivingWaitingSummary/)
  assert.match(waitingSection, /data-qa-marker-18e/)
  console.log("  ✓ Home sections wired to existing runtime presenters")

  console.log(`\n[${PHASE}] PASS — Living Home certified`)
}

main()
