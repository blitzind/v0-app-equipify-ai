/**
 * SETTINGS-MENU-FOLLOWUP-1C — Email Signatures nav + Data Admin visibility certification.
 *
 * Run: pnpm test:settings-menu-followup-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import { getOrganizationPlanDisplay } from "../lib/billing/get-organization-plan-display"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  isGrowthWorkspaceSettingsNavItemActive,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"
import {
  buildWorkspaceSettingsRootCategories,
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  WORKSPACE_SETTINGS_PLAN_GROUPS,
} from "../lib/settings/workspace-settings-navigation"
import {
  isDataAdministrationSettingsNavVisible,
  WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER,
} from "../lib/settings/workspace-settings-visibility"

export const SETTINGS_MENU_FOLLOWUP_1C_QA_MARKER = "settings-menu-followup-1c-v1" as const

const ROOT = process.cwd()
const SIGNATURES_PATH = "/growth/settings/signatures"

const COMMUNICATIONS_NAV_ORDER = [
  "communications",
  "mailboxes",
  "signatures",
  "sending-domains",
  "deliverability",
  "warmup",
  "sender-pools",
  "reputation",
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function collectCoreNavLabels(): string[] {
  return buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: true,
    },
  }).flatMap((category) => category.groups.flatMap((group) => group.items.map((item) => item.label)))
}

function collectCoreNavHrefs(isPlatformAdmin: boolean): string[] {
  return buildWorkspaceSettingsRootCategories({
    planCategoryLabel: getOrganizationPlanDisplay({ planId: "growth" }),
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: isPlatformAdmin,
      dataAdministrationNavVisible: isDataAdministrationSettingsNavVisible({ isPlatformAdmin }),
    },
  }).flatMap((category) => category.groups.flatMap((group) => group.items.map((item) => item.href)))
}

function communicationsGroup() {
  const group = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((entry) => entry.id === "communications")
  assert.ok(group, "Growth settings must include Communications group")
  return group!
}

function main(): void {
  console.log(`\n=== SETTINGS-MENU-FOLLOWUP-1C (${SETTINGS_MENU_FOLLOWUP_1C_QA_MARKER}) ===\n`)

  const commGroup = communicationsGroup()
  assert.deepEqual(
    commGroup.items.map((item) => item.id),
    [...COMMUNICATIONS_NAV_ORDER],
    "Communications nav order must include Email Signatures after Mailboxes",
  )
  console.log("  ✓ Growth Communications nav order includes Email Signatures")

  const signaturesItem = commGroup.items.find((item) => item.id === "signatures")
  assert.ok(signaturesItem, "Growth nav must include signatures item")
  assert.equal(signaturesItem.label, "Email Signatures")
  assert.equal(signaturesItem.href, SIGNATURES_PATH)
  assert.equal(growthEngineCustomerSettingsHref("email-signatures"), SIGNATURES_PATH)
  console.log("  ✓ Email Signatures nav item points to /growth/settings/signatures")

  assert.equal(
    isGrowthWorkspaceSettingsNavItemActive(SIGNATURES_PATH, signaturesItem),
    true,
    "signatures route must activate Email Signatures nav item",
  )
  for (const item of commGroup.items) {
    if (item.id === "signatures") continue
    assert.equal(
      isGrowthWorkspaceSettingsNavItemActive(SIGNATURES_PATH, item),
      false,
      `${item.id} must not activate on signatures route`,
    )
  }
  console.log("  ✓ Email Signatures active state works in Growth settings nav")

  const signaturesPagePath = path.join(ROOT, "app/(growth)/growth/settings/signatures/page.tsx")
  assert.ok(fs.existsSync(signaturesPagePath), "signatures page must exist")
  const signaturesPageSrc = read("app/(growth)/growth/settings/signatures/page.tsx")
  assert.match(signaturesPageSrc, /GrowthEmailSignaturesPanel/)
  assert.doesNotMatch(signaturesPageSrc, /GrowthSettingsSectionPlaceholder/)
  assert.doesNotMatch(signaturesPageSrc, /GrowthSettingsSectionPage/)
  console.log("  ✓ /growth/settings/signatures resolves with GrowthEmailSignaturesPanel")

  const visibleCoreLabels = collectCoreNavLabels()
  assert.equal(
    visibleCoreLabels.includes("Email Signatures"),
    false,
    "Core settings visible nav must not include Email Signatures",
  )
  assert.equal(
    visibleCoreLabels.some((label) => /signature/i.test(label)),
    false,
    "Core settings visible nav must not include signature settings",
  )

  const allCorePlanGeneralLabels = [
    ...WORKSPACE_SETTINGS_GENERAL_GROUPS,
    ...WORKSPACE_SETTINGS_PLAN_GROUPS,
  ].flatMap((group) => group.items.map((item) => item.label))
  assert.equal(
    allCorePlanGeneralLabels.some((label) => label === "Email Signatures"),
    false,
    "Core General/Plan nav groups must not include Email Signatures",
  )
  console.log("  ✓ Core /settings/* visible nav excludes Email Signatures")

  assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: false }), false)
  assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: true }), true)
  console.log("  ✓ Data & Administration visibility gated on platform admin")

  const nonAdminHrefs = collectCoreNavHrefs(false)
  assert.ok(
    !nonAdminHrefs.some((href) => href.startsWith("/settings/data-administration")),
    "non-admin Core nav must not include Data & Administration routes",
  )
  const nonAdminCategories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: getOrganizationPlanDisplay({ planId: "growth" }),
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: false,
      dataAdministrationNavVisible: false,
    },
  })
  assert.equal(
    nonAdminCategories.some((category) => category.id === "data_administration"),
    false,
    "non-admin Core nav must not include Data & Administration category",
  )
  console.log("  ✓ non-admin users do not see Data & Administration in Core settings")

  const adminCategories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: true,
    },
  })
  const dataAdminCategory = adminCategories.find((category) => category.id === "data_administration")
  assert.ok(dataAdminCategory, "platform admin Core nav must include Data & Administration")
  assert.equal(dataAdminCategory.groups[0]?.items.length, 5)
  console.log("  ✓ platform admin retains Data & Administration diagnostic entry points")

  assert.equal(WORKSPACE_SETTINGS_VISIBILITY_QA_MARKER, "workspace-settings-visibility-v1")
  const navSource = read("components/settings/workspace-settings-nav.tsx")
  assert.match(navSource, /isDataAdministrationSettingsNavVisible/)
  assert.match(navSource, /dataAdministrationNavVisible/)
  console.log("  ✓ Core settings nav wires Data & Administration visibility gate")

  console.log("\nSETTINGS-MENU-FOLLOWUP-1C verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: SETTINGS_MENU_FOLLOWUP_1C_QA_MARKER,
        growth_communications_nav_items: commGroup.items.length,
        signatures_href: signaturesItem.href,
      },
      null,
      2,
    ),
  )
}

main()
