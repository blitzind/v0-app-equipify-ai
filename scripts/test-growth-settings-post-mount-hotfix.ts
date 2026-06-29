/**
 * Growth settings post-mount nav guards certification.
 * Run: pnpm test:growth-settings-post-mount-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  isRenderableWorkspaceSettingsNavItem,
  isWorkspaceSettingsNavItemActive,
  type WorkspaceSettingsNavItem,
} from "../lib/settings/workspace-settings-navigation"
import { WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS } from "../lib/settings/workspace-settings-growth-operator"
import { GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS } from "../lib/growth/settings/growth-workspace-settings-types"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_SETTINGS_POST_MOUNT_HOTFIX_QA_MARKER =
  "growth-settings-post-mount-hotfix-v3" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_POST_MOUNT_HOTFIX_QA_MARKER, "growth-settings-post-mount-hotfix-v3")

  const navSrc = readSource("components/settings/workspace-settings-nav.tsx")
  const navigationSrc = readSource("lib/settings/workspace-settings-navigation.ts")
  const settingsLayout = readSource("app/(dashboard)/settings/layout.tsx")
  const growthOperatorSrc = readSource("lib/settings/workspace-settings-growth-operator.ts")
  const errorBoundarySrc = readSource("components/settings/workspace-settings-nav-error-boundary.tsx")

  assert.match(navSrc, /const pathname = usePathname\(\) \?\? ""/)
  assert.match(navSrc, /isRenderableWorkspaceSettingsNavItem/)
  assert.match(navigationSrc, /if \(!pathname \|\| !item\.href\) return false/)
  assert.match(navigationSrc, /isRenderableWorkspaceSettingsNavItem/)
  assert.match(navigationSrc, /growthEngineCustomerSettingsHref/)
  assert.match(settingsLayout, /WorkspaceSettingsNavShell/)
  assert.doesNotMatch(settingsLayout, /GrowthSettingsPostMountObserver/)
  assert.doesNotMatch(settingsLayout, /WorkspaceSettingsNavRuntimeObserver/)
  assert.match(errorBoundarySrc, /\[workspace-settings-nav-error\]/)
  assert.match(errorBoundarySrc, /growthCategoryLoaded/)
  assert.match(growthOperatorSrc, /"ai-teammate":/)
  assert.match(growthOperatorSrc, /Sparkles/)

  for (const id of GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS) {
    const section = WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS.find((entry) => entry.id === id)
    assert.ok(section, `missing growth operator section ${id}`)
    assert.ok(section.label, `missing label for ${id}`)
    assert.ok(section.href, `missing href for ${id}`)
    assert.ok(section.icon, `missing icon for ${id}`)
  }

  const connectedMailboxesHref = growthEngineCustomerSettingsHref("connected-mailboxes")
  assert.equal(connectedMailboxesHref, "/growth/settings/communications/connected-mailboxes")

  const item: WorkspaceSettingsNavItem = {
    id: "connected-mailboxes",
    label: "Connected Mailboxes",
    description: "test",
    href: connectedMailboxesHref,
    icon: undefined as unknown as WorkspaceSettingsNavItem["icon"],
  }

  assert.equal(isRenderableWorkspaceSettingsNavItem(item), false)
  assert.equal(isWorkspaceSettingsNavItemActive(null, item), false)
  assert.equal(isWorkspaceSettingsNavItemActive(undefined, item), false)
  assert.equal(isWorkspaceSettingsNavItemActive("", item), false)
  assert.equal(isWorkspaceSettingsNavItemActive(connectedMailboxesHref, item), true)
  assert.equal(
    isWorkspaceSettingsNavItemActive(connectedMailboxesHref, {
      ...item,
      href: "",
    }),
    false,
  )

  console.log("growth-settings-post-mount-hotfix: ok")
}

main()
