"use client"

import { BookOpenCheck } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthKnowledgeCenterDashboard } from "@/components/growth/growth-knowledge-center-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { KNOWLEDGE_CENTER_QA_MARKER } from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function GrowthKnowledgeCenterPage() {
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
        data-qa={KNOWLEDGE_CENTER_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <BookOpenCheck size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Knowledge Center</h1>
              <p className="text-sm text-muted-foreground">
                Centralized Growth Engine memory for playbooks, FAQs, URLs, and notes — ingestion and retrieval only.
                No embeddings, no vector database, no autonomous generation. Human review required.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthKnowledgeCenterDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
