/**
 * GE-AIOS-19C-2F — About Your AI certification.
 * Run: pnpm test:ge-aios-19c-2f-about-your-ai
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthAvaAboutReadModel } from "../lib/growth/ava-about/build-growth-ava-about-read-model"
import {
  GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER,
  GROWTH_AVA_ABOUT_WORKSPACE_ROUTE,
} from "../lib/growth/ava-about/growth-ava-about-workspace-types"
import {
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import { resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"
import { buildTeammateAboutIntroduction } from "../lib/workspace/ai-teammate-voice"

const PHASE = "GE-AIOS-19C-2F" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] About Your AI certification`)

  assert.equal(GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER, "ge-aios-19c-2f-about-your-ai-v1")
  assert.equal(GROWTH_AVA_ABOUT_WORKSPACE_ROUTE, "/growth/ava")
  console.log("  ✓ 19C-2F QA marker and route")

  const workspaceItems = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.find((group) => group.id === "workspace")?.items ?? []
  const trainingIndex = workspaceItems.findIndex((item) => item.id === "training")
  const aboutIndex = workspaceItems.findIndex((item) => item.id === "about-ai")
  assert.ok(trainingIndex >= 0)
  assert.ok(aboutIndex >= 0)
  assert.ok(aboutIndex === trainingIndex + 1, "About Your AI should follow Training in sidebar")
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("about-ai"))
  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v11")
  console.log("  ✓ sidebar manifest includes About Your AI after Training")

  const routeCatalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(routeCatalog, /workspace-ava-about/)
  console.log("  ✓ route catalog includes About Your AI")

  const aboutPage = readSource("app/(growth)/growth/ava/page.tsx")
  assert.match(aboutPage, /GrowthAvaAboutDashboard/)
  assert.match(aboutPage, /useGrowthAvaAboutData/)
  assert.doesNotMatch(aboutPage, /fetch\(/)
  console.log("  ✓ about page uses shared hook (no inline fetch)")

  const dashboard = readSource("components/growth/ava-about/growth-ava-about-dashboard.tsx")
  assert.match(dashboard, /Meet Your AI/)
  assert.match(dashboard, /What I Can Do/)
  assert.match(dashboard, /My Tools/)
  assert.match(dashboard, /My Permissions/)
  assert.match(dashboard, /My Current Status/)
  assert.match(dashboard, /What I'm Learning/)
  assert.match(dashboard, /Activity/)
  assert.match(dashboard, /Autonomy/)
  assert.doesNotMatch(dashboard, /\bAva\b/)
  console.log("  ✓ dashboard renders all 8 identity sections without hardcoded Ava")

  const readModelBuilder = readSource("lib/growth/ava-about/build-growth-ava-about-read-model.ts")
  assert.match(readModelBuilder, /GROWTH_AUTONOMY_CAPABILITY_OPERATOR/)
  assert.match(readModelBuilder, /buildGrowthTrainingOverviewReadModel/)
  assert.match(readModelBuilder, /buildHomeWorkItemPresentation/)
  assert.doesNotMatch(readModelBuilder, /\/api\/platform\/growth\/ava-about/)
  console.log("  ✓ read model reuses autonomy, training overview, and work manager (no new API)")

  const dataHook = readSource("components/growth/ava-about/use-growth-ava-about-data.ts")
  assert.match(dataHook, /GROWTH_HOME_STARTUP_API_PATHS\.autonomy/)
  assert.match(dataHook, /GROWTH_HOME_STARTUP_API_PATHS\.operatorSetupHealth/)
  assert.match(dataHook, /synthesizeGrowthHomeExecutiveBriefing/)
  assert.match(dataHook, /buildAvaHomeHero/)
  console.log("  ✓ data hook reuses existing startup APIs and briefing chain")

  const renamed = resolveAiTeammatePresentation("Jordan")
  const intro = buildTeammateAboutIntroduction(renamed)
  assert.match(intro, /Hi, I'm Jordan\./)
  assert.doesNotMatch(intro, /\bAva\b/)
  console.log("  ✓ introduction uses dynamic teammate name")

  const model = buildGrowthAvaAboutReadModel({
    teammate: renamed,
    employeeStatus: {
      kind: "working",
      label: "Working",
      activityLabel: "researching companies",
    },
    dailyBriefing: null,
    workspaceSummary: null,
    autonomy: null,
    setupHealth: null,
    activeApproved: null,
    latestDraft: null,
    launchSetup: null,
    organizationalKnowledge: null,
  })
  assert.match(model.meetIntro, /Jordan/)
  assert.equal(model.degraded, true)
  assert.ok(model.capabilities.length > 0)
  console.log("  ✓ read model degrades gracefully when runtime incomplete")

  const trainingShell = readSource("components/growth/training/growth-training-shell.tsx")
  assert.match(trainingShell, /GROWTH_AVA_ABOUT_WORKSPACE_ROUTE/)
  console.log("  ✓ training shell links to About Your AI")

  const operations = readSource("components/growth/operations-center/growth-sales-operations-center-dashboard.tsx")
  assert.match(operations, /GROWTH_AVA_ABOUT_WORKSPACE_ROUTE/)
  assert.match(operations, /buildTeammateHandlingRows/)
  console.log("  ✓ operations links to About Your AI and uses single-AI handling rows")

  const aboutDashboardLinks = readSource("components/growth/ava-about/growth-ava-about-dashboard.tsx")
  assert.match(aboutDashboardLinks, /model\.trainingHref/)
  assert.match(aboutDashboardLinks, /model\.operationsHref/)
  assert.match(aboutDashboardLinks, /model\.autonomy\.settingsHref/)
  console.log("  ✓ About page cross-links Training, Operations, and Settings")

  console.log(`[${PHASE}] PASS — About Your AI certified (local)`)
}

main()
