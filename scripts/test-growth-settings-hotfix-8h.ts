/**
 * GS-GROWTH-SETTINGS-HOTFIX-8H — Communications settings route load regression guard.
 * Run: pnpm test:growth-settings-hotfix-8h
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
} from "../lib/growth/navigation/growth-communications-settings-navigation"

export const GROWTH_SETTINGS_HOTFIX_8H_QA_MARKER = "growth-settings-hotfix-8h-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertClientPage(relativePath: string): void {
  const source = readSource(relativePath)
  assert.match(
    source,
    /^"use client"/m,
    `${relativePath} must be a client page so Lucide icons are not passed from a server parent`,
  )
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_HOTFIX_8H_QA_MARKER, "growth-settings-hotfix-8h-v1")

  const middleware = readSource("middleware.ts")
  assert.match(middleware, /requestHeaders\.set\("x-growth-pathname", pathname\)/)
  assert.match(middleware, /request:\s*\{\s*headers:\s*requestHeaders/)
  assert.doesNotMatch(middleware, /response\.headers\.set\("x-growth-pathname"/)

  const growthLayout = readSource("app/(growth)/layout.tsx")
  assert.match(growthLayout, /loadPlatformAdminIdentity\(\)/)
  assert.match(growthLayout, /resolveGrowthWorkspaceSettingsPageAccess/)
  assert.match(growthLayout, /catch/)
  assert.doesNotMatch(
    growthLayout,
    /if \(communicationsSettingsRoute\)[\s\S]*?loadPlatformAdminIdentity/,
    "layout must prefer platform admin before communications RBAC",
  )

  const pageAccess = readSource("lib/growth/settings/growth-workspace-settings-page-access.ts")
  assert.match(pageAccess, /growth-workspace-settings-page-access-8h-v1/)
  assert.match(pageAccess, /if \(isPlatformAdmin\)/)
  assert.match(pageAccess, /catch \{\s*return \{ ok: false, reason: "forbidden" \}/)

  const apiAccess = readSource("lib/growth/settings/growth-workspace-settings-api-access.ts")
  assert.match(apiAccess, /growth-workspace-settings-api-access-8h-v1/)
  assert.match(apiAccess, /if \(isPlatformAdmin\)/)
  assert.match(apiAccess, /catch \(error\)/)

  const communicationsRoutes = [
    "app/(growth)/growth/settings/communications/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/onboard/page.tsx",
    "app/(growth)/growth/settings/communications/sending-domains/page.tsx",
    "app/(growth)/growth/settings/communications/deliverability/page.tsx",
    "app/(growth)/growth/settings/communications/warmup/page.tsx",
    "app/(growth)/growth/settings/communications/sender-pools/page.tsx",
    "app/(growth)/growth/settings/communications/reputation/page.tsx",
  ]
  for (const route of communicationsRoutes) {
    assert.ok(fs.existsSync(route), `missing route ${route}`)
  }

  const clientPages = communicationsRoutes.filter((route) => route.includes("/communications/") && route !== "app/(growth)/growth/settings/communications/page.tsx")
  for (const route of clientPages) {
    assertClientPage(route)
  }

  const hubPage = readSource("app/(growth)/growth/settings/communications/page.tsx")
  assert.doesNotMatch(hubPage, /^"use client"/m, "hub page stays server-wrapped around client hub component")

  const adminFallbacks = [
    "/admin/growth/infrastructure/mailboxes",
    "/admin/growth/infrastructure/mailboxes/onboard",
    "/admin/growth/infrastructure/deliverability",
    "/admin/growth/providers/sender-pools",
    "/admin/growth/deliverability",
  ]
  const communicationsPages = [
    "app/(growth)/growth/settings/communications/mailboxes/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/onboard/page.tsx",
    "app/(growth)/growth/settings/communications/deliverability/page.tsx",
    "app/(growth)/growth/settings/communications/sender-pools/page.tsx",
    "app/(growth)/growth/settings/communications/reputation/page.tsx",
  ]
  for (const href of adminFallbacks) {
    assert.ok(
      communicationsPages.some((page) => readSource(page).includes(href)),
      `expected an admin fallback link for ${href}`,
    )
  }

  assert.equal(GROWTH_COMMUNICATIONS_SETTINGS_PATH, "/growth/settings/communications")
  assert.equal(GROWTH_COMMUNICATIONS_MAILBOXES_PATH, "/growth/settings/communications/mailboxes")
  assert.equal(GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH, "/growth/settings/communications/mailboxes/onboard")

  console.log("growth-settings-hotfix-8h: ok")
}

main()
