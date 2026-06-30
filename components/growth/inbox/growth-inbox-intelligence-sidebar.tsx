"use client"

import { lazy, Suspense, useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { GrowthInboxActionCenterBookingEmbed } from "@/components/growth/inbox/growth-inbox-action-center-booking-embed"
import { GrowthInboxActionCenterOpportunityEmbed } from "@/components/growth/inbox/growth-inbox-action-center-opportunity-embed"
import { GrowthInboxActionCenterReplyDraftEmbed } from "@/components/growth/inbox/growth-inbox-action-center-reply-draft-embed"
import { GrowthInboxCallActionLinks } from "@/components/growth/inbox/growth-inbox-call-action-links"
import { GrowthInboxQuickActions } from "@/components/growth/inbox/growth-inbox-quick-actions"
import { GrowthInboxRecommendedReplyCard } from "@/components/growth/inbox/growth-inbox-recommended-reply-card"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import { GrowthOnDemandFeature } from "@/components/growth/runtime/growth-on-demand-feature"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxSharedData } from "@/components/growth/inbox/growth-inbox-shared-data-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER,
  GROWTH_INBOX_FINAL_POLISH_QA_MARKER,
} from "@/lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { shouldDeferGrowthInboxTier3Hydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GROWTH_AVA_PANEL_TITLE } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_INTELLIGENCE_SIDEBAR_QA_MARKER = "growth-inbox-intelligence-sidebar-v2" as const

const LazySmsDraftEmbed = lazy(async () => {
  const mod = await import("@/components/growth/inbox/growth-inbox-action-center-sms-draft-embed")
  return { default: mod.GrowthInboxActionCenterSmsDraftEmbed }
})

function SidebarCard({
  title,
  sectionId,
  defaultOpen = true,
  children,
}: {
  title: string
  sectionId: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/60 bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        <h3 id={sectionId} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-2.5 py-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function GrowthInboxIntelligenceSidebar() {
  const { selectedThread } = useGrowthInboxWorkspace()
  const {
    leadId,
    loading,
    error: leadContextError,
    refreshRecommendations,
  } = useGrowthInboxLeadContext()
  const { refreshCommandCenter } = useGrowthInboxSharedData()
  const deferTier3 = shouldDeferGrowthInboxTier3Hydration()

  if (!selectedThread) {
    return (
      <section aria-labelledby="inbox-intelligence-sidebar-heading" data-qa-marker={GROWTH_INBOX_INTELLIGENCE_SIDEBAR_QA_MARKER}>
        <h2 id="inbox-intelligence-sidebar-heading" className="sr-only">
          Intelligence and actions
        </h2>
        <div className="p-3 text-sm text-muted-foreground">Select a thread to see actions and AI assistant guidance.</div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="inbox-intelligence-sidebar-heading"
      className="flex h-full min-h-0 flex-col"
      data-growth-inbox-conversation-workspace={GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER}
      data-growth-inbox-final-polish={GROWTH_INBOX_FINAL_POLISH_QA_MARKER}
      data-qa-marker={GROWTH_INBOX_INTELLIGENCE_SIDEBAR_QA_MARKER}
    >
      <h2 id="inbox-intelligence-sidebar-heading" className="sr-only">
        Intelligence and actions for selected thread
      </h2>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
        {leadContextError ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">{leadContextError}</p>
        ) : null}
        {loading && !leadId ? (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : null}

        <SidebarCard title="Suggested Personalized Follow-Up" sectionId="inbox-sidebar-personalization">
          {leadId ? <GrowthPersonalizationEmbeddedPanel leadId={leadId} surface="inbox" compact /> : null}
        </SidebarCard>

        <SidebarCard title="Next Best Action" sectionId="inbox-sidebar-next-best-action">
          <p className="text-[10px] text-muted-foreground">
            Primary handoff actions live in the conversation header and context strip.
          </p>
          <GrowthInboxRecommendedReplyCard compact />
          <GrowthInboxActionCenterReplyDraftEmbed />
          {selectedThread.channel === "sms" ? (
            <Suspense fallback={<p className="text-[10px] text-muted-foreground">Loading SMS suggestions…</p>}>
              <LazySmsDraftEmbed />
            </Suspense>
          ) : null}
        </SidebarCard>

        <SidebarCard title={GROWTH_AVA_PANEL_TITLE} sectionId="inbox-sidebar-ai-assistant">
          {deferTier3 ? (
            <GrowthOnDemandFeature
              feature="opportunityRecommendations"
              scopeKey={leadId ?? selectedThread.id}
              title="Opportunity signals"
              compact
              load={async () => {
                await refreshRecommendations()
              }}
            >
              <GrowthInboxActionCenterOpportunityEmbed />
            </GrowthOnDemandFeature>
          ) : (
            <GrowthInboxActionCenterOpportunityEmbed />
          )}
          {deferTier3 ? (
            <GrowthOnDemandFeature
              feature="bookingIntelligence"
              scopeKey={leadId ?? selectedThread.id}
              title="Booking signals"
              compact
              load={async () => {
                await refreshRecommendations()
              }}
            >
              <GrowthInboxActionCenterBookingEmbed />
            </GrowthOnDemandFeature>
          ) : (
            <GrowthInboxActionCenterBookingEmbed />
          )}
          {deferTier3 && leadId ? (
            <GrowthOnDemandFeature
              feature="revenueCommandCenter"
              scopeKey={leadId}
              title="Revenue signals"
              compact
              load={async () => {
                await refreshCommandCenter()
              }}
            >
              <p className="text-[10px] text-muted-foreground">Revenue signals loaded for this session.</p>
            </GrowthOnDemandFeature>
          ) : null}
        </SidebarCard>

        <SidebarCard title="Utilities" sectionId="inbox-sidebar-utilities" defaultOpen={false}>
          <GrowthInboxQuickActions mode="utilities" />
          <GrowthInboxCallActionLinks variant="utilities" />
        </SidebarCard>
      </div>
    </section>
  )
}
