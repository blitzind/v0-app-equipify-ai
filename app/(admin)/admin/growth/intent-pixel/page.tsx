"use client"

import { Radar } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthIntentPixelAdmin } from "@/components/growth/growth-intent-pixel-admin"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import {
  GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
  GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
  GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"

export default function AdminGrowthIntentPixelPage() {
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
              <Radar size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Intent Pixel</h1>
              <p className="text-sm text-muted-foreground">
                Configure first-party website intent tracking, verify install health, and inspect anonymous activity — no third-party enrichment or outbound execution.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER} · {GROWTH_INTENT_PIXEL_LIVE_QA_MARKER} ·{" "}
                {GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER}
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthIntentPixelAdmin />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
