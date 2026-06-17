/**
 * Growth topbar Core account menu certification (Phase 6F — local only).
 *
 * Usage: pnpm test:growth-topbar-core-account
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

const WORKSPACE_TOPBAR_ACCOUNT_CONTROLS_QA_MARKER = "workspace-topbar-account-controls-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

export const GROWTH_TOPBAR_CORE_ACCOUNT_QA_MARKER = "growth-topbar-core-account-v1" as const

const FILES = {
  growthTopbar: "components/growth/shell/growth-topbar.tsx",
  coreTopbar: "components/app-topbar.tsx",
  accountControls: "components/workspace/workspace-topbar-account-controls.tsx",
  growthLayout: "app/(growth)/growth/layout.tsx",
  middleware: "middleware.ts",
} as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertIncludes(relativePath: string, needle: string, message: string): void {
  assert.ok(read(relativePath).includes(needle), message)
}

function assertExcludes(relativePath: string, needle: string, message: string): void {
  assert.ok(!read(relativePath).includes(needle), message)
}

function runAudit(): void {
  console.log(`\n=== Growth topbar Core account menu (${GROWTH_TOPBAR_CORE_ACCOUNT_QA_MARKER}) ===\n`)

  assertIncludes(
    FILES.growthTopbar,
    "WorkspaceTopbarAccountControls",
    "Growth topbar must reuse shared Core account/settings controls",
  )
  assertIncludes(
    FILES.coreTopbar,
    "WorkspaceTopbarAccountControls",
    "Core topbar must reuse shared account/settings controls",
  )
  assertExcludes(
    FILES.growthTopbar,
    "initialsFromDisplayLabel",
    "Growth topbar must not render standalone identity block",
  )
  assertExcludes(FILES.growthTopbar, "sessionIdentity?.displayName", "Growth topbar must not duplicate account menu markup")
  console.log("  ✓ Growth and Core share WorkspaceTopbarAccountControls")

  assertIncludes(FILES.accountControls, WORKSPACE_TOPBAR_ACCOUNT_CONTROLS_QA_MARKER, "Account controls QA marker")
  assertIncludes(FILES.accountControls, "Account menu", "Account hub trigger aria-label")
  assertIncludes(FILES.accountControls, "Notifications —", "Notifications bell preserved")
  assertIncludes(FILES.accountControls, "/settings/general", "Settings launcher links preserved")
  assert.equal(
    (read(FILES.accountControls).match(/export function WorkspaceTopbarAccountControls/g) ?? []).length,
    1,
    "single account controls implementation",
  )
  console.log("  ✓ shared account/settings component contains notifications + account hub")

  assertIncludes(FILES.growthTopbar, "WorkspaceSwitcher", "Growth workspace switcher preserved")
  assertIncludes(FILES.growthTopbar, 'workspace="growth"', "Growth search preserved")
  assertIncludes(FILES.growthTopbar, "Open menu", "Mobile hamburger preserved")
  assertIncludes(FILES.growthTopbar, "aria-controls", "Mobile menu targets drawer nav id")
  console.log("  ✓ Growth left/center topbar behavior preserved")

  assertIncludes(FILES.growthLayout, "ActiveOrganizationProvider", "Growth layout provides org context for account menu")
  assertIncludes(FILES.growthLayout, "OrgPermissionsProvider", "Growth layout provides permissions for launcher filtering")
  assertIncludes(FILES.growthLayout, "TenantProvider", "Growth layout provides tenant context for plan badge")
  assertIncludes(FILES.growthLayout, "TenantWorkspaceSync", "Growth layout syncs tenant workspace like Core")
  console.log("  ✓ Growth layout wires Core account context providers")

  assertExcludes(FILES.growthTopbar, GROWTH_ADMIN_BASE_PATH, "Growth topbar must not hardcode admin routes")
  assertExcludes(FILES.middleware, "WorkspaceTopbarAccountControls", "middleware must remain unchanged")
  console.log("  ✓ no admin hardcodes in topbar; middleware untouched")

  console.log("\nGrowth topbar Core account menu certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_TOPBAR_CORE_ACCOUNT_QA_MARKER,
        account_controls_qa_marker: WORKSPACE_TOPBAR_ACCOUNT_CONTROLS_QA_MARKER,
      },
      null,
      2,
    ),
  )
}

runAudit()
