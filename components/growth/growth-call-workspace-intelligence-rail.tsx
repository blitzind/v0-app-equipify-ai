"use client"

import Link from "next/link"
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  MessageSquare,
  Search,
  Sparkles,
  Target,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CallWorkspaceLeadSearchResultsPanel } from "@/components/growth/call-workspace-lead-search-results"
import { GrowthCallWorkspaceRelationshipMemoryPanel } from "@/components/growth/growth-call-workspace-relationship-memory-panel"
import { GrowthCallWorkspaceRevenueIntelligencePanel } from "@/components/growth/growth-call-workspace-revenue-intelligence-panel"
import { GrowthCallWorkspaceRetentionIntelligencePanel } from "@/components/growth/growth-call-workspace-retention-intelligence-panel"
import { useCallWorkspaceLeadSearch } from "@/components/growth/use-call-workspace-lead-search"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import {
  GROWTH_CALL_WORKSPACE_PANEL,
  executionReadinessLabel,
  formatDisplayPhone,
  leadInitials,
  meetingOutcomeLabel,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  buildGrowthActivityHref,
  buildGrowthLeadHref,
  buildGrowthMeetingsHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER } from "@/lib/growth/operator-ux/growth-operator-primary-actions-7a2"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import { VOICE_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"
import type {
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { GrowthCallWorkspaceRelationshipSummaryPanel } from "@/components/growth/growth-call-workspace-relationship-summary-panel"
import { GrowthCallWorkspaceSequencePanel } from "@/components/growth/growth-call-workspace-sequence-panel"
import { isPanelVisible } from "@/lib/voice/workspace-context/panel-prioritization"
import type { VoiceWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/types"
import { cn } from "@/lib/utils"

function IntelligenceRow({
  icon: Icon,
  label,
  value,
  badgeTone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  badgeTone?: "neutral" | "healthy" | "attention" | "medium"
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-2.5 last:border-b-0 dark:border-white/5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      <GrowthBadge label={value} tone={badgeTone} />
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
    </div>
  )
}

export function GrowthCallWorkspaceIntelligenceRail({
  embedded = false,
  workspaceContext = null,
  showDeepIntelligence = true,
  leadContext,
  nativeSessionId,
  sessionPhone,
  operatorAssist = null,
  relationshipMemory = null,
  revenueIntelligence = null,
  retentionIntelligence = null,
  onRelationshipMemoryRefresh,
  onRevenueIntelligenceRefresh,
  onRetentionIntelligenceRefresh,
  onLeadAttached,
}: {
  embedded?: boolean
  workspaceContext?: VoiceWorkspaceContextSnapshot | null
  showDeepIntelligence?: boolean
  leadContext: NativeDialerLeadContext | null
  nativeSessionId?: string | null
  sessionPhone?: string | null
  operatorAssist?: UnifiedOperatorAssistSnapshot | null
  relationshipMemory?: VoiceRelationshipMemoryWorkspaceSnapshot | null
  revenueIntelligence?: VoiceRevenueIntelligenceWorkspaceSnapshot | null
  retentionIntelligence?: VoiceRetentionIntelligenceWorkspaceSnapshot | null
  onRelationshipMemoryRefresh?: () => Promise<void>
  onRevenueIntelligenceRefresh?: () => Promise<void>
  onRetentionIntelligenceRefresh?: () => Promise<void>
  onLeadAttached?: (leadId: string, session?: NativeCallWorkspaceSessionPublicView) => void
}) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchDiagnostics,
    searching,
    searchError,
    attachingId,
    attachError,
    showEmpty,
    createProspectHref,
    selectHit,
  } = useCallWorkspaceLeadSearch({
    nativeSessionId,
    leadContextAttached: Boolean(leadContext),
    onLeadAttached,
  })

  const buyingSignalCount =
    operatorAssist?.feed.filter((event) => event.category === "buying_signal").length ??
    operatorAssist?.conversationIntelligence?.buyingSignals.length ??
    0
  const buyingSignalsLabel =
    buyingSignalCount > 0 ? `${buyingSignalCount} live` : "None detected this call"
  const recommendedAction =
    operatorAssist?.nextBestAction.primary?.prompt ??
    leadContext?.recommendedNextAction ??
    "No recommendation yet — review lead command center."

  const previousConversationsLabel = relationshipMemory?.profile
    ? `${relationshipMemory.profile.totalCallCount} prior call${relationshipMemory.profile.totalCallCount === 1 ? "" : "s"}`
    : sessionPhone
      ? "No prior memory"
      : "Not linked"

  const pendingDrafts =
    operatorAssist?.conversationIntelligence?.memoryDrafts.filter((draft) => draft.status === "pending_review") ??
    []

  const panels = workspaceContext?.panels ?? []
  const showLeadSearch = panels.length === 0 || isPanelVisible(panels, "lead_search")
  const showRelationshipSummary = panels.length === 0 || isPanelVisible(panels, "relationship_context")
  const showNextBestAction = panels.length === 0 || isPanelVisible(panels, "next_best_action")
  const showRevenue =
    showDeepIntelligence && (panels.length === 0 || isPanelVisible(panels, "revenue_intelligence"))
  const showRetention =
    showDeepIntelligence && (panels.length === 0 || isPanelVisible(panels, "retention_intelligence"))
  const showMemory =
    showDeepIntelligence && (panels.length === 0 || isPanelVisible(panels, "relationship_memory"))

  const Wrapper = embedded ? "div" : "section"

  return (
    <Wrapper
      className={cn(
        embedded ? "space-y-3" : GROWTH_CALL_WORKSPACE_PANEL,
        !embedded && "w-full max-w-[320px] p-4 lg:justify-self-end",
      )}
      data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      data-native-dialer-lead-search-qa-marker={GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER}
      data-voice-relationship-memory-qa-marker={VOICE_RELATIONSHIP_MEMORY_QA_MARKER}
      data-voice-revenue-intelligence-qa-marker={VOICE_REVENUE_INTELLIGENCE_QA_MARKER}
      data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
      data-growth-ops-click-reduction={GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER}
    >
      {embedded ? null : <h3 className="mb-3 text-sm font-semibold">Prospect Intelligence</h3>}

      {!leadContext ? (
        <div className="space-y-3" data-qa-action="call-workspace-attach-lead">
          <p className="text-sm leading-relaxed text-muted-foreground">
            No lead linked for this call
            {sessionPhone ? ` (${formatDisplayPhone(sessionPhone)})` : ""}. Search Growth leads, prospects,
            contacts, and accounts to attach intelligence and lead-linked coaching.
          </p>
          {nativeSessionId && showLeadSearch ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company, contact, email, phone, account"
                  className="pl-9"
                  data-qa-action="call-workspace-lead-search-input"
                />
              </div>
              <CallWorkspaceLeadSearchResultsPanel
                searching={searching}
                searchError={searchError}
                searchResults={searchResults}
                showEmpty={showEmpty}
                attachingId={attachingId}
                autoSelectedLeadId={searchDiagnostics?.autoSelectedLeadId ?? null}
                attachError={attachError}
                createProspectHref={createProspectHref}
                onSelect={(hit) => void selectHit(hit)}
              />
            </>
          ) : null}
          {sessionPhone ? (
            <>
              {showRevenue ? (
                <GrowthCallWorkspaceRevenueIntelligencePanel
                  revenueIntelligence={revenueIntelligence}
                  onRefresh={onRevenueIntelligenceRefresh ?? onRelationshipMemoryRefresh}
                />
              ) : null}
              {showRetention ? (
                <GrowthCallWorkspaceRetentionIntelligencePanel
                  retentionIntelligence={retentionIntelligence}
                  onRefresh={onRetentionIntelligenceRefresh ?? onRevenueIntelligenceRefresh ?? onRelationshipMemoryRefresh}
                />
              ) : null}
              {showMemory ? (
                <GrowthCallWorkspaceRelationshipMemoryPanel
                  relationshipMemory={relationshipMemory}
                  pendingDrafts={pendingDrafts}
                  sessionPhone={sessionPhone}
                  onRefresh={onRelationshipMemoryRefresh}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border/50 p-3 dark:border-white/5">
            <Avatar className="size-11 shrink-0">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {leadInitials(leadContext.contactName, leadContext.companyName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{leadContext.contactName ?? "Contact"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {leadContext.opportunityHealth ?? "Prospect"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{leadContext.companyName}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
              <Link href={buildGrowthLeadHref(leadContext.leadId, { focus: "command" })}>View Lead</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Link href={buildGrowthActivityHref({ leadId: leadContext.leadId })}>Activity</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Link href={buildGrowthMeetingsHref({ leadId: leadContext.leadId })}>Meetings</Link>
            </Button>
          </div>

          <GrowthPersonalizationEmbeddedPanel leadId={leadContext.leadId} surface="call" compact />

          {showRelationshipSummary ? (
            <GrowthCallWorkspaceRelationshipSummaryPanel leadId={leadContext.leadId} />
          ) : null}

          <GrowthCallWorkspaceSequencePanel leadId={leadContext.leadId} />

          <div className="rounded-xl border border-border/50 px-3 dark:border-white/5">
            <IntelligenceRow
              icon={BarChart3}
              label="Deal Intelligence"
              value={
                leadContext.dealCloseProbability != null
                  ? `${leadContext.dealCloseProbability}% close`
                  : "—"
              }
              badgeTone={
                leadContext.dealCloseProbability != null && leadContext.dealCloseProbability >= 60
                  ? "healthy"
                  : "medium"
              }
            />
            <IntelligenceRow
              icon={Briefcase}
              label="Call readiness"
              value={executionReadinessLabel(leadContext.executionReadinessScore)}
              badgeTone={
                leadContext.executionReadinessScore != null && leadContext.executionReadinessScore >= 70
                  ? "healthy"
                  : "medium"
              }
            />
            <IntelligenceRow
              icon={CalendarCheck}
              label="Meeting Outcome"
              value={meetingOutcomeLabel(leadContext.meetingOutcomeScore)}
              badgeTone={
                leadContext.meetingOutcomeScore != null && leadContext.meetingOutcomeScore >= 70
                  ? "healthy"
                  : leadContext.meetingOutcomeScore != null && leadContext.meetingOutcomeScore >= 40
                    ? "attention"
                    : "neutral"
              }
            />
            <IntelligenceRow
              icon={CheckSquare}
              label="Open Tasks"
              value={String(leadContext.openTaskCount)}
              badgeTone={leadContext.openTaskCount > 0 ? "attention" : "neutral"}
            />
            <IntelligenceRow icon={MessageSquare} label="Previous Conversations" value={previousConversationsLabel} />
            <IntelligenceRow
              icon={Sparkles}
              label="Buying Signals"
              value={buyingSignalsLabel}
              badgeTone={buyingSignalCount > 0 ? "healthy" : "neutral"}
            />
          </div>

          {showNextBestAction ? (
            <div className="rounded-xl border border-border/50 p-3 dark:border-white/5">
              <div className="mb-1 flex items-center gap-2">
                <Target className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recommended Next Action
                </p>
              </div>
              <p className="text-sm leading-snug">{recommendedAction}</p>
            </div>
          ) : null}

          {showRevenue ? (
            <GrowthCallWorkspaceRevenueIntelligencePanel
              revenueIntelligence={revenueIntelligence}
              onRefresh={onRevenueIntelligenceRefresh ?? onRelationshipMemoryRefresh}
            />
          ) : null}

          {showRetention ? (
            <GrowthCallWorkspaceRetentionIntelligencePanel
              retentionIntelligence={retentionIntelligence}
              onRefresh={onRetentionIntelligenceRefresh ?? onRevenueIntelligenceRefresh ?? onRelationshipMemoryRefresh}
            />
          ) : null}

          {showMemory ? (
            <GrowthCallWorkspaceRelationshipMemoryPanel
              relationshipMemory={relationshipMemory}
              pendingDrafts={pendingDrafts}
              sessionPhone={sessionPhone}
              contactName={leadContext.contactName}
              leadId={leadContext.leadId}
              onRefresh={onRelationshipMemoryRefresh}
            />
          ) : null}
        </div>
      )}
    </Wrapper>
  )
}
