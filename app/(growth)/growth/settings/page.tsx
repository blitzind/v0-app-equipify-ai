import { redirect } from "next/navigation"
import { GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID } from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export default function GrowthSettingsIndexPage() {
  redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings/${GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID}`)
}
