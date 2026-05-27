"use client"

import { useState } from "react"
import { Plus, Radar } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthIntentPixelAdmin } from "@/components/growth/growth-intent-pixel-admin"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { Button } from "@/components/ui/button"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthIntentPixelPage() {
  const { sessionIdentity } = useAdmin()
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false)
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Radar size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Intent Signals</h1>
                <p className="text-sm text-muted-foreground">
                  Review intent signals across website visitors and upcoming trigger types — filter, prioritize, and
                  route high-intent activity to your team.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 self-start"
              onClick={() => setSetupDrawerOpen(true)}
            >
              <Plus className="size-4" />
              Set up trigger
              <span className="hidden text-violet-200 sm:inline">· Intent Pixel</span>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthIntentPixelAdmin
            setupDrawerOpen={setupDrawerOpen}
            onSetupDrawerOpenChange={setSetupDrawerOpen}
          />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
