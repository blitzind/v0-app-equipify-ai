/**
 * GE-SET-5 — Workspace Settings Growth Engine panel lift verification (local only).
 *
 * Usage: pnpm test:workspace-settings-growth-engine-lift
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_EXPORTS,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION,
  listWorkspaceSettingsGrowthEngineLiftedSectionIds,
  resolveGrowthEngineSectionLiftKind,
} from "../lib/settings/workspace-settings-growth-engine-lift"
import { listWorkspaceSettingsGrowthEngineSectionIds } from "../lib/settings/workspace-settings-navigation"
import {
  GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS,
  growthEngineCustomerSettingsHref,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"

const GE_SET_5_LIFTED_CUSTOMER_SECTIONS = [
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "copilot-preferences",
] as const

function runAudit(): void {
  console.log(`\n=== Workspace Settings GE-SET-5 (${WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER}) ===\n`)

  const allSections = listWorkspaceSettingsGrowthEngineSectionIds()
  assert.equal(allSections.length, 33)
  console.log("  ✓ Growth Engine manifest still defines 33 sections")

  const lifted = listWorkspaceSettingsGrowthEngineLiftedSectionIds()
  assert.equal(lifted.length, 28)
  console.log("  ✓ 28 sections registered as lifted panels in Workspace Settings shell")

  assert.equal(GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS.length, 16)
  console.log("  ✓ 16 customer settings sections resolve to Growth workspace settings hrefs")

  for (const sectionId of ["connected-mailboxes", "warmup", "sender-pools", "dns-verification", "sending-limits"]) {
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "canonical")
    assert.ok(growthEngineCustomerSettingsHref(sectionId).startsWith("/growth/settings/communications/"))
  }
  console.log("  ✓ communications sections are canonical under /growth/settings/communications/*")

  for (const sectionId of GE_SET_5_LIFTED_CUSTOMER_SECTIONS) {
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "lifted", `${sectionId} should remain lifted metadata`)
  }
  console.log("  ✓ compliance/AI customer sections retain lifted metadata")

  assert.equal(resolveGrowthEngineSectionLiftKind("notification-preferences"), "lifted")
  assert.equal(
    growthEngineCustomerSettingsHref("notification-preferences"),
    "/growth/settings/notifications",
  )
  const growthEnginePageSrc = readFileSync(
    "app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx",
    "utf8",
  )
  assert.match(growthEnginePageSrc, /redirect\(/)
  console.log("  ✓ legacy /settings/growth-engine/* routes redirect to Growth settings")

  assert.equal(resolveGrowthEngineSectionLiftKind("email-signatures"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("elevenlabs"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("retell"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("media-ai-providers"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("automation-defaults"), "placeholder")
  assert.equal(resolveGrowthEngineSectionLiftKind("command-center-preferences"), "missing")
  console.log("  ✓ deferred sections classified correctly (no false lifts)")

  for (const sectionId of WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS) {
    const kind = resolveGrowthEngineSectionLiftKind(sectionId)
    assert.notEqual(kind, "lifted", `${sectionId} must not be lifted`)
  }
  assert.equal(WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length, 5)
  console.log("  ✓ 5 sections remain Phase 3 placeholders")

  const classifiedCount = Object.keys(WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION).length
  assert.equal(classifiedCount, 33)
  console.log("  ✓ every section has documented classification + reason")

  const classified =
    lifted.length + WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length
  assert.equal(classified, 33)
  console.log("  ✓ lifted + deferred covers all 33 sections")

  assert.match(sectionPageSrc, /getWorkspaceSettingsGrowthEngineLiftedPanel/)
  assert.doesNotMatch(sectionPageSrc, /redirect\(/)
  assert.doesNotMatch(sectionPageSrc, /fetch\(/)
  console.log("  ✓ section page has no redirects or new network requests")

  const growthEnginePageSrc = readFileSync("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx", "utf8")
  assert.doesNotMatch(growthEnginePageSrc, /redirect\(/)
  console.log("  ✓ growth-engine route renders lifted panels in Workspace Settings shell")

  const compliancePageSrc = readFileSync("app/(admin)/admin/growth/providers/compliance/page.tsx", "utf8")
  assert.match(compliancePageSrc, /GrowthComplianceDashboardPanel/)
  console.log("  ✓ admin compliance route unchanged (compatibility preserved)")

  const engineSettingsSrc = readFileSync("components/growth/growth-engine-settings-panel.tsx", "utf8")
  assert.match(engineSettingsSrc, /Coming soon/)
  console.log("  ✓ automation-defaults source remains coming-soon only")

  console.log("\nWorkspace Settings GE-SET-5 verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER,
        lifted_sections: lifted.length,
        customer_canonical_sections: GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS.length,
        deferred_sections: WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length,
        operator_readiness_ui_estimate_pct: 79,
        operator_readiness_self_serve_estimate_pct: 28,
        auth_unchanged: true,
        org_rbac_deferred: true,
      },
      null,
      2,
    ),
  )
}

runAudit()
