import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_MAILBOXES_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthConnectedMailboxesRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_MAILBOXES_PATH)
}
