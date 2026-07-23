/**
 * GE-AIOS-19C-2E — Training workspace certification.
 * Run: pnpm test:ge-aios-19c-training-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthTrainingOverviewReadModel } from "../lib/growth/training/build-growth-training-overview-read-model"
import { evaluateBusinessStrategyCompleteness } from "../lib/growth/training/evaluate-business-strategy-completeness"
import { createEmptyBusinessStrategyContent } from "../lib/growth/training/growth-business-strategy-types"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_LEARNED_ROUTE,
  GROWTH_TRAINING_RUNBOOK_ROUTE,
  GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER,
  GROWTH_TRAINING_WORKSPACE_ROUTE,
} from "../lib/growth/training/growth-training-workspace-types"
import { GROWTH_TRAINING_NAV_ITEMS } from "../lib/growth/training/growth-training-workspace-navigation"
import {
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"

const PHASE = "GE-AIOS-19C-2E" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Training workspace certification`)

  assert.equal(GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER, "ge-aios-19c-training-workspace-v1")
  assert.equal(GROWTH_TRAINING_WORKSPACE_ROUTE, "/growth/training")
  assert.equal(GROWTH_TRAINING_COMPANY_PROFILE_ROUTE, "/growth/training/company-profile")
  assert.equal(GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE, "/growth/training/business-strategy")
  assert.equal(GROWTH_TRAINING_RUNBOOK_ROUTE, "/growth/training/runbook")
  assert.equal(GROWTH_TRAINING_LEARNED_ROUTE, "/growth/training/learned")
  console.log("  ✓ 19C QA marker and routes")

  const workspaceItems = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.find((group) => group.id === "workspace")?.items ?? []
  assert.ok(workspaceItems.some((item) => item.id === "training"))
  assert.ok(workspaceItems.some((item) => item.id === "operations"))
  assert.ok(!workspaceItems.some((item) => item.id === "runbook"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("training"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("operations"))
  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v11")
  console.log("  ✓ sidebar manifest includes Training and Operations")

  assert.ok(GROWTH_TRAINING_NAV_ITEMS.some((item) => item.id === "overview"))
  assert.ok(GROWTH_TRAINING_NAV_ITEMS.some((item) => item.id === "company-profile"))
  assert.ok(GROWTH_TRAINING_NAV_ITEMS.some((item) => item.id === "business-strategy"))
  assert.ok(GROWTH_TRAINING_NAV_ITEMS.some((item) => item.id === "runbook"))
  assert.ok(GROWTH_TRAINING_NAV_ITEMS.some((item) => item.id === "learned"))
  assert.ok(GROWTH_TRAINING_NAV_ITEMS.filter((item) => item.future).length >= 3)
  console.log("  ✓ training section navigation")

  const routeCatalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(routeCatalog, /workspace-training/)
  console.log("  ✓ route catalog includes training")

  const trainingPage = readSource("app/(growth)/growth/training/page.tsx")
  assert.doesNotMatch(trainingPage, /fetch\(/)
  assert.match(trainingPage, /GrowthTrainingOverviewSection/)
  console.log("  ✓ training overview page uses shared components")

  const companyProfileSection = readSource(
    "components/growth/training/growth-training-company-profile-section.tsx",
  )
  assert.match(companyProfileSection, /GrowthHomeBusinessProfileSection/)
  console.log("  ✓ company profile reuses existing editor")

  const runbookSection = readSource("components/growth/training/growth-training-runbook-section.tsx")
  assert.match(runbookSection, /GrowthLaunchRunbookPanel/)
  console.log("  ✓ runbook reuses existing panel")

  const learnedSection = readSource("components/growth/training/growth-training-learned-section.tsx")
  assert.match(learnedSection, /organizationalKnowledge/)
  assert.doesNotMatch(learnedSection, /fetch\(/)
  console.log("  ✓ learned section is read-only organizational knowledge")

  const profileTypes = readSource("lib/growth/business-profile/business-profile-types.ts")
  assert.match(profileTypes, /businessStrategy\?: BusinessStrategyContent/)
  console.log("  ✓ business strategy extends profile_json (no duplicate storage)")

  const evidenceProvider = readSource(
    "lib/growth/evidence-engine/providers/approved-profile-evidence-provider.ts",
  )
  assert.match(evidenceProvider, /business_strategy\./)
  console.log("  ✓ approved profile evidence includes business strategy facts")

  const hero = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(hero, /GROWTH_TRAINING_WORKSPACE_ROUTE/)
  console.log("  ✓ home hero links into Training")

  const operations = readSource("components/growth/operations-center/growth-sales-operations-center-dashboard.tsx")
  assert.match(operations, /GROWTH_TRAINING_WORKSPACE_ROUTE/)
  console.log("  ✓ operations links into Training")

  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved: null,
    latestDraft: null,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  assert.match(overview.headline, /still learning/i)
  assert.ok(overview.areas.length === 4)
  assert.ok(!overview.headline.includes("%"))
  console.log("  ✓ overview read model avoids fabricated percentages")

  const completeness = evaluateBusinessStrategyCompleteness({
    ...createEmptyBusinessStrategyContent(),
    messaging: { ...createEmptyBusinessStrategyContent().messaging, tone: "Educational" },
  })
  assert.equal(completeness.hasContent, true)
  assert.ok(completeness.wellUnderstoodAreas.includes("messaging & tone"))
  console.log("  ✓ business strategy completeness evaluator")

  console.log(`[${PHASE}] PASS — Training workspace certified (local)`)
}

main()
