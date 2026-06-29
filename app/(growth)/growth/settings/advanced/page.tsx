import { redirect } from "next/navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

/** Legacy Advanced hub — redirects to Growth settings home. */
export default function GrowthSettingsAdvancedRedirectPage() {
  redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings`)
}
