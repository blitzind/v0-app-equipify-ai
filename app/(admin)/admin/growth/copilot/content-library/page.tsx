"use client"

import { Library } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER } from "@/lib/growth/content/content-types"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function GrowthContentLibraryPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div
        className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8"
        data-qa={GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Library size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Content Library</h1>
              <p className="text-sm text-muted-foreground">
                Governed templates and snippets for sequences, reply drafts, booking follow-ups, and manual tasks —
                approval required before live send, no unsafe merge fields.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthContentLibraryDashboardView />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
