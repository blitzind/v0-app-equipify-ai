import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

/** Legacy alias — connected mailboxes is the canonical Gmail settings surface. */
export default function GrowthSettingsGmailRedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH)
}
