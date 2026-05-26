"use client"

import { Sparkles } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthLeadEngineWorkspace } from "@/components/growth/growth-lead-engine-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"

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

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Sparkles size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Lead Engine Sandbox</h1>
              <p className="text-sm text-muted-foreground">
                Internal admin workspace to inspect the Lead Engine pipeline — parser validation via fixtures, no outbound execution.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER}</p>
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
