import { redirect } from "next/navigation"
import { WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE, WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID } from "@/lib/settings/workspace-settings-navigation"

export default function GrowthEngineSettingsIndexPage() {
  redirect(`${WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE}/${WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID}`)
}
