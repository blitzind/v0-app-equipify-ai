/**
 * GE-AIOS-19C-2H — First-week experience certification.
 * Run: pnpm test:ge-aios-19c-2h-first-week-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthFirstWeekExperienceReadModel,
  GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER,
  GROWTH_FIRST_WEEK_STEP_DEFINITIONS,
} from "../lib/growth/home/growth-first-week-experience-19c-2h"
import { GROWTH_HOME_BRIEFING_CROSS_LINKS } from "../lib/growth/home/growth-home-cleanup-19c-2g"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "../lib/growth/ava-about/growth-ava-about-workspace-types"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "../lib/growth/operations-center/growth-sales-operations-center-types"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_LEARNED_ROUTE,
} from "../lib/growth/training/growth-training-workspace-types"

const PHASE = "GE-AIOS-19C-2H" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseInput(overrides: Partial<Parameters<typeof buildGrowthFirstWeekExperienceReadModel>[0]> = {}) {
  return {
    now: new Date("2026-07-09T12:00:00.000Z"),
    onboardingCompleted: true,
    setupIncomplete: false,
    waitingOnYou: [],
    workManager: null,
    pendingApprovals: 0,
    emailsSentToday: 0,
    outreachPreparedToday: 0,
    organizationalKnowledgeCount: 0,
    learnedTodayCount: 0,
    storage: { startedAt: "2026-07-08T12:00:00.000Z" },
    ...overrides,
  }
}

function main(): void {
  console.log(`[${PHASE}] First-week experience certification`)

  assert.equal(GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER, "ge-aios-19c-2h-first-week-experience-v1")
  assert.equal(GROWTH_FIRST_WEEK_STEP_DEFINITIONS.length, 5)
  console.log("  ✓ QA marker and five step definitions")

  const hrefs = GROWTH_FIRST_WEEK_STEP_DEFINITIONS.map((row) => row.href)
  assert.ok(hrefs.includes(GROWTH_TRAINING_COMPANY_PROFILE_ROUTE))
  assert.ok(hrefs.includes(GROWTH_SALES_OPERATIONS_CENTER_ROUTE))
  assert.ok(hrefs.some((href) => /\/approvals/.test(href)))
  assert.ok(hrefs.includes(GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE))
  assert.ok(hrefs.includes(GROWTH_TRAINING_LEARNED_ROUTE))
  console.log("  ✓ steps link to Training, Operations, Approvals surfaces")

  const aboutHref = GROWTH_HOME_BRIEFING_CROSS_LINKS.find((row) => row.id === "about-ai")?.href
  assert.equal(aboutHref, GROWTH_AVA_ABOUT_WORKSPACE_ROUTE)
  console.log("  ✓ About Your AI remains on briefing cross-links (Home surface)")

  const afterLaunch = buildGrowthFirstWeekExperienceReadModel(baseInput())
  assert.equal(afterLaunch.visible, true)
  assert.equal(afterLaunch.steps.find((row) => row.id === "company_profile")?.status, "complete")
  assert.equal(afterLaunch.recommendedStep?.id, "watch_operations")
  console.log("  ✓ appears after setup complete (onboarding + setup done, within first week)")

  const profileStillNeeded = buildGrowthFirstWeekExperienceReadModel(
    baseInput({
      waitingOnYou: [{ label: "Confirm business profile", detail: "Review facts in Training", href: "/growth/training" }],
    }),
  )
  assert.equal(profileStillNeeded.recommendedStep?.id, "company_profile")
  console.log("  ✓ recommends Company Profile when runtime still waiting on profile")

  const beforeOnboarding = buildGrowthFirstWeekExperienceReadModel(
    baseInput({ onboardingCompleted: false }),
  )
  assert.equal(beforeOnboarding.visible, false)
  console.log("  ✓ hidden before onboarding complete")

  const beforeSetup = buildGrowthFirstWeekExperienceReadModel(baseInput({ setupIncomplete: true }))
  assert.equal(beforeSetup.visible, false)
  console.log("  ✓ hidden before setup complete")

  const afterWeek = buildGrowthFirstWeekExperienceReadModel(
    baseInput({ storage: { startedAt: "2026-06-01T12:00:00.000Z" } }),
  )
  assert.equal(afterWeek.visible, false)
  console.log("  ✓ not shown forever (hidden after 7 days)")

  const dismissed = buildGrowthFirstWeekExperienceReadModel(
    baseInput({ storage: { startedAt: "2026-07-08T12:00:00.000Z", dismissedAt: "2026-07-09T10:00:00.000Z" } }),
  )
  assert.equal(dismissed.visible, false)
  console.log("  ✓ dismissible without blocking work")

  const profileComplete = buildGrowthFirstWeekExperienceReadModel(
    baseInput({
      waitingOnYou: [],
      workManager: {
        qaMarker: "ge-aios-11a-work-manager-v1",
        active_work: null,
        work_plan: [],
        blocked: [],
        completed_today: [],
        deferred: [],
        interruptions: [],
        operator_queue: [],
        all_work_items: [{ id: "w1" } as never],
      },
    }),
  )
  assert.equal(profileComplete.steps.find((row) => row.id === "company_profile")?.status, "complete")
  assert.equal(profileComplete.steps.find((row) => row.id === "watch_operations")?.status, "complete")
  assert.equal(profileComplete.recommendedStep?.id, "approve_outreach")
  console.log("  ✓ runtime signals drive step completion (never fabricated)")

  const guideSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-first-week-guide.tsx",
  )
  assert.doesNotMatch(guideSource, /fetch\(/)
  assert.doesNotMatch(guideSource, /GrowthHomeStartAvaSetupSection/)
  assert.match(guideSource, /GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER/)
  console.log("  ✓ guide component has no fetch and no duplicate onboarding wizard")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeFirstWeekGuide/)
  assert.doesNotMatch(dashboard, /fetch\(/)
  assert.match(dashboard, /GrowthHomeBriefingCrossLinks/)
  assert.doesNotMatch(dashboard, /GrowthHomeGrowthStrategySection/)
  console.log("  ✓ wired on Home without extra fetch; Home remains briefing-only")

  const apiDir = path.join(process.cwd(), "app/api")
  const firstWeekApiHits = fs
    .readdirSync(apiDir, { recursive: true })
    .map(String)
    .filter((file) => /first-week|first_week/i.test(file))
  assert.equal(firstWeekApiHits.length, 0)
  console.log("  ✓ no new first-week API routes")

  const libSource = readSource("lib/growth/home/growth-first-week-experience-19c-2h.ts")
  assert.match(libSource, /localStorage/)
  assert.doesNotMatch(libSource, /supabase/)
  assert.doesNotMatch(libSource, /prisma/)
  console.log("  ✓ client localStorage only for anchor/dismiss (no new storage backend)")

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /useGrowthWorkspaceDashboard/)
  assert.doesNotMatch(dashboardBody, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  console.log("  ✓ single workspace-summary fetch preserved")

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.match(hook, /fetchGrowthHomeWorkspaceSummary/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  console.log("  ✓ workspace-summary API path unchanged")

  console.log(`[${PHASE}] PASS — First-week experience certified (local)`)
}

main()
