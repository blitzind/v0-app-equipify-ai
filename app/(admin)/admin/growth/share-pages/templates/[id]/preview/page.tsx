"use client"

import { Eye } from "lucide-react"
import { use, useEffect, useState } from "react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSharePageTemplatePreviewPage } from "@/components/growth/share-pages/templates/growth-share-page-template-preview-page"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"

export default function AdminGrowthSharePageTemplatePreviewRoute({
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
  const [template, setTemplate] = useState<GrowthSharePageTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/platform/growth/share-pages/templates/${id}`)
      .then((res) => res.json())
      .then((data: { ok: boolean; template?: GrowthSharePageTemplate; message?: string }) => {
        if (!data.template) {
          setError(data.message ?? "Template not found")
          return
        }
        setTemplate(data.template)
      })
      .catch(() => setError("Failed to load template preview"))
  }, [id])

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Eye size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Template Preview</h1>
              <p className="text-sm text-muted-foreground">
                Sample personalization preview only — no preview tokens or live share pages.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {template ? <GrowthSharePageTemplatePreviewPage template={template} /> : null}
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
