"use client"

import Link from "next/link"
import { ArrowLeft, LineChart } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthRevenueExecutionCommandCenter } from "@/components/growth/growth-revenue-execution-command-center"
import { GrowthRevenuePlaybookCatalog } from "@/components/growth/growth-revenue-playbook-catalog"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthRevenueExecutionPage() {
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
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <LineChart size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Revenue Command Center</h1>
                <p className="text-sm text-muted-foreground">
                  Prioritized revenue execution segments — decision support only, all actions require operator approval.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/growth/revenue-intelligence">
                <ArrowLeft className="mr-2 size-4" />
                Revenue Intelligence
              </Link>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthRevenueExecutionCommandCenter />
          <GrowthRevenuePlaybookCatalog />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
