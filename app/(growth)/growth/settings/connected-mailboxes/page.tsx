import { redirect } from "next/navigation"
import { GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF } from "@/lib/growth/navigation/growth-delivery-settings-navigation"

export default function GrowthConnectedMailboxesSettingsPage() {
  redirect(GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF)
}
