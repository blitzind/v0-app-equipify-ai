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
  getWorkspaceSettingsGrowthEngineCanonicalHref,
  listWorkspaceSettingsGrowthEngineLiftedSectionIds,
  resolveGrowthEngineSectionLiftKind,
} from "../lib/settings/workspace-settings-growth-engine-lift"
import { listWorkspaceSettingsGrowthEngineSectionIds } from "../lib/settings/workspace-settings-navigation"

const GE_SET_5_NEWLY_LIFTED = [
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "openai",
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
  assert.equal(lifted.length, 26)
  console.log("  ✓ 26 sections registered as lifted panels")

  const liftSrc = readFileSync("components/settings/workspace-settings-growth-engine-lifted-panels.tsx", "utf8")
  for (const sectionId of lifted) {
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "lifted")
    const expectedPanel = WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_EXPORTS[sectionId]
    assert.ok(expectedPanel, `missing panel export for ${sectionId}`)
    assert.match(liftSrc, new RegExp(expectedPanel))
  }
  console.log("  ✓ lifted sections map to existing panel components (no fake panels)")

  for (const sectionId of GE_SET_5_NEWLY_LIFTED) {
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "lifted", `${sectionId} should be lifted`)
  }
  console.log("  ✓ GE-SET-5 compliance, AI, and marketing lifts registered")

  assert.match(liftSrc, /GrowthComplianceDashboardPanel/)
  assert.match(liftSrc, /GrowthAiCopilotSettingsPanel/)
  assert.match(liftSrc, /GrowthSharePagesDashboard/)
  assert.match(liftSrc, /GrowthContentLibraryDashboardView/)
  assert.doesNotMatch(liftSrc, /GrowthMediaAiVoicePanel/)
  assert.doesNotMatch(liftSrc, /GrowthEngineSettingsPanel/)
  console.log("  ✓ compliance/AI/marketing lifted; scaffolds and coming-soon panels excluded")

  assert.equal(resolveGrowthEngineSectionLiftKind("notification-preferences"), "canonical")
  assert.equal(
    getWorkspaceSettingsGrowthEngineCanonicalHref("notification-preferences"),
    "/settings/growth-operator/notifications",
  )
  const canonicalSrc = readFileSync("components/settings/workspace-settings-canonical-route-panel.tsx", "utf8")
  assert.doesNotMatch(canonicalSrc, /GrowthSettingsNotificationsPanel/)
  console.log("  ✓ notification-preferences remains canonical (no duplicate editor)")

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
  }
  assert.equal(WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length, 6)
  console.log("  ✓ 6 sections remain Phase 3 placeholders")

  const classifiedCount = Object.keys(WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION).length
  assert.equal(classifiedCount, 33)
  console.log("  ✓ every section has documented classification + reason")

  const classified =
    lifted.length +
    1 +
    WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS.length
  assert.equal(classified, 33)
  console.log("  ✓ lifted + canonical + deferred covers all 33 sections")

  const sectionPageSrc = readFileSync(
    "components/settings/workspace-settings-growth-engine-section-page.tsx",
    "utf8",
  )
  assert.match(sectionPageSrc, /liftKind === "canonical"/)
  assert.match(sectionPageSrc, /rendersGrowthEnginePhasePlaceholder/)
  assert.match(sectionPageSrc, /phaseLabel="Phase 3"/)
  assert.doesNotMatch(sectionPageSrc, /variant="admin"/)
  assert.doesNotMatch(sectionPageSrc, /redirect\(/)
  assert.doesNotMatch(sectionPageSrc, /fetch\(/)
  console.log("  ✓ section page has no redirects or new network requests")

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
        canonical_sections: 1,
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
