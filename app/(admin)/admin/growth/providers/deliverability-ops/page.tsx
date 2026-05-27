import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthDeliverabilityOpsDashboardView } from "@/components/growth/growth-deliverability-ops-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
} from "@/components/admin/platform-admin-shell"

export default function GrowthDeliverabilityOpsPage() {
  return (
    <PlatformAdminPageShell>
      <PlatformAdminTabNav activeKey="growth_leads" />
      <GrowthSectionLayout
        title="Deliverability Ops"
        description="Operations center for deliverability health, reputation recommendations, risk detection, and human-gated remediation — no autonomous DNS, sender, volume, or provider changes."
      >
        <GrowthDeliverabilityOpsDashboardView />
      </GrowthSectionLayout>
    </PlatformAdminPageShell>
  )
}
