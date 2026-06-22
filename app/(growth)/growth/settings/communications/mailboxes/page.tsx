import { Mailbox } from "lucide-react"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsMailboxesPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Connected Mailboxes"
      description="Connect Gmail, validate OAuth health, start warmup, and run human-approved test sends."
      icon={Mailbox}
      iconClassName="bg-violet-50 text-violet-700"
      adminFallbackHref="/admin/growth/infrastructure/mailboxes"
    >
      <div id={GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR.slice(1)} className="space-y-6">
        <GrowthConnectedMailboxesDashboard oauthReturnTo={GROWTH_COMMUNICATIONS_MAILBOXES_PATH} />
      </div>
    </GrowthCommunicationsSettingsSection>
  )
}
