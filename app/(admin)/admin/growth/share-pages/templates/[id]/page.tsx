"use client"

import { LayoutTemplate } from "lucide-react"
import { use } from "react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSharePageTemplateEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-editor"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthSharePageTemplateEditPage({
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
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <LayoutTemplate size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Edit Share Page Template</h1>
              <p className="text-sm text-muted-foreground">Build sections, theme, and metadata before publishing to the library.</p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthSharePageTemplateEditor templateId={id} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
