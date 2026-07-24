/**
 * AVA-GROWTH-HOTFIX-2B-1E — Null executive briefing + ai-teammate degraded recovery.
 * Run: pnpm test:ava-growth-hotfix-2b-1e-null-briefing-ai-teammate
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildAvaNarrativeContext } from "../lib/growth/ava-home/narrative/context/build-ava-narrative-context"
import { AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER, mergeGrowthHomeWorkspaceSummaryWithCriticalState } from "../lib/growth/home/growth-home-critical-executive-state-2b-1c"
import {
  AVA_GROWTH_HOTFIX_2B_1E_QA_MARKER,
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "../lib/growth/home/growth-home-runtime-safe-defaults"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import { synthesizeGrowthHomeExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${AVA_GROWTH_HOTFIX_2B_1E_QA_MARKER}] Null briefing + ai-teammate certification`)

const runtimeDefaults = readSource("lib/growth/home/growth-home-runtime-safe-defaults.ts")
assert.match(runtimeDefaults, /buildGrowthWorkspaceDashboardViewModel\(sources\)/)
assert.match(runtimeDefaults, /EMPTY_GROWTH_HOME_WORKSPACE_SOURCES/)

const narrativeContext = readSource("lib/growth/ava-home/narrative/context/build-ava-narrative-context.ts")
assert.match(narrativeContext, /workspaceSummary\.dashboard\?\.briefing/)

const aiTeammateRoute = readSource("app/api/growth/workspace/settings/ai-teammate/route.ts")
assert.match(aiTeammateRoute, /loadAiTeammateIdentityGracefully/)
assert.match(aiTeammateRoute, /degraded:\s*true/)
assert.match(aiTeammateRoute, /status:\s*200/)

const aiTeammateService = readSource("lib/growth/settings/growth-ai-teammate-identity-service.ts")
assert.match(aiTeammateService, /loadAiTeammateIdentityGracefully/)

const mergedCritical = mergeGrowthHomeWorkspaceSummaryWithCriticalState({
  existing: null,
  critical: {
    ok: true,
    qaMarker: AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
    generatedAt: new Date().toISOString(),
    requestGeneration: 1,
    retryAttempt: 1,
    criticalLoad: {
      availability: "confirmed",
      pendingApprovalCount: 2,
      packages: [],
    },
    canonicalOperatorApproval: {
      qaMarker: "ge-aios-operator-experience-1a-v1",
      outreachPackageCount: 2,
      outreachDraftCount: 2,
      pendingApprovalCount: 2,
      waitingForOperator: true,
      packages: [],
      topPackage: null,
    },
    canonicalOperatorTask: null,
    canonicalActiveMissions: null,
    canonicalOrganizationTraining: null,
    avaActivation: null,
    executiveLoad: {
      qaMarker: "ava-growth-hotfix-2b-1a-home-runtime-v1",
      criticalStageMs: 50,
      secondaryStageMs: null,
      approvals: "confirmed",
      training: "unavailable",
      activation: "unavailable",
      missions: "confirmed_empty",
      recommendation: "confirmed_empty",
    },
    stageTimingsMs: { critical_executive_state_wall: 50 },
  },
})

const normalized = normalizeGrowthHomeWorkspaceSummaryPayload(mergedCritical)
assert.ok(normalized.dashboard, "critical-only payload must resolve a dashboard view model")
assert.equal(normalized.dashboard?.briefing ?? null, null)

assert.doesNotThrow(() =>
  buildAvaNarrativeContext({
    workspaceSummary: {
      kpis: normalized.kpis,
      meetings: normalized.meetings,
      inbox: normalized.inbox,
      operatorTasks: normalized.operatorTasks,
      avaConsole: normalized.avaConsole,
      dashboard: normalized.dashboard,
      leadPool: normalized.leadPool,
    },
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
    pendingApprovalCount: 2,
  }),
)

const dashboard = buildGrowthWorkspaceDashboardViewModel(normalized.sources)
assert.doesNotThrow(() =>
  synthesizeGrowthHomeExecutiveBriefing({
    dashboard,
    executiveLoad: normalized.executiveLoad ?? null,
    canonicalOperatorApproval: normalized.canonicalOperatorApproval,
  }),
)

console.log(`[${AVA_GROWTH_HOTFIX_2B_1E_QA_MARKER}] PASS`)
