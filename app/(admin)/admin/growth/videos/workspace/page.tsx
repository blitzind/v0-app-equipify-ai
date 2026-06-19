"use client"

import { useSearchParams } from "next/navigation"
import { Clapperboard } from "lucide-react"
import { GrowthVideoOperatorWorkspace } from "@/components/growth/videos/growth-video-operator-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthVideosWorkspacePage() {
  const { sessionIdentity } = useAdmin()
  const searchParams = useSearchParams()
  const leadId = searchParams.get("lead_id")

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
              <Clapperboard size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Video Operator Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Unified F1/F2 review surface — metadata-only operator actions, no autonomous execution.
              </p>
            </div>
          </div>
        </section>
        <GrowthSectionLayout>
          {leadId ? (
            <GrowthVideoOperatorWorkspace leadId={leadId} />
          ) : (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Provide <code>?lead_id=</code> to load operator workspace drafts for a lead.
            </div>
          )}
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
