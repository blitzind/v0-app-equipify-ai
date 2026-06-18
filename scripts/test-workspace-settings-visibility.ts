/**
 * Workspace Settings visibility gate verification (local only).
 *
 * Usage: pnpm test:workspace-settings-visibility
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import { getOrganizationPlanDisplay } from "../lib/billing/get-organization-plan-display"
import {
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  buildWorkspaceSettingsRootCategories,
} from "../lib/settings/workspace-settings-navigation"
import {
  WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER,
  isDataAdministrationSettingsNavVisible,
  isGrowthEngineEnabledClient,
  isGrowthEngineSettingsNavVisible,
  isGrowthOperatorSettingsNavVisible,
} from "../lib/settings/workspace-settings-visibility"

const GROWTH_ENGINE_ROUTE_GROUPS = [
  "app/(dashboard)/settings/growth-engine/layout.tsx",
  "app/(dashboard)/settings/growth-operator/layout.tsx",
  "app/(dashboard)/settings/data-administration/layout.tsx",
] as const

function runAudit(): void {
  console.log(`\n=== Workspace Settings visibility (${WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER}) ===\n`)

  const savedGrowthFlag = process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED
  try {
    process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED = "true"
    assert.equal(isGrowthEngineEnabledClient(), true)
    assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: false }), false)
    assert.equal(isGrowthOperatorSettingsNavVisible({ isPlatformAdmin: false }), false)
    assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: false }), false)
    console.log("  ✓ non-admin + Growth flag true → Growth Engine hidden")

    const equipifyGrowthPlanLabel = getOrganizationPlanDisplay({ planId: "growth" })
    assert.equal(equipifyGrowthPlanLabel, "Equipify Growth")
    const customerNav = buildWorkspaceSettingsRootCategories({
      planCategoryLabel: equipifyGrowthPlanLabel,
      ctx: {
        permissions: getOrgPermissionsForRole("owner"),
        growthEngineNavVisible: isGrowthEngineSettingsNavVisible({ isPlatformAdmin: false }),
        dataAdministrationNavVisible: isDataAdministrationSettingsNavVisible({ isPlatformAdmin: false }),
      },
    })
    assert.deepEqual(
      customerNav.map((category) => category.label),
      ["General", equipifyGrowthPlanLabel],
    )
    const growthOperatorGroup = customerNav
      .find((category) => category.id === "general")
      ?.groups.find((group) => group.id === "general-growth-operator")
    assert.equal(growthOperatorGroup, undefined)
    console.log("  ✓ non-admin + Equipify Growth plan → Growth Engine hidden")

    assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: true }), true)
    assert.equal(isGrowthOperatorSettingsNavVisible({ isPlatformAdmin: true }), true)
    assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: true }), true)
    console.log("  ✓ platform admin + Growth flag true → Growth Engine visible")

    process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED = "false"
    assert.equal(isGrowthEngineEnabledClient(), false)
    assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: true }), true)
    assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: true }), true)
    console.log("  ✓ platform admin visible even when Growth deployment flag is false")

    assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: false }), false)
    console.log("  ✓ Data & Administration visible only to platform admin")

    const visibilitySrc = readFileSync("lib/settings/workspace-settings-visibility.ts", "utf8")
    assert.doesNotMatch(visibilitySrc, /getOrganizationPlanDisplay|workspace\.planId|planId:/)
    assert.doesNotMatch(visibilitySrc, /\.env\.local/)
    console.log("  ✓ visibility helpers do not depend on plan name or .env.local")

    const gateSrc = readFileSync(
      "lib/settings/require-workspace-settings-platform-admin-access.ts",
      "utf8",
    )
    assert.match(gateSrc, /notFound\(/)
    assert.match(gateSrc, /isPlatformAdminEmail/)
    console.log("  ✓ server route gate uses platform-admin email check + notFound()")

    for (const layoutPath of GROWTH_ENGINE_ROUTE_GROUPS) {
      const layoutSrc = readFileSync(layoutPath, "utf8")
      assert.match(layoutSrc, /requireWorkspaceSettingsPlatformAdminAccess/)
      assert.doesNotMatch(layoutSrc, /redirect\(/)
    }
    console.log("  ✓ direct route protection layouts exist for Growth Engine, Operator, and Data & Administration")

    const growthOperatorManifest = WORKSPACE_SETTINGS_GENERAL_GROUPS.find(
      (group) => group.id === "general-growth-operator",
    )
    assert.ok(growthOperatorManifest)
    assert.equal(
      growthOperatorManifest.items.every((item) => item.visible?.({ growthEngineNavVisible: false, dataAdministrationNavVisible: false, permissions: getOrgPermissionsForRole("owner") }) === false),
      true,
    )
    console.log("  ✓ Growth Operator nav items hidden when growthEngineNavVisible is false")

    const dataAdminSectionPageSrc = readFileSync("components/settings/workspace-settings-section-page.tsx", "utf8")
    assert.match(dataAdminSectionPageSrc, /variant="admin"/)
    assert.doesNotMatch(dataAdminSectionPageSrc, /Coming in Phase/)
    console.log("  ✓ Data & Administration section page avoids phase migration copy")
  } finally {
    if (savedGrowthFlag === undefined) {
      delete process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED
    } else {
      process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED = savedGrowthFlag
    }
  }

  console.log("\nWorkspace Settings visibility verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER,
      },
      null,
      2,
    ),
  )
}

runAudit()
