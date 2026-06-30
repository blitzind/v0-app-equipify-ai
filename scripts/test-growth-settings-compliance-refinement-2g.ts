/**
 * GROWTH-SETTINGS-COMPLIANCE-REFINEMENT-2G — Compliance section UX polish certification.
 *
 * Run: pnpm test:growth-settings-compliance-refinement-2g
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export { GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER }

const ROOT = process.cwd()

const COMPLIANCE_NAV_IDS = ["compliance"] as const

const OPERATOR_COMPLIANCE_FILES = [
  "components/growth/settings/growth-settings-compliance-page.tsx",
  "components/growth/settings/growth-compliance-readiness-summary.tsx",
  "components/growth/growth-compliance-dashboard.tsx",
] as const

const FORBIDDEN_OPERATOR_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Not available yet/i,
  /policy engine/i,
  /compliance runtime/i,
  /audit pipeline/i,
  /regulation engine/i,
  /\bdiagnostics\b/i,
  /\borchestrator\b/i,
  /\bpipeline\b/i,
  /\bruntime\b/i,
  /GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER/,
  /Human authority required/i,
  /Growth Engine/i,
  /Hashed recipient identity only/i,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{[A-Z0-9_]+QA_[A-Z0-9_]+\}/

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function complianceNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "compliance")!
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-COMPLIANCE-REFINEMENT-2G (${GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER, "growth-settings-compliance-refinement-2g-v1")
  console.log("  ✓ Compliance refinement QA marker")

  const complianceGroup = complianceNavGroup()
  assert.deepEqual(
    complianceGroup.items.map((item) => item.id),
    [...COMPLIANCE_NAV_IDS],
    "Compliance nav must remain unchanged",
  )
  console.log("  ✓ Compliance navigation unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  const pagePath = path.join(ROOT, "app/(growth)/growth/settings/compliance/page.tsx")
  assert.ok(fs.existsSync(pagePath), "Missing Compliance route: /growth/settings/compliance")
  const pageSrc = read("app/(growth)/growth/settings/compliance/page.tsx")
  assert.match(pageSrc, /GrowthSettingsCompliancePage/)
  assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  console.log("  ✓ Compliance route renders wired page shell")

  const compliancePage = read("components/growth/settings/growth-settings-compliance-page.tsx")
  assert.match(compliancePage, /GrowthComplianceReadinessSummary/)
  assert.match(compliancePage, /GrowthComplianceDashboardPanel variant="operator"/)
  assert.match(compliancePage, /Platform admin/)
  assert.match(
    compliancePage,
    /data-growth-settings-compliance-refinement=\{GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER\}/,
  )
  console.log("  ✓ Compliance page with readiness and operator dashboard")

  const readiness = read("components/growth/settings/growth-compliance-readiness-summary.tsx")
  assert.match(readiness, /Compliance readiness/)
  assert.match(readiness, /Consent tracking/)
  assert.match(readiness, /Email compliance/)
  assert.match(readiness, /\/api\/platform\/growth\/compliance\/dashboard/)
  console.log("  ✓ Compliance readiness summary at top")

  const dashboard = read("components/growth/growth-compliance-dashboard.tsx")
  assert.match(dashboard, /variant\?: "default" \| "operator"/)
  assert.match(dashboard, /Workspace compliance/)
  assert.match(dashboard, /Communication compliance/)
  assert.match(dashboard, /Data handling/)
  assert.match(dashboard, /Operator guidance/)
  assert.match(dashboard, /Automatically enforced/)
  assert.match(dashboard, /Your responsibility/)
  assert.match(dashboard, /Managed by Platform admin/)
  assert.match(dashboard, /\/api\/platform\/growth\/compliance\/dashboard/)
  assert.doesNotMatch(dashboard, /{GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER}/)
  console.log("  ✓ Compliance dashboard grouped with operator guidance")

  for (const file of OPERATOR_COMPLIANCE_FILES) {
    const src = read(file)
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
    if (file.includes("growth-compliance-dashboard") && src.includes("isOperator")) {
      for (const pattern of FORBIDDEN_OPERATOR_COPY) {
        if (pattern.source.includes("provider") && !pattern.source.includes("Platform")) continue
        assert.doesNotMatch(src, pattern, `${file} operator copy must stay operator-friendly (${pattern})`)
      }
    } else {
      for (const pattern of FORBIDDEN_OPERATOR_COPY) {
        assert.doesNotMatch(src, pattern, `${file} must not expose developer copy (${pattern})`)
      }
    }
  }
  console.log("  ✓ Operator Compliance surfaces use production copy")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token unchanged")

  console.log("\nGROWTH-SETTINGS-COMPLIANCE-REFINEMENT-2G verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
        compliance_nav_items: COMPLIANCE_NAV_IDS.length,
        panels_checked: OPERATOR_COMPLIANCE_FILES.length,
      },
      null,
      2,
    ),
  )
}

main()
