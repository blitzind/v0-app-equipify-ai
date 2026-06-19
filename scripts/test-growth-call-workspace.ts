/**
 * CALL-RECOVERY-3 — Calls operating view resolver + href regression audit.
 *
 * Usage: pnpm test:growth-call-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_CALLS_PRIMARY_HREF,
  growthCallsOperatingHref,
} from "../lib/growth/navigation/growth-workspace-consolidation"
import { resolveGrowthCallsOperatingViewWithSavedDefault } from "../lib/growth/settings/growth-workspace-settings-consumption"

export const GROWTH_CALL_WORKSPACE_QA_MARKER = "growth-call-workspace-recovery-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth call workspace recovery audit (${GROWTH_CALL_WORKSPACE_QA_MARKER}) ===\n`)

  const adminBase = `${GROWTH_ADMIN_BASE_PATH}/calls/workspace`
  const growthBase = `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`

  assert.equal(growthCallsOperatingHref("operate"), `${GROWTH_CALLS_PRIMARY_HREF}?view=operate`)
  assert.equal(growthCallsOperatingHref("operate", adminBase), `${adminBase}?view=operate`)
  assert.equal(growthCallsOperatingHref("operate", growthBase), `${growthBase}?view=operate`)
  assert.match(growthCallsOperatingHref("operate"), /\?view=operate$/)
  console.log("  ✓ Operate href includes ?view=operate")

  assert.equal(growthCallsOperatingHref("overview"), `${GROWTH_CALLS_PRIMARY_HREF}?view=overview`)
  assert.equal(growthCallsOperatingHref("overview", growthBase), `${growthBase}?view=overview`)
  assert.match(growthCallsOperatingHref("overview"), /\?view=overview$/)
  console.log("  ✓ Overview href includes ?view=overview")

  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: adminBase,
      viewParam: "operate",
      savedCallsDefaultView: "overview",
    }),
    "operate",
  )
  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: adminBase,
      viewParam: "overview",
      savedCallsDefaultView: "workspace",
    }),
    "overview",
  )
  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: adminBase,
      viewParam: null,
      savedCallsDefaultView: "overview",
    }),
    "overview",
  )
  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: growthBase,
      viewParam: null,
      savedCallsDefaultView: "workspace",
    }),
    "operate",
  )
  console.log("  ✓ explicit ?view= wins over saved calls default")

  const operatingTabs = readSource("components/growth/growth-calls-operating-tabs.tsx")
  const operatingShell = readSource("components/growth/growth-calls-operating-shell.tsx")

  assert.match(operatingTabs, /resolveGrowthCallsOperatingViewWithSavedDefault/)
  assert.match(operatingTabs, /useGrowthWorkspaceDefaultViewsReadonly/)
  assert.doesNotMatch(operatingTabs, /resolveGrowthCallsOperatingView\(/)

  assert.match(operatingShell, /resolveGrowthCallsOperatingViewWithSavedDefault/)
  assert.match(operatingShell, /useGrowthWorkspaceDefaultViewsReadonly/)
  assert.match(operatingShell, /view === "overview"/)
  assert.match(operatingShell, /GrowthCallWorkspace hidePageHeader/)
  assert.match(operatingShell, /GrowthCallCopilotDashboard embedded/)
  console.log("  ✓ tabs and shell share saved-default resolver; dialer vs dashboard split intact")

  const consolidation = readSource("lib/growth/navigation/growth-workspace-consolidation.ts")
  assert.match(consolidation, /if \(view === "operate"\) return `\$\{base\}\?view=operate`/)
  console.log("  ✓ growthCallsOperatingHref emits explicit operate query")

  console.log("\nGrowth call workspace recovery audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_CALL_WORKSPACE_QA_MARKER,
        admin_operate_href: growthCallsOperatingHref("operate"),
        growth_operate_href: growthCallsOperatingHref("operate", growthBase),
      },
      null,
      2,
    ),
  )
}

runAudit()
