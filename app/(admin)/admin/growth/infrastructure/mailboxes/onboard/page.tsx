"use client"

import { Suspense } from "react"
import { MailPlus } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthMailboxOnboardingWizard } from "@/components/growth/mailboxes/growth-mailbox-onboarding-wizard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthMailboxOnboardPage() {
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                <MailPlus size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Mailbox Onboarding</h1>
                <p className="text-sm text-muted-foreground">
                  Guided wizard to register a sender, connect Gmail, validate, configure warmup, and assign a pool.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/infrastructure/mailboxes">Connected mailboxes</Link>
            </Button>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip
          surfaceId="mailbox_provider"
          title="Google mailbox path"
          matchTitle="Google mailbox (primary)"
        />

        <GrowthSectionLayout>
          <Suspense
            fallback={
              <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
                Loading mailbox onboarding…
              </div>
            }
          >
            <GrowthMailboxOnboardingWizard />
          </Suspense>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
