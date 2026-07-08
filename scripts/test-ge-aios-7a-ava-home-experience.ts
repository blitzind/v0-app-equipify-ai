/**
 * GE-AIOS-7A — Unified Ava Home experience certification.
 * Run: pnpm test:ge-aios-7a-ava-home-experience
 *
 * Presentation-only: verifies the unified hero view model, the Revenue Queue
 * summary KPI set, collapsible remembered sections, and that Home still uses a
 * single workspace-summary request. No backend/schema/API changes.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_AVA_ALL_NORMAL_LINE,
  GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
  buildAvaCurrentActivities,
  buildAvaHomeHero,
  buildAvaPrimaryDecision,
  buildAvaSinceLastVisit,
} from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildExecutiveSnapshotKpis } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import type {
  GrowthHomeAiEmployeeStatus,
  GrowthHomeAiOsUxViewModel,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-7A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseAiOsUx(overrides: Partial<GrowthHomeAiOsUxViewModel> = {}): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
    hero: {} as never,
    waitingOnYou: [],
    waitingOnYouOverflow: 0,
    approveItemsHref: null,
    approveItemsCount: 0,
    liveStatus: null,
    dailyWorkQueueBuckets: null,
    dailyWorkQueue: [],
    throughput: [],
    mailboxDomainHealth: null,
    autonomousReadiness: null,
    ...overrides,
  }
}

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-1",
  completedAt: new Date().toISOString(),
  companiesReviewed: 5,
  researchCompleted: 5,
  buyingSignalsVerified: 3,
  readyForOutreachReview: 2,
  qualificationCompleted: 4,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 5 companies.",
  leadResults: [],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

const idleStatus: GrowthHomeAiEmployeeStatus = {
  kind: "idle",
  label: "Idle",
  activityLabel: "standing by",
}

function main(): void {
  console.log(`[${PHASE}] Unified Ava Home experience certification`)

  assert.equal(GROWTH_HOME_AVA_HERO_7A_QA_MARKER, "growth-ge-aios-7a-ava-home-experience-v1")

  // Phase 2 — "Since your last visit" derived from the research loop summary.
  const since = buildAvaSinceLastVisit({ researchLoopSummary: researchSummary, accomplishments: [] })
  assert.ok(since.some((item) => /researched 5 companies/.test(item.label)))
  assert.ok(since.some((item) => /qualified 4/.test(item.label)))
  assert.ok(since.some((item) => /prepared 2 opportunities/.test(item.label)))
  assert.ok(since.length <= 4)

  // Phase 4 — Dynamic status reflects real signals, not a generic "Working".
  const activities = buildAvaCurrentActivities({
    employeeStatus: { kind: "monitoring_replies", label: "Monitoring replies", activityLabel: "" },
    aiOsUx: baseAiOsUx({ approveItemsCount: 2 }),
    researchLoopSummary: researchSummary,
    repliesWaiting: 3,
  })
  const labels = activities.map((a) => a.label)
  assert.ok(labels.includes("Researching leads"))
  assert.ok(labels.includes("Monitoring replies"))
  assert.ok(labels.includes("Preparing opportunities"))
  assert.ok(labels.some((l) => /Waiting for 2 approvals/.test(l)))

  // Phase 2 — "I only need one thing": single decision + overflow.
  const decision = buildAvaPrimaryDecision(
    baseAiOsUx({
      approveItemsCount: 3,
      approveItemsHref: "/growth/approvals",
      waitingOnYou: [
        { id: "d1", label: "Approve Best Buy Co", detail: "Outreach ready", href: "/growth/leads/1" },
        { id: "d2", label: "Approve Acme", detail: "Outreach ready", href: "/growth/leads/2" },
      ],
    }),
  )
  assert.equal(decision.primaryDecision?.label, "Approve Best Buy Co")
  assert.equal(decision.additionalDecisionCount, 2)
  assert.equal(decision.reviewAllHref, "/growth/approvals")

  // Empty decision → "everything is running normally".
  const hero = buildAvaHomeHero({
    greeting: "Good morning, Michael.",
    hour: 14,
    employeeStatus: idleStatus,
    aiOsUx: baseAiOsUx(),
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
  })
  assert.equal(hero.greeting, "Good afternoon, Michael.")
  assert.equal(hero.primaryDecision, null)
  assert.equal(hero.allNormalLine, GROWTH_HOME_AVA_ALL_NORMAL_LINE)
  assert.ok(hero.currentActivities.length > 0)

  // Phase 5 — Revenue Queue summary: exactly four operator KPIs.
  const kpis = buildExecutiveSnapshotKpis({
    hero: { executiveKpis: [], expectedOutcomeToday: null } as never,
    aiOsUx: baseAiOsUx({ approveItemsCount: 1, dailyWorkQueue: [{} as never, {} as never] }),
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [
        { id: "my-queue", metrics: [{ label: "Leads needing action", value: 7, href: "/growth" }] },
        { id: "activity", metrics: [{ label: "Replies today", value: 4, href: "/growth" }] },
      ],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    } as never,
  })
  assert.equal(kpis.length, 4)
  assert.deepEqual(
    kpis.map((k) => k.label),
    ["Revenue Queue", "Needs Review", "Replies Waiting", "Today's Focus"],
  )
  assert.equal(kpis[0]?.value, "7")
  assert.equal(kpis[2]?.value, "4")
  assert.equal(kpis[3]?.value, "2")

  // Phase 3 — Home mounts the unified hero and remembered collapsible sections.
  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /<GrowthHomeAvaHeroSection/)
  assert.match(dashboard, /<GrowthHomeCollapsibleSection/)
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaHeroSection") < dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection") < dashboard.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const collapsible = readSource(
    "components/growth/workspace/executive-briefing/growth-home-collapsible-section.tsx",
  )
  assert.match(collapsible, /localStorage/)
  assert.match(collapsible, /GROWTH_HOME_SECTION_COLLAPSE_KEY/)

  // Phase 7 — Home still uses one workspace-summary request (no new data loading).
  const body = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(body, /useGrowthWorkspaceDashboard/)
  const fetchMatches = body.match(/fetch\(/g) ?? []
  assert.equal(fetchMatches.length, 0, "Home dashboard body must not add new fetch calls")

  console.log(`[${PHASE}] PASS — Unified Ava Home experience certified (local)`)
}

main()
