import { redirect } from "next/navigation"
import { WORKSPACE_SETTINGS_DATA_ADMIN_BASE, WORKSPACE_SETTINGS_DATA_ADMIN_DEFAULT_SECTION_ID } from "@/lib/settings/workspace-settings-navigation"

export default function DataAdministrationSettingsIndexPage() {
  redirect(`${WORKSPACE_SETTINGS_DATA_ADMIN_BASE}/${WORKSPACE_SETTINGS_DATA_ADMIN_DEFAULT_SECTION_ID}`)
}
