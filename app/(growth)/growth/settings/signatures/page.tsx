"use client"

import { Signature } from "lucide-react"
import { GrowthEmailSignaturesPanel } from "@/components/growth/signatures/growth-email-signatures-panel"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function Page() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Email Signatures"
      description="Sender profiles, signature templates, and mailbox assignments for outreach."
      icon={Signature}
    >
      <GrowthEmailSignaturesPanel />
    </GrowthCommunicationsSettingsSection>
  )
}
