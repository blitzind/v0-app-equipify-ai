import { redirect } from "next/navigation"
import {
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID,
} from "@/lib/settings/workspace-settings-growth-operator"

export default function GrowthOperatorSettingsIndexPage() {
  redirect(`${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID}`)
}
