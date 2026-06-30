/**
 * GROWTH-SETTINGS-COMMUNICATIONS-REFINEMENT-2C — Communications section UX polish certification.
 *
 * Run: pnpm test:growth-settings-communications-refinement-2c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
  resolveGrowthCommunicationsLegacyRedirect,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export { GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER }

const ROOT = process.cwd()

const COMMUNICATIONS_NAV_IDS = [
  "communications",
  "mailboxes",
  "signatures",
  "sending-domains",
  "deliverability",
  "warmup",
  "sender-pools",
  "reputation",
] as const

const COMMUNICATIONS_ROUTES: Array<{ segment: string; panelPattern: RegExp }> = [
  { segment: "communications", panelPattern: /GrowthCommunicationsSettingsHub/ },
  { segment: "communications/connected-mailboxes", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "signatures", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/sending-domains", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/dns-verification", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/warmup", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/sender-pools", panelPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/sending-limits", panelPattern: /GrowthCommunicationsSettingsSection/ },
]

const COMMUNICATIONS_PANEL_FILES = [
  "components/growth/settings/growth-communications-settings-hub.tsx",
  "components/growth/settings/growth-communications-settings-section.tsx",
  "components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx",
  "components/growth/signatures/growth-email-signatures-panel.tsx",
  "components/growth/growth-sender-infrastructure-dashboard.tsx",
  "components/growth/growth-deliverability-dashboard.tsx",
  "components/growth/growth-warmup-dashboard.tsx",
  "components/growth/growth-sender-pools-dashboard.tsx",
  "components/growth/deliverability/deliverability-protection-console.tsx",
] as const

const FORBIDDEN_COMMUNICATIONS_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Growth operator/i,
  /Reputation & Protection/,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{GROWTH_[A-Z0-9_]+QA_MARKER\}/

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function communicationsNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "communications")!
}

function assertRouteExists(segment: string): void {
  const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
  assert.ok(fs.existsSync(pagePath), `Missing Communications route: /growth/settings/${segment}`)
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-COMMUNICATIONS-REFINEMENT-2C (${GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER}) ===\n`,
  )

  assert.equal(
    GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
    "growth-settings-communications-refinement-2c-v1",
  )
  console.log("  ✓ Communications refinement QA marker")

  const commGroup = communicationsNavGroup()
  assert.deepEqual(
    commGroup.items.map((item) => item.id),
    [...COMMUNICATIONS_NAV_IDS],
    "Communications nav group must remain unchanged",
  )
  console.log("  ✓ Communications navigation structure unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  for (const route of COMMUNICATIONS_ROUTES) {
    assertRouteExists(route.segment)
    const pageSrc = read(`app/(growth)/growth/settings/${route.segment}/page.tsx`)
    assert.match(pageSrc, route.panelPattern)
    assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  }
  console.log("  ✓ All Communications routes render wired panels")

  assert.equal(
    resolveGrowthCommunicationsLegacyRedirect(GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH),
    GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  )
  assert.equal(
    resolveGrowthCommunicationsLegacyRedirect(GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH),
    GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  )
  assert.equal(
    resolveGrowthCommunicationsLegacyRedirect(GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH),
    GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  )
  console.log("  ✓ Legacy Communications redirects preserved")

  const hub = read("components/growth/settings/growth-communications-settings-hub.tsx")
  assert.match(hub, /COMMUNICATIONS_HUB_GROUPS/)
  assert.match(hub, /Accounts & identity/)
  assert.match(hub, /Sending infrastructure/)
  assert.match(hub, /Volume & reputation/)
  assert.match(hub, /Email Signatures/)
  assert.match(hub, /data-growth-settings-communications-refinement=\{GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER\}/)
  assert.match(hub, /GROWTH_SETTINGS_SECTION_GAP/)
  console.log("  ✓ Communications hub grouped by accounts, infrastructure, and health")

  const sectionShell = read("components/growth/settings/growth-communications-settings-section.tsx")
  assert.match(sectionShell, /GrowthWorkspacePageHeader/)
  assert.match(sectionShell, /All communications/)
  assert.match(sectionShell, /data-growth-settings-communications-refinement=\{GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER\}/)
  console.log("  ✓ Shared Communications section shell with consistent header actions")

  const reputationPage = read("app/(growth)/growth/settings/communications/sending-limits/page.tsx")
  assert.match(reputationPage, /title="Reputation"/)
  assert.doesNotMatch(reputationPage, /Reputation & Protection/)
  console.log("  ✓ Reputation page title aligned with navigation")

  const mailboxes = read("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(mailboxes, /lg:grid-cols-2/)
  assert.match(mailboxes, /mailboxHealthAccent/)
  assert.doesNotMatch(mailboxes, /<table className="min-w-full text-sm">/)
  assert.doesNotMatch(mailboxes, VISIBLE_QA_MARKER_IN_UI)
  console.log("  ✓ Connected mailboxes use account cards with health accents")

  for (const file of COMMUNICATIONS_PANEL_FILES) {
    const src = read(file)
    assert.match(
      src,
      /GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER|data-growth-settings-communications-refinement/,
      `${file} must expose refinement marker`,
    )
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
    for (const pattern of FORBIDDEN_COMMUNICATIONS_COPY) {
      assert.doesNotMatch(src, pattern, `${file} must not contain placeholder copy (${pattern})`)
    }
  }
  console.log("  ✓ Communications panels use refinement markers and production copy")

  const signatures = read("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(signatures, /border-dashed/)
  assert.match(signatures, /GROWTH_SETTINGS_SECTION_GAP/)
  console.log("  ✓ Email signatures empty state and spacing polished")

  const deliverability = read("components/growth/growth-deliverability-dashboard.tsx")
  assert.match(deliverability, /summary\.headline/)
  assert.doesNotMatch(deliverability, /Mailboxes<\/Link>/)
  console.log("  ✓ Deliverability dashboard concise status summary without duplicate nav")

  const reputationConsole = read("components/growth/deliverability/deliverability-protection-console.tsx")
  assert.match(reputationConsole, /active alert/)
  assert.match(reputationConsole, /Reputation health looks stable/)
  console.log("  ✓ Reputation console surfaces health at a glance")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token unchanged")

  const canonicalPaths = [
    GROWTH_COMMUNICATIONS_SETTINGS_PATH,
    GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
    GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
    GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
    GROWTH_COMMUNICATIONS_WARMUP_PATH,
    GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
    GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  ]
  for (const href of canonicalPaths) {
    const segment = href.replace("/growth/settings/", "")
    assertRouteExists(segment)
  }
  console.log("  ✓ Canonical Communications paths resolve")

  console.log("\nGROWTH-SETTINGS-COMMUNICATIONS-REFINEMENT-2C verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
        communications_nav_items: COMMUNICATIONS_NAV_IDS.length,
        routes_checked: COMMUNICATIONS_ROUTES.length,
        panels_checked: COMMUNICATIONS_PANEL_FILES.length,
      },
      null,
      2,
    ),
  )
}

main()
