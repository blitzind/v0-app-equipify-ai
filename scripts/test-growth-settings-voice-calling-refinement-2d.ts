/**
 * GROWTH-SETTINGS-VOICE-CALLING-REFINEMENT-2D — Voice & Calling UX polish certification.
 *
 * Run: pnpm test:growth-settings-voice-calling-refinement-2d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_SECTION_GAP,
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export { GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER }

const ROOT = process.cwd()

const VOICE_NAV_IDS = ["calling-preferences"] as const

const OPERATOR_FACING_CALLING_FILES = [
  "components/growth/settings/growth-settings-calling-preferences-page.tsx",
  "components/growth/settings/growth-calling-preferences-readiness-summary.tsx",
  "components/growth/settings/growth-calling-connection-status-panel.tsx",
  "components/growth/growth-operator-assist-preferences.tsx",
] as const

const FORBIDDEN_OPERATOR_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Operator AI Module/i,
  /Dial status/i,
  /Voice infrastructure/i,
  /Native Dialer providers/i,
  /Primary provider/i,
  /Fallback provider/i,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{[A-Z0-9_]+QA_[A-Z0-9_]+\}/

const CALLING_PANEL_FILES = [
  "components/growth/settings/growth-settings-calling-preferences-page.tsx",
  "components/growth/settings/growth-calling-preferences-readiness-summary.tsx",
  "components/growth/settings/growth-calling-connection-status-panel.tsx",
  "components/growth/growth-communication-settings.tsx",
  "components/growth/growth-live-coaching-settings.tsx",
  "components/growth/growth-operator-assist-preferences.tsx",
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function voiceNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "voice-calling")!
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-VOICE-CALLING-REFINEMENT-2D (${GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER, "growth-settings-voice-calling-refinement-2d-v1")
  console.log("  ✓ Voice & Calling refinement QA marker")

  const voiceGroup = voiceNavGroup()
  assert.deepEqual(
    voiceGroup.items.map((item) => item.id),
    [...VOICE_NAV_IDS],
    "Voice & Calling nav must remain unchanged",
  )
  console.log("  ✓ Voice & Calling navigation unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  const pagePath = "app/(growth)/growth/settings/calling-preferences/page.tsx"
  assert.ok(fs.existsSync(path.join(ROOT, pagePath)))
  const pageSrc = read(pagePath)
  assert.match(pageSrc, /GrowthSettingsCallingPreferencesPage/)
  assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  console.log("  ✓ Calling Preferences route renders wired page")

  const callingPage = read("components/growth/settings/growth-settings-calling-preferences-page.tsx")
  assert.match(
    callingPage,
    /data-growth-settings-voice-calling-refinement=\{GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER\}/,
  )
  assert.match(callingPage, /GrowthCallingPreferencesReadinessSummary/)
  assert.match(callingPage, /GrowthCommunicationSettingsPanel/)
  assert.match(callingPage, /mode="operator"/)
  assert.match(callingPage, /variant="calling-preferences"/)
  assert.match(callingPage, /GrowthOperatorAssistPreferencesPanel/)
  assert.match(callingPage, /GrowthLiveCoachingSettingsPanel mode="operator"/)
  assert.doesNotMatch(callingPage, /GrowthNativeDialerSettingsPanel/)
  assert.doesNotMatch(callingPage, /GrowthVoiceInfrastructureSettingsPanel/)
  assert.match(callingPage, /title="Connection status"/)
  assert.match(callingPage, /title="Dialer"/)
  assert.match(callingPage, /GROWTH_AVA_CALL_ASSISTANCE_TITLE/)
  assert.match(callingPage, /GROWTH_SETTINGS_SECTION_GAP/)
  assert.match(callingPage, /GrowthWorkspacePageHeader/)
  console.log("  ✓ Calling Preferences composed with readiness, connection status, and operator panels")

  const readiness = read("components/growth/settings/growth-calling-preferences-readiness-summary.tsx")
  assert.match(readiness, /Calling ready/)
  assert.match(readiness, /GROWTH_AVA_CALL_ASSISTANCE_TITLE/)
  assert.match(readiness, /Live coaching/)
  console.log("  ✓ Readiness summary surfaces calling status at a glance")

  const connection = read("components/growth/settings/growth-calling-connection-status-panel.tsx")
  assert.match(connection, /managed by Platform admin/i)
  assert.match(connection, /Connected number/)
  assert.doesNotMatch(connection, /PATCH/)
  console.log("  ✓ Connection status is read-only with Platform admin delegation")

  const communicationPanel = read("components/growth/growth-communication-settings.tsx")
  assert.match(communicationPanel, /variant\?: "default" \| "calling-preferences"/)
  assert.match(communicationPanel, /communication-preferences/)
  assert.match(communicationPanel, /\/api\/platform\/growth\/communication-preferences/)
  console.log("  ✓ Dialer panel persistence endpoints unchanged")

  const liveCoaching = read("components/growth/growth-live-coaching-settings.tsx")
  assert.match(liveCoaching, /GrowthLiveCoachingSettingsPanelMode/)
  assert.match(liveCoaching, /managed by Platform admin/i)
  console.log("  ✓ Live coaching supports operator mode without infrastructure controls")

  const assist = read("components/growth/growth-operator-assist-preferences.tsx")
  assert.match(assist, /GROWTH_AVA_CALL_ASSISTANCE_TITLE/)
  assert.match(assist, /operator-assist\/preferences/)
  console.log("  ✓ Call assistance from Ava grouped with production-friendly labels")

  for (const file of CALLING_PANEL_FILES) {
    const src = read(file)
    assert.ok(
      src.includes("GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER") ||
        src.includes("voice-calling-refinement-2d") ||
        file.includes("growth-communication-settings") ||
        file.includes("growth-live-coaching") ||
        file.includes("growth-operator-assist"),
      `${file} must participate in voice calling refinement`,
    )
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
  }

  for (const file of OPERATOR_FACING_CALLING_FILES) {
    const src = read(file)
    for (const pattern of FORBIDDEN_OPERATOR_COPY) {
      assert.doesNotMatch(src, pattern, `${file} must not expose admin/infrastructure copy (${pattern})`)
    }
  }
  console.log("  ✓ Operator panels use production copy without visible QA markers")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token unchanged")

  const adminComms = read("app/(admin)/admin/growth/settings/communications/page.tsx")
  assert.match(adminComms, /GrowthNativeDialerSettingsPanel/)
  assert.match(adminComms, /GrowthVoiceInfrastructureSettingsPanel/)
  console.log("  ✓ Platform Admin still owns voice infrastructure panels")

  console.log("\nGROWTH-SETTINGS-VOICE-CALLING-REFINEMENT-2D verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
        voice_nav_items: VOICE_NAV_IDS.length,
        panels_checked: CALLING_PANEL_FILES.length,
      },
      null,
      2,
    ),
  )
}

main()
