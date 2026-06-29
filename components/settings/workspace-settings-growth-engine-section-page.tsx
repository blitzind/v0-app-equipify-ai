"use client"

import { WorkspaceSettingsGrowthEngineConnectedMailboxesSection } from "@/components/settings/workspace-settings-growth-engine-connected-mailboxes-section"

/** PROD-HOTFIX — hard route isolation for non-connected-mailboxes sections. */
export const GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_QA_MARKER =
  "growth-engine-settings-hard-isolation-v1" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_ID =
  "connected-mailboxes" as const

type WorkspaceSettingsGrowthEngineSectionPageProps = {
  sectionId: string
}

function WorkspaceSettingsGrowthEngineHardIsolationMarker() {
  console.log("SECTION PAGE RENDERED")

  return (
    <div
      data-growth-engine-settings-hard-isolation="v1"
      data-qa-marker={GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_QA_MARKER}
      style={{
        padding: 32,
        background: "#fff",
        border: "3px solid red",
        fontSize: 24,
      }}
    >
      SECTION PAGE RENDERED
    </div>
  )
}

export default function WorkspaceSettingsGrowthEngineSectionPage({
  sectionId,
}: WorkspaceSettingsGrowthEngineSectionPageProps) {
  if (sectionId === WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_ID) {
    return <WorkspaceSettingsGrowthEngineConnectedMailboxesSection />
  }

  return <WorkspaceSettingsGrowthEngineHardIsolationMarker />
}

export { WorkspaceSettingsGrowthEngineSectionPage }
