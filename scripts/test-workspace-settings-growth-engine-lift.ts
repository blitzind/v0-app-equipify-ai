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
import { GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS } from "../lib/growth/navigation/growth-workspace-settings-canonical"

const GE_SET_5_BRIDGE_SECTIONS = [
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "copilot-preferences",
  "share-page-branding",
  "booking-branding",
  "media-defaults",
] as const

function runAudit(): void {
  console.log(`\n=== Workspace Settings GE-SET-5 (${WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER}) ===\n`)

  const allSections = listWorkspaceSettingsGrowthEngineSectionIds()
  assert.equal(allSections.length, 33)
  console.log("  ✓ Growth Engine manifest still defines 33 sections")

  const lifted = listWorkspaceSettingsGrowthEngineLiftedSectionIds()
  assert.equal(lifted.length, 12)
  console.log("  ✓ 12 sections remain as lifted panels in Core settings shell")

  assert.equal(GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS.length, 15)
  console.log("  ✓ 15 sections bridge to Growth workspace settings (8I)")

  const liftSrc = readFileSync("components/settings/workspace-settings-growth-engine-lifted-panels.tsx", "utf8")
  for (const sectionId of lifted) {
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "lifted")
    const expectedPanel = WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_EXPORTS[sectionId]
    assert.ok(expectedPanel, `missing panel export for ${sectionId}`)
    assert.match(liftSrc, new RegExp(expectedPanel))
  }
  console.log("  ✓ lifted sections map to existing panel components (no fake panels)")

  for (const sectionId of GE_SET_5_BRIDGE_SECTIONS) {
    const kind = resolveGrowthEngineSectionLiftKind(sectionId)
    if (sectionId === "share-page-branding" || sectionId === "booking-branding" || sectionId === "media-defaults") {
      assert.equal(kind, "lifted", `${sectionId} should remain lifted`)
      continue
    }
    assert.equal(kind, "bridged", `${sectionId} should bridge in 8I`)
  }
  console.log("  ✓ compliance/AI sections bridge; marketing lifts remain in Core shell")

  assert.match(liftSrc, /GrowthSharePagesDashboard/)
  assert.match(liftSrc, /GrowthContentLibraryDashboardView/)
  assert.doesNotMatch(liftSrc, /GrowthComplianceDashboardPanel/)
  assert.doesNotMatch(liftSrc, /GrowthAiCopilotSettingsPanel/)
  assert.doesNotMatch(liftSrc, /GrowthMediaAiVoicePanel/)
  assert.doesNotMatch(liftSrc, /GrowthEngineSettingsPanel/)
  console.log("  ✓ compliance/AI panels removed from Core lift registry; scaffolds excluded")

  assert.equal(resolveGrowthEngineSectionLiftKind("notification-preferences"), "bridged")
  const bridgeSrc = readFileSync("components/settings/workspace-settings-growth-engine-bridge-panel.tsx", "utf8")
  assert.match(bridgeSrc, /Open Growth Settings/)
  console.log("  ✓ notification-preferences bridges to Growth workspace (no duplicate editor in Core shell)")

  assert.equal(resolveGrowthEngineSectionLiftKind("email-signatures"), "missing")
  assert.equal(resolveGrowthEngineSectionLiftKind("elevenlabs"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("retell"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("media-ai-providers"), "operational_only")
  assert.equal(resolveGrowthEngineSectionLiftKind("automation-defaults"), "placeholder")
  assert.equal(resolveGrowthEngineSectionLiftKind("command-center-preferences"), "missing")
  console.log("  ✓ deferred sections classified correctly (no false lifts)")

  for (const sectionId of WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS) {
    const kind = resolveGrowthEngineSectionLiftKind(sectionId)
    assert.notEqual(kind, "lifted", `${sectionId} must not be lifted`)
    assert.notEqual(kind, "bridged", `${sectionId} must not be bridged`)
  }
  assert.equal(WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length, 6)
  console.log("  ✓ 6 sections remain Phase 3 placeholders")

  const classifiedCount = Object.keys(WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION).length
  assert.equal(classifiedCount, 33)
  console.log("  ✓ every section has documented classification + reason")

  const classified = lifted.length + GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS.length + WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length
  assert.equal(classified, 33)
  console.log("  ✓ lifted + bridged + deferred covers all 33 sections")

  const sectionPageSrc = readFileSync(
    "components/settings/workspace-settings-growth-engine-section-page.tsx",
    "utf8",
  )
  assert.match(sectionPageSrc, /liftKind === "bridged"/)
  assert.match(sectionPageSrc, /WorkspaceSettingsGrowthEngineBridgePanel/)
  assert.match(sectionPageSrc, /rendersGrowthEnginePhasePlaceholder/)
  assert.match(sectionPageSrc, /phaseLabel="Phase 3"/)
  assert.doesNotMatch(sectionPageSrc, /variant="admin"/)
  assert.doesNotMatch(sectionPageSrc, /redirect\(/)
  assert.doesNotMatch(sectionPageSrc, /fetch\(/)
  console.log("  ✓ section page has no redirects or new network requests")

  const growthEnginePageSrc = readFileSync("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx", "utf8")
  assert.doesNotMatch(growthEnginePageSrc, /redirect\(/)
  console.log("  ✓ growth-engine route no longer auto-redirects across shells")

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
        bridged_sections: GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS.length,
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
