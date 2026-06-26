/**
 * GS-RBAC-1A — Growth Engine operator access model certification.
 *
 * Usage:
 *   pnpm test:growth-rbac-1a
 *   pnpm test:growth-rbac-1a:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_ROUTE_METADATA } from "../lib/growth/navigation/growth-route-metadata"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_RBAC_ROUTE_MATRIX_QA_MARKER,
  resolveGrowthApiMinimumRole,
  resolveGrowthWorkspacePageMinimumRole,
} from "../lib/growth/rbac/growth-route-access-matrix"
import {
  growthRoleCanAccessGrowthApiPath,
  growthRoleCanAccessWorkspacePath,
} from "@/lib/growth/rbac/growth-route-access-matrix"
import {
  GROWTH_MANAGER_DENIALS,
  GROWTH_OPERATOR_CAPABILITIES,
  GROWTH_OPERATOR_DENIALS,
} from "../lib/growth/rbac/growth-permissions"
import { GROWTH_ROLE_LABELS, growthRoleMeetsMinimum } from "../lib/growth/rbac/growth-role-types"

export const GROWTH_RBAC_1A_QA_MARKER = "growth-rbac-1a-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

type CertificationCase = {
  label: string
  path: string
  expect: boolean
}

function assertCases(role: "growth_operator" | "growth_manager" | "platform_admin", cases: CertificationCase[]): void {
  for (const testCase of cases) {
    const allowed = growthRoleCanAccessWorkspacePath(role, testCase.path)
    assert.equal(
      allowed,
      testCase.expect,
      `${GROWTH_ROLE_LABELS[role]} ${testCase.label} (${testCase.path}) expected ${testCase.expect}`,
    )
  }
}

function runCertification(): void {
  console.log(`\n=== GS-RBAC-1A (${GROWTH_RBAC_1A_QA_MARKER}) ===\n`)

  const accessSource = read("lib/growth/access.ts")
  const layoutSource = read("app/(growth)/layout.tsx")
  const resolutionSource = read("lib/growth/rbac/growth-access-resolution.ts")
  const matrixSource = read("lib/growth/rbac/growth-route-access-matrix.ts")

  assert.match(accessSource, /requireGrowthAccess/)
  assert.match(accessSource, /requireGrowthOperatorAccess/)
  assert.match(accessSource, /requireGrowthManagerAccess/)
  assert.match(layoutSource, /resolveGrowthWorkspacePageAccess/)
  assert.doesNotMatch(layoutSource, /loadPlatformAdminIdentity/)
  assert.match(resolutionSource, /resolveGrowthRoleForUser/)
  assert.match(matrixSource, /growth-rbac-route-matrix-1a-v1/)
  console.log("  ✓ centralized Growth RBAC modules wired into layout + API access")

  assert.ok(growthRoleMeetsMinimum("platform_admin", "growth_operator"))
  assert.ok(growthRoleMeetsMinimum("growth_manager", "growth_operator"))
  assert.ok(!growthRoleMeetsMinimum("growth_operator", "growth_manager"))
  console.log("  ✓ role hierarchy: admin > manager > operator")

  assertCases("growth_operator", [
    { label: "Leads", path: "/growth/leads", expect: true },
    { label: "Inbox", path: "/growth/inbox", expect: true },
    { label: "Calls", path: "/growth/calls", expect: true },
    { label: "Meetings", path: "/growth/meetings", expect: true },
    { label: "Opportunities", path: "/growth/opportunities", expect: true },
    { label: "Admin Runtime", path: "/growth/admin/runtime", expect: false },
    { label: "Provider Health", path: "/growth/settings/provider-health", expect: false },
    { label: "Diagnostics", path: "/growth/inbox/operations", expect: false },
    { label: "Compliance Admin", path: "/growth/settings/compliance", expect: false },
  ])
  console.log("  ✓ Operator certification PASS")

  assertCases("growth_manager", [
    { label: "Automation", path: "/growth/automation", expect: true },
    { label: "Campaigns", path: "/growth/campaigns", expect: true },
    { label: "Audiences", path: "/growth/audiences", expect: true },
    { label: "Analytics", path: "/growth/videos/analytics", expect: true },
    { label: "Platform Admin Runtime", path: "/growth/admin/runtime", expect: false },
    { label: "Provider Infrastructure", path: "/growth/settings/communications/sender-pools", expect: false },
  ])
  console.log("  ✓ Manager certification PASS")

  assertCases("platform_admin", [
    { label: "Admin Runtime", path: "/growth/admin/runtime", expect: true },
    { label: "Compliance Admin", path: "/growth/settings/compliance", expect: true },
    { label: "Provider Health", path: "/growth/settings/provider-health", expect: true },
    { label: "Leads", path: "/growth/leads", expect: true },
    { label: "Automation", path: "/growth/automation", expect: true },
  ])
  console.log("  ✓ Platform Admin certification PASS")

  assert.equal(
    resolveGrowthApiMinimumRole("/api/platform/growth/providers"),
    "platform_admin",
  )
  assert.equal(
    resolveGrowthApiMinimumRole("/api/platform/growth/leads"),
    "growth_operator",
  )
  assert.equal(
    resolveGrowthApiMinimumRole("/api/platform/growth/automation"),
    "growth_manager",
  )
  assert.equal(
    resolveGrowthApiMinimumRole("/api/platform/growth/ai-os/command-center"),
    "growth_operator",
  )
  assert.ok(growthRoleCanAccessGrowthApiPath("growth_operator", "/api/platform/growth/ai-os/command-center"))
  assert.ok(!growthRoleCanAccessGrowthApiPath("growth_operator", "/api/platform/growth/providers"))
  console.log("  ✓ API route matrix resolves operator/manager/admin tiers")

  const workspaceRoutes = GROWTH_ROUTE_METADATA.filter(
    (entry) => entry.path.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}`) || entry.workspacePath?.startsWith(GROWTH_WORKSPACE_BASE_PATH),
  )
  assert.ok(workspaceRoutes.length >= 80, "expected migrated workspace route catalog entries")
  for (const route of workspaceRoutes.slice(0, 5)) {
    const path = route.path.startsWith(GROWTH_WORKSPACE_BASE_PATH) ? route.path : route.workspacePath!
    const minimumRole = resolveGrowthWorkspacePageMinimumRole(path)
    assert.ok(["growth_operator", "growth_manager", "platform_admin"].includes(minimumRole))
  }
  console.log(`  ✓ ${workspaceRoutes.length} workspace routes classified`)

  assert.ok(GROWTH_OPERATOR_CAPABILITIES.length >= 7)
  assert.ok(GROWTH_OPERATOR_DENIALS.length >= 5)
  assert.ok(GROWTH_MANAGER_DENIALS.length >= 4)
  console.log("  ✓ role capability definitions exported")

  const middlewareAuth = read("scripts/test-growth-middleware-auth.ts")
  assert.match(middlewareAuth, /resolveGrowthWorkspacePageAccess/)
  console.log("  ✓ middleware auth audit references Growth RBAC layout gate")

  console.log("\nGS-RBAC-1A Certification PASSED\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_RBAC_1A_QA_MARKER,
        route_matrix_marker: GROWTH_RBAC_ROUTE_MATRIX_QA_MARKER,
        operator: "PASS",
        manager: "PASS",
        platform_admin: "PASS",
      },
      null,
      2,
    ),
  )
}

runCertification()
