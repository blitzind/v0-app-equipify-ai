import { redirect } from "next/navigation"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

/** Legacy alias — connected mailboxes is the canonical Microsoft 365 mailbox surface. */
export default function GrowthSettingsMicrosoft365RedirectPage() {
  redirect(GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH)
}
