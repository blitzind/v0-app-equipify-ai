import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsReputationLegacyRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH)
}
