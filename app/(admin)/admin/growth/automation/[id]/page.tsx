"use client"

import { GitBranch } from "lucide-react"
import { use } from "react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthAutomationFlowEditor } from "@/components/growth/automation/growth-automation-flow-editor"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
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
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Edit Automation Flow</h1>
              <p className="text-sm text-muted-foreground">
                Scaffold canvas, palette, and validation — no compile or execution in S5-B.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthAutomationFlowEditor flowId={id} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
