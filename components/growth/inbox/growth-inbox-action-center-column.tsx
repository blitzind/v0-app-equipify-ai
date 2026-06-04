"use client"

import { GrowthInboxActionCenterWorkflowEmbeds } from "@/components/growth/inbox/growth-inbox-action-center-workflow-embeds"
import { GrowthInboxActionCenterReplyDraftEmbed } from "@/components/growth/inbox/growth-inbox-action-center-reply-draft-embed"
import { GrowthInboxQuickActions } from "@/components/growth/inbox/growth-inbox-quick-actions"
import { GrowthInboxRecommendedActionCard } from "@/components/growth/inbox/growth-inbox-recommended-action-card"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

function ActionSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-lg border border-border/60 bg-card p-3">
      {title ? (
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      ) : null}
      {children}
    </section>
  )
}

export function GrowthInboxActionCenterColumn() {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { error: leadContextError } = useGrowthInboxLeadContext()

  if (!selectedThread) {
    return (
      <div className="flex h-full flex-col p-4">
        <h2 className="text-sm font-semibold">Action Center</h2>
        <p className="mt-4 text-sm text-muted-foreground">Select a thread to view recommendations and operator actions.</p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">Action Center</h2>
        <p className="text-[11px] text-muted-foreground">Human approval only — no automation.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {leadContextError ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{leadContextError}</p>
        ) : null}

        <ActionSection title="Recommended Action">
          <GrowthInboxRecommendedActionCard />
        </ActionSection>

        <ActionSection title="Quick Actions">
          <GrowthInboxQuickActions />
        </ActionSection>

        <GrowthInboxActionCenterWorkflowEmbeds />

        <ActionSection title="Reply Drafting">
          <GrowthInboxActionCenterReplyDraftEmbed />
        </ActionSection>
      </div>
    </div>
  )
}
