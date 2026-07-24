/**
 * AVA-GROWTH-OPERATOR-2A — Executive Home experience simplification certification.
 * Run: pnpm test:ava-growth-operator-2a-executive-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER,
  buildExecutivePortfolioHealthPresentation,
  GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_DETAILS_TITLE,
  humanizeExecutivePresentationCopy,
  shortenExecutiveParagraph,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-experience-2a"
import {
  applyHomeNarrativeDedup,
  buildHeroExecutiveBriefing,
  detectHomeSectionNarrativeOverlap,
  GROWTH_HOME_OPERATOR_EXPERIENCE_2A_QA_MARKER,
  GROWTH_HOME_SECTION_OBJECTIVE_TITLE,
  GROWTH_HOME_SECTION_PORTFOLIO_TITLE,
  GROWTH_HOME_SECTION_RECOMMENDATION_TITLE,
} from "../lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { polishExecutiveLanguage } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runCertification(): void {
  console.log(`[${AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER}] Executive experience certification`)

  assert.equal(GROWTH_HOME_OPERATOR_EXPERIENCE_2A_QA_MARKER, AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER)
  assert.equal(GROWTH_HOME_SECTION_RECOMMENDATION_TITLE, "Current Recommendation")
  assert.equal(GROWTH_HOME_SECTION_OBJECTIVE_TITLE, "Current Objective")
  assert.equal(GROWTH_HOME_SECTION_PORTFOLIO_TITLE, "Portfolio Health")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /executive-show-details/)
  assert.match(dashboard, /GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_DETAILS_TITLE/)
  assert.match(dashboard, /GrowthHomeExecutivePortfolioHealthSection/)
  assert.match(dashboard, /executiveMode/)
  assert.match(dashboard, /executiveExperienceMode:\s*true/)

  const recommendationSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(recommendationSection, /GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_REASONING_TOGGLE/)

  const briefing = buildHeroExecutiveBriefing({
    statusLabel: "Idle",
    pendingApprovals: 3,
    readyForOutreachReview: 0,
    executiveExperienceMode: true,
  })
  assert.equal(briefing.paragraphs.length, 2)
  assert.ok(!briefing.paragraphs.some((paragraph) => /don't currently need anything/i.test(paragraph)))

  const pendingBriefing = buildHeroExecutiveBriefing({
    statusLabel: "Waiting for approval",
    pendingApprovals: 3,
    executiveExperienceMode: true,
  })
  assert.ok(pendingBriefing.paragraphs.some((paragraph) => /review|prepared|packages/i.test(paragraph)))

  const overlap = detectHomeSectionNarrativeOverlap({
    heroNarrative: "I need your review on 3 outreach packages before I continue.",
    workingNowTask: null,
    objectiveTitle: null,
    recommendationHeadline: null,
    progressLabels: ["Waiting for approval"],
    waitingOnYouSummaries: ["Review 3 outreach packages"],
  })
  assert.ok(overlap.includes("hero_waiting_on_you"))

  const deduped = applyHomeNarrativeDedup({
    overlaps: overlap,
    heroBriefing: pendingBriefing,
    workingNow: {
      qaMarker: "ge-aios-live-3b-home-operator-experience-v1",
      activeTask: null,
      currentPhase: null,
      nextStep: null,
      blockers: [],
    },
    recommendationHeadline: null,
  })
  assert.equal(deduped.suppressRuntimeTrustWhatHappensNext, true)

  const executiveCopy = humanizeExecutivePresentationCopy(
    polishExecutiveLanguage(
      "Autonomous preparation capacity currently exceeds review capacity (3 packages awaiting decision).",
    ),
  )
  assert.match(executiveCopy, /prepared 3 qualified opportunities/i)

  const shortened = shortenExecutiveParagraph(
    "First sentence here. Second sentence here. Third sentence should be removed.",
    2,
  )
  assert.equal(shortened.split(".").filter(Boolean).length, 2)

  const portfolio = buildExecutivePortfolioHealthPresentation({
    portfolio: {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      targetActiveCompanies: 25,
      currentActiveCompanies: 8,
      minimumHealthyCompanies: 15,
      needsCount: 17,
      healthState: "needs_replenishment",
      healthLabel: "Portfolio needs more qualified companies.",
      discoveryRunning: true,
      discoveryRunningCount: 1,
      discoveryStatusDisplay: "Next batch: 25",
      nextBatchSize: 25,
      showEstimatedHealthy: false,
      researchRunning: false,
      researchRunningCount: 0,
      admissionsPending: 0,
    },
  })
  assert.ok(portfolio)
  assert.equal(portfolio?.qaMarker, AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER)
  assert.equal(GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_DETAILS_TITLE, "Show details")

  execSync("pnpm test:ge-aios-home-operator-experience-2a", { cwd: ROOT, stdio: "inherit" })

  console.log(`[${AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER}] PASS`)
}

runCertification()
