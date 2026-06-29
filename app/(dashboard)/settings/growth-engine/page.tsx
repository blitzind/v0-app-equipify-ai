import { redirect } from "next/navigation"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import { WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID } from "@/lib/settings/workspace-settings-navigation"

export default function GrowthEngineSettingsIndexRedirectPage() {
  redirect(growthEngineCustomerSettingsHref(WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID))
}
