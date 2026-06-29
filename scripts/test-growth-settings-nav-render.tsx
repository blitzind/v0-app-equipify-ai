/**
 * Repro: render WorkspaceSettingsNav with platform-admin nav visible.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-settings-nav-render.ts
 */
import assert from "node:assert/strict"
import React from "react"
import { renderToString } from "react-dom/server"
import { WorkspaceSettingsNav } from "../components/settings/workspace-settings-nav"
import { AdminProvider } from "../lib/admin-store"
import { OrgPermissionsProvider } from "../lib/org-permissions-context"
import { TenantProvider } from "../lib/tenant-store"
import { ActiveOrganizationProvider } from "../lib/active-organization-context"
import { BillingAccessProvider } from "../lib/billing-access-context"
import {
  buildWorkspaceSettingsRootCategories,
  type WorkspaceSettingsNavContext,
} from "../lib/settings/workspace-settings-navigation"
import { isGrowthEngineSettingsNavVisible } from "../lib/settings/workspace-settings-visibility"
import { getOrgPermissionsForRole } from "../lib/permissions/model"

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"

function mockNavTree() {
  const ctx: WorkspaceSettingsNavContext = {
    permissions: getOrgPermissionsForRole("owner"),
    growthEngineNavVisible: isGrowthEngineSettingsNavVisible({ isPlatformAdmin: true }),
    dataAdministrationNavVisible: true,
  }
  const categories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Pro",
    ctx,
  })
  assert.ok(categories.some((c) => c.id === "growth_engine"), "expected growth_engine category")
  const growthItems = categories
    .filter((c) => c.id === "growth_engine")
    .flatMap((c) => c.groups.flatMap((g) => g.items))
  assert.ok(growthItems.length > 0, "expected growth nav items")
  console.log("growth nav items:", growthItems.length)
}

function renderNav() {
  const tree = (
    <AdminProvider>
      <ActiveOrganizationProvider>
        <BillingAccessProvider>
          <OrgPermissionsProvider>
            <TenantProvider>
              <WorkspaceSettingsNav variant="desktop" />
            </TenantProvider>
          </OrgPermissionsProvider>
        </BillingAccessProvider>
      </ActiveOrganizationProvider>
    </AdminProvider>
  )
  const html = renderToString(tree)
  assert.ok(html.length > 0)
  console.log("rendered nav html length:", html.length)
}

mockNavTree()
renderNav()
console.log("test-growth-settings-nav-render: ok")
