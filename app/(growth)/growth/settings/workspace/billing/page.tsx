import { CreditCard } from "lucide-react"
import { GrowthSettingsCoreLinkPage } from "@/components/growth/settings/growth-settings-core-link-page"
import { GROWTH_CORE_SETTINGS_BILLING_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export default function GrowthSettingsWorkspaceBillingPage() {
  return (
    <GrowthSettingsCoreLinkPage
      title="Billing"
      description="Manage subscriptions, payment methods, invoices, and usage."
      icon={CreditCard}
      externalHref={GROWTH_CORE_SETTINGS_BILLING_PATH}
      externalLabel="Open Billing settings"
      cardDescription="Manage subscriptions, payment methods, invoices, and usage."
    />
  )
}
