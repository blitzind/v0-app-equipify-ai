"use client"

import { ShieldCheck } from "lucide-react"
import { GrowthDeliverabilityDashboard } from "@/components/growth/growth-deliverability-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsDeliverabilityPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Deliverability & DNS"
      description="SPF, DKIM, DMARC, and MX validation with clear next steps for each sending domain."
      icon={ShieldCheck}
      iconClassName="bg-emerald-50 text-emerald-700"
      adminFallbackHref="/admin/growth/infrastructure/deliverability"
    >
      <GrowthDeliverabilityDashboard />
    </GrowthCommunicationsSettingsSection>
  )
}
