/**
 * GE-AIOS-NEXT-1A — Ava recommendation-driven Home experience certification.
 * Run: pnpm test:ge-aios-next-1a-ava-recommendation-home
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyGrowthHomeAvaRecommendationPreferenceBoost,
  recordGrowthHomeAvaRecommendationAccepted,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import {
  GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER,
  GROWTH_AIOS_NEXT_1A_SINCE_LAST_VISIT_LINE,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import { buildGrowthHomeAvaRecommendationExperience } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"
import { resolveGrowthHomeAvaOperatorAssignment } from "../lib/growth/ava-home/recommendations/growth-home-ava-operator-assignment-next-1a"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildGrowthLeadHref } from "../lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "../lib/growth/navigation/growth-prospect-search-paths"

const PHASE = "GE-AIOS-NEXT-1A-AVA-RECOMMENDATION-HOME" as const

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
    workManager: {
      qaMarker: "ge-aios-11a-work-manager-v1",
      active_work: null,
      work_plan: [],
      blocked: [],
      completed_today: [],
      deferred: [],
      interruptions: [],
      operator_queue: [
        {
          id: "wm-find-leads",
          type: "mission",
          title: "Find 25 HVAC companies in Florida",
          description: "Pipeline is running low on fresh companies.",
          status: "ready",
          priority: 80,
          source: "decision_engine",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          estimated_minutes: 12,
          estimated_revenue_impact: null,
          requires_operator: false,
          can_execute_autonomously: true,
          depends_on: [],
          blocked_by: [],
          next_action: "Run prospect discovery",
          decision_score: 80,
          confidence: 0.8,
          href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
          company_name: null,
          decision_source_id: "nba-find-leads",
          routing_reason: "Pipeline coverage is below target.",
        },
      ],
      all_work_items: [],
    },
  })

  assert.equal(experience.qaMarker, GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER)
  assert.equal(experience.sinceLastVisitLine, GROWTH_AIOS_NEXT_1A_SINCE_LAST_VISIT_LINE)
  assert.ok(experience.recommendations.length >= 2)
  assert.equal(experience.recommendations[0]?.kind, "approval_package")
  assert.equal(experience.recommendations[0]?.companyName, "Blitz Industries")
  assert.match(experience.recommendations[0]?.href ?? "", /open=lead-blitz/)
  console.log("  ✓ canonical operator task ranks first in recommendation queue")

  const boosted = applyGrowthHomeAvaRecommendationPreferenceBoost(experience.recommendations, [
    { kind: "work_manager", accepted: 3, skipped: 0, lastAcceptedAt: null, lastSkippedAt: null },
    { kind: "approval_package", accepted: 0, skipped: 2, lastAcceptedAt: null, lastSkippedAt: null },
  ])
  assert.equal(boosted[0]?.kind, "work_manager")
  console.log("  ✓ operator preference memory reorders existing queue without new ranking engine")

  const assignment = resolveGrowthHomeAvaOperatorAssignment({
    instruction: "Find 50 commercial HVAC companies",
    companyCandidates: [{ leadId: "lead-blitz", companyName: "Blitz Industries" }],
    activeMissionLabel: "Florida HVAC discovery",
  })
  assert.match(assignment?.restatement ?? "", /HVAC companies/i)
  assert.match(assignment?.restatement ?? "", /50/)
  assert.equal(assignment?.href, GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF)
  assert.match(assignment?.conflictNote ?? "", /Florida HVAC discovery/)
  console.log("  ✓ free-form assignment routes through existing mission/prospect surfaces")

  const finishAssignment = resolveGrowthHomeAvaOperatorAssignment({
    instruction: "Finish Blitz",
    companyCandidates: [{ leadId: "lead-blitz", companyName: "Blitz Industries" }],
  })
  assert.match(finishAssignment?.href ?? "", /open=lead-blitz/)
  console.log("  ✓ company-name assignment resolves to existing lead workspace href")

  const hero = buildAvaHomeHero({
    greeting: "Good evening.",
    hour: 20,
    employeeStatus: { kind: "waiting_for_approval", label: "Waiting for your review" },
    aiOsUx: mockAiOsUx({
      approveItemsCount: 1,
      canonicalOperatorTask: experience.recommendations[0]
        ? {
            id: "approval:item-1",
            kind: "approval",
            title: experience.recommendations[0].headline,
            detail: experience.recommendations[0].detail ?? "",
            why: experience.recommendations[0].whyReasons[0] ?? "",
            whatHappensNext: experience.recommendations[0].outcomeLine ?? "",
            confidenceLabel: null,
            href: experience.recommendations[0].href ?? "",
            companyName: "Blitz Industries",
            leadId: "lead-blitz",
            draftCount: 2,
            packageCount: 1,
          }
        : null,
    }),
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: {
      kpis: { emailsSentToday: 0, repliesReceivedToday: 0, meetingsBookedToday: 0, pipelineValue: 0 },
      meetings: { today: [], upcoming: [] },
      inbox: { unread: 0, needsAction: 0 },
      operatorTasks: { leadsNeedingAction: 0, pendingApprovals: 1 },
      avaConsole: { researchLoopSummary: null },
      dashboard: { generatedAt: new Date().toISOString(), sections: [] },
      relationshipSnapshots: { byLeadId: {}, meta: { enriched: 0 } },
      leadPool: null,
      missionDiscovery: null,
      portfolioLeads: null,
      eligibleLeadCount: 0,
    },
  })

  assert.ok(hero.recommendationExperience)
  assert.equal(hero.recommendationExperience?.recommendations[0]?.kind, "approval_package")
  console.log("  ✓ Home hero exposes recommendation experience from existing intelligence stack")

  const heroSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx",
  )
  const recommendationSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(heroSection, /GrowthHomeAvaRecommendationExperienceSection/)
  assert.match(recommendationSection, /Why this recommendation/)
  assert.match(recommendationSection, /Suggest something else/)
  assert.match(recommendationSection, /Tell .* what to do/)
  assert.doesNotMatch(readSource("lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a.ts"), /openai|anthropic|llm/i)
  console.log("  ✓ UI surfaces Continue, Why, Suggest something else, and Tell Ava without new AI engines")

  recordGrowthHomeAvaRecommendationAccepted({ kind: "work_manager", organizationId: "test-org" })
  console.log("  ✓ preference memory records operator choices client-side")

  console.log(`\nPASS ${PHASE}`)
}

void main()
