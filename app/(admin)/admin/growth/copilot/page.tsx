"use client"

import { Bot } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useAdmin } from "@/lib/admin-store"
import { GrowthAiCopilotDashboard } from "@/components/growth/growth-ai-copilot-dashboard"
import { OutboundLaunchContextBanner } from "@/components/growth/outbound-launch/outbound-launch-context-banner"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthCopilotPage() {
  const searchParams = useSearchParams()
  const filterLeadId = searchParams.get("leadId")
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-700">
              <Bot size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>AI Communication Copilot</h1>
              <p className="text-sm text-muted-foreground">
                Execution assistance from Growth Engine intelligence — human approval required, no auto-send.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <OutboundLaunchContextBanner className="mb-4" />
          <GrowthAiCopilotDashboard filterLeadId={filterLeadId} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
