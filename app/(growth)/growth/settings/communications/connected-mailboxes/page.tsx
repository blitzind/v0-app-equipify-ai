"use client"

import { Suspense } from "react"
import { Mailbox } from "lucide-react"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"

function ConnectedMailboxesPanel() {
  return (
    <GrowthConnectedMailboxesDashboard oauthReturnTo={GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH} />
  )
}

export default function GrowthCommunicationsConnectedMailboxesPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Connected Mailboxes"
      description="Connect Gmail, validate OAuth health, start warmup, and run human-approved test sends."
      icon={Mailbox}
      adminFallbackHref="/admin/growth/infrastructure/mailboxes"
    >
      <div id={GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR.slice(1)}>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading connected mailboxes…</div>}>
          <ConnectedMailboxesPanel />
        </Suspense>
      </div>
    </GrowthCommunicationsSettingsSection>
  )
}
