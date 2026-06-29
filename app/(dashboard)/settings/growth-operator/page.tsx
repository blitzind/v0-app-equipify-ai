import { redirect } from "next/navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export default function GrowthOperatorSettingsIndexPage() {
  redirect(`${GROWTH_WORKSPACE_BASE_PATH}/settings/profile`)
}
