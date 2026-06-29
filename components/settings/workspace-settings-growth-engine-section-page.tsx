"use client"

/** PROD-HOTFIX — hard route isolation; remove after crash layer is proven. */
export const GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_QA_MARKER =
  "growth-engine-settings-hard-isolation-v1" as const

export default function WorkspaceSettingsGrowthEngineSectionPage() {
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

export { WorkspaceSettingsGrowthEngineSectionPage }
