import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsMailboxesLegacyRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH)
}
