/**
 * AVA-GROWTH-HOME-RENDER-HOTFIX-1A — certification.
 * Run: pnpm test:ava-growth-home-render-hotfix-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeRuntimeTrustViewModel } from "../lib/growth/home/growth-home-runtime-trust-presenter-1b"

export const AVA_GROWTH_HOME_RENDER_HOTFIX_1A_QA_MARKER =
  "ava-growth-home-render-hotfix-1a-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(AVA_GROWTH_HOME_RENDER_HOTFIX_1A_QA_MARKER, "ava-growth-home-render-hotfix-1a-v1")

  const presenter = readSource("lib/growth/home/growth-home-runtime-trust-presenter-1b.ts")
  assert.match(
    presenter,
    /operatorApprovalCompanyName:\s*\n\s*input\.operatorApprovalCompanyName \?\?\s*\n\s*\(input\.canonicalOperatorFocus\?\.source === "approval"/,
  )
  assert.doesNotMatch(
    presenter,
    /operatorApprovalCompanyName:\s*\n\s*input\.operatorApprovalCompanyName \?\?\s*\n\s*input\.canonicalOperatorFocus\?\.source === "approval"\s*\n\s*\? input\.canonicalOperatorFocus\.companyName/,
  )

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /portfolioManager\?\.health\?\.needsCount/)
  assert.match(dashboard, /operatorTasks\?\.leadsNeedingAction/)
  assert.match(dashboard, /recommendations\?\.\[0\]/)

  const synthesizer = readSource(
    "lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts",
  )
  assert.match(synthesizer, /canonicalApprovalSnapshot\?\.packages\?\.length/)

  const canonical = readSource(
    "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a.ts",
  )
  assert.match(canonical, /approvalSnapshot\.packages \?\? \[\]/)

  const recommendation = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(recommendation, /experience\.recommendations \?\? \[\]/)

  const safeDefaults = readSource("lib/growth/home/growth-home-runtime-safe-defaults.ts")
  assert.match(safeDefaults, /packages: aiOsUx\.canonicalApprovalSnapshot\.packages \?\? \[\]/)

  // Regression: truthy operatorApprovalCompanyName must not dereference null canonicalOperatorFocus.
  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: null,
    salesOutcomes: null,
    activeWork: null,
    pendingApprovals: 2,
    setupIncomplete: false,
    operatorApprovalCompanyName: "Acme Equipment",
    canonicalOperatorFocus: null,
  })
  assert.equal(typeof runtimeTrust.primaryMissionLabel, "string")

  console.log("ava-growth-home-render-hotfix-1a: ok")
}

main()
