import { redirect } from "next/navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

/** Favorite destinations live under Sidebar Preferences — no separate command-center prefs yet. */
export default function GrowthSettingsCommandCenterPreferencesRedirectPage() {
  redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings/sidebar-preferences`)
}
