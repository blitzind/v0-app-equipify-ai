"use client"

import { Video } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_VIDEOS_HUB_MANIFEST } from "@/lib/growth/hubs/growth-videos-hub-manifest"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthVideosPage() {
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
              <Video size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Videos</h1>
              <p className="text-sm text-muted-foreground">Video Recording Studio foundation — human-supervised only.</p>
            </div>
          </div>
        </section>
        <GrowthSectionLayout>
          <GrowthWorkspaceHubPage manifest={GROWTH_VIDEOS_HUB_MANIFEST} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
