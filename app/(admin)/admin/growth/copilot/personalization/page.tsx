"use client"

import { Sparkles } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthAiPersonalizationDashboardView } from "@/components/growth/growth-ai-personalization-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER } from "@/lib/growth/personalization/personalization-types"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthAiPersonalizationPage() {
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
        data-qa={GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Sparkles size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>AI Personalization</h1>
              <p className="text-sm text-muted-foreground">
                Evidence-backed outbound personalization with mandatory human review — no autonomous sends or approval.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthAiPersonalizationDashboardView />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
