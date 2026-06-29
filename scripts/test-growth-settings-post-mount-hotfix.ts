/**
 * PROD-HOTFIX — growth settings post-mount crash (null pathname in nav active lookup).
 * Run: pnpm test:growth-settings-post-mount-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  isWorkspaceSettingsNavItemActive,
  type WorkspaceSettingsNavItem,
} from "../lib/settings/workspace-settings-navigation"

export const GROWTH_SETTINGS_POST_MOUNT_HOTFIX_QA_MARKER =
  "growth-settings-post-mount-hotfix-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_POST_MOUNT_HOTFIX_QA_MARKER, "growth-settings-post-mount-hotfix-v1")

  const navSrc = readSource("components/settings/workspace-settings-nav.tsx")
  const navigationSrc = readSource("lib/settings/workspace-settings-navigation.ts")
  const settingsLayout = readSource("app/(dashboard)/settings/layout.tsx")
  const observerSrc = readSource("lib/settings/growth-settings-post-mount-observer.tsx")

  assert.match(navSrc, /const pathname = usePathname\(\) \?\? ""/)
  assert.match(navigationSrc, /if \(!pathname\) return false/)
  assert.match(settingsLayout, /GrowthSettingsPostMountObserver/)
  assert.match(observerSrc, /\[growth-settings-post-mount-error\]/)
  assert.match(observerSrc, /growth-settings-post-mount-observer-v1/)

  const item: WorkspaceSettingsNavItem = {
    id: "connected-mailboxes",
    label: "Connected Mailboxes",
    description: "test",
    href: "/settings/growth-engine/connected-mailboxes",
    icon: (() => null) as WorkspaceSettingsNavItem["icon"],
  }

  assert.equal(isWorkspaceSettingsNavItemActive(null, item), false)
  assert.equal(isWorkspaceSettingsNavItemActive(undefined, item), false)
  assert.equal(isWorkspaceSettingsNavItemActive("", item), false)
  assert.equal(
    isWorkspaceSettingsNavItemActive("/settings/growth-engine/connected-mailboxes", item),
    true,
  )

  console.log("growth-settings-post-mount-hotfix: ok")
}

main()
