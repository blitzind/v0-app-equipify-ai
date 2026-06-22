import { Suspense } from "react"
import { MailPlus } from "lucide-react"
import { GrowthMailboxOnboardingWizard } from "@/components/growth/mailboxes/growth-mailbox-onboarding-wizard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"

export default function GrowthCommunicationsMailboxOnboardPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Mailbox Onboarding"
      description="Guided setup to register a sender, connect Gmail, validate, configure warmup, and assign a pool."
      icon={MailPlus}
      iconClassName="bg-violet-50 text-violet-700"
      adminFallbackHref="/admin/growth/infrastructure/mailboxes/onboard"
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading mailbox onboarding…
          </div>
        }
      >
        <GrowthMailboxOnboardingWizard
          paths={{
            returnBasePath: GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
            connectedMailboxesHref: GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
          }}
        />
      </Suspense>
    </GrowthCommunicationsSettingsSection>
  )
}
