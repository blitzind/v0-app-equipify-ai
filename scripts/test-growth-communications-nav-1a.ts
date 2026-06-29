/**
 * GE-COMMS-NAV-1A — Communications settings navigation active-state certification.
 * Run: pnpm test:growth-communications-nav-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_NAV_QA_MARKER,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
  isGrowthCommunicationsSettingsNavItemActive,
  resolveGrowthCommunicationsSettingsActiveNavItemId,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  isGrowthWorkspaceSettingsNavItemActive,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function communicationsItem(id: string) {
  const group = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((entry) => entry.id === "communications")
  const item = group?.items.find((entry) => entry.id === id)
  assert.ok(item, `missing communications nav item ${id}`)
  return item!
}

function assertOnlyActive(pathname: string, expectedId: string): void {
  const group = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((entry) => entry.id === "communications")
  assert.ok(group)
  for (const item of group!.items) {
    const active = isGrowthWorkspaceSettingsNavItemActive(pathname, item)
    if (item.id === expectedId) {
      assert.equal(active, true, `${pathname} should activate ${expectedId}`)
    } else {
      assert.equal(active, false, `${pathname} should not activate ${item.id}`)
    }
  }
}

function main(): void {
  assert.equal(GROWTH_COMMUNICATIONS_SETTINGS_NAV_QA_MARKER, "growth-communications-settings-nav-1a-v1")

  const navSource = readSource("lib/growth/navigation/growth-workspace-settings-navigation.ts")
  assert.doesNotMatch(navSource, /\|\| isGrowthCommunicationsSettingsPath\(pathname\)/)
  assert.match(navSource, /isGrowthCommunicationsSettingsNavItemActive/)

  const shellSource = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(shellSource, /font-semibold text-foreground/)
  assert.match(shellSource, /border-primary/)
  assert.match(shellSource, /aria-current=\{active \? "page" : undefined\}/)
  assert.doesNotMatch(shellSource, /NAV_ROW_ACTIVE_SIDEBAR/)

  assert.equal(communicationsItem("communications").href, GROWTH_COMMUNICATIONS_SETTINGS_PATH)

  const cases: Array<[string, string]> = [
    [GROWTH_COMMUNICATIONS_SETTINGS_PATH, "communications"],
    [GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH, "mailboxes"],
    [GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH, "mailboxes"],
    [GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH, "mailboxes"],
    [GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH, "sending-domains"],
    [GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH, "deliverability"],
    [GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH, "deliverability"],
    [GROWTH_COMMUNICATIONS_WARMUP_PATH, "warmup"],
    [`${GROWTH_COMMUNICATIONS_WARMUP_PATH}?sender=abc`, "warmup"],
    [GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH, "sender-pools"],
    [GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH, "reputation"],
    [GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH, "reputation"],
  ]

  for (const [pathname, expectedId] of cases) {
    assert.equal(resolveGrowthCommunicationsSettingsActiveNavItemId(pathname), expectedId, pathname)
    assert.equal(isGrowthCommunicationsSettingsNavItemActive(pathname, expectedId), true, pathname)
    assertOnlyActive(pathname, expectedId)
  }

  console.log("growth-communications-nav-1a: ok")
}

main()
