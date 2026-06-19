"use client"

import { Suspense } from "react"
import { PlayCircle } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSequenceExecutionPanels } from "@/components/growth/sequences/growth-sequence-execution-panels"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

function AdminGrowthSequenceExecutionBody() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sequence execution…</p>}>
      <GrowthSequenceExecutionPanels />
    </Suspense>
  )
}

export default function AdminGrowthSequenceExecutionPage() {
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
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <PlayCircle size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sequence Execution</h1>
              <p className="text-sm text-muted-foreground">
                Guided enrollments with human approval at every step — no autonomous send.
              </p>
            </div>
          </div>
        </section>

        <AdminGrowthSequenceExecutionBody />
      </div>
    </PlatformAdminPageShell>
  )
}
