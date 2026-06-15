"use client"

import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { use } from "react"
import { useAdmin } from "@/lib/admin-store"
import { Button } from "@/components/ui/button"
import { GrowthSharePageDetailPanel } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type PageProps = {
  params: Promise<{ id: string }>
}

export default function AdminGrowthSharePageDetailPage({ params }: PageProps) {
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <FileText size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Share Page Detail</h1>
                <p className="text-sm text-muted-foreground">Review, preview, approve, and monitor engagement.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/growth/share-pages">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to list
              </Link>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthSharePageDetailPanel sharePageId={id} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
