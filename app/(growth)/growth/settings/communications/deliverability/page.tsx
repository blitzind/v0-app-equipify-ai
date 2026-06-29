import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsDeliverabilityLegacyRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH)
}
