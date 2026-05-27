"use client"

import { Search } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthLeadEngineWorkspace } from "@/components/growth/growth-lead-engine-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER } from "@/lib/growth/lead-engine/lead-intelligence-inspector-types"

export default function AdminGrowthLeadEnginePage() {
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

        <section
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          data-qa-marker={GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Search size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Lead Intelligence Inspector</h1>
              <p className="text-sm text-muted-foreground">
                Operator-facing intelligence review — inspect pipeline outputs, evidence, and guidance before outreach.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER}
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthLeadEngineWorkspace />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
