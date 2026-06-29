import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsMailboxesOnboardLegacyRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH)
}
