"use client"

import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthCallWorkspaceIntelligenceRail } from "@/components/growth/growth-call-workspace-intelligence-rail"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_CALL_WORKSPACE_PANEL } from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import { isPanelVisible } from "@/lib/voice/workspace-context/panel-prioritization"
import { growthBadgeToneForPriority, priorityLabel } from "@/lib/voice/workspace-context/visual-priority"
import type { VoiceWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/types"
import { VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER } from "@/lib/voice/workspace-context/types"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import type {
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceUnifiedContextRail({
  workspaceContext,
  expanded,
  onToggleExpanded,
  deepIntelligenceExpanded,
  onToggleDeepIntelligence,
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
  workspaceContext: VoiceWorkspaceContextSnapshot
  expanded: boolean
  onToggleExpanded: () => void
  deepIntelligenceExpanded: boolean
  onToggleDeepIntelligence: () => void
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
  const showDeepPanels =
    deepIntelligenceExpanded ||
    isPanelVisible(workspaceContext.panels, "revenue_intelligence") ||
    isPanelVisible(workspaceContext.panels, "retention_intelligence") ||
    isPanelVisible(workspaceContext.panels, "relationship_memory")

  return (
    <section
      className={cn(GROWTH_CALL_WORKSPACE_PANEL, "w-full max-w-[320px] p-4 lg:justify-self-end")}
      data-voice-unified-operator-workspace-ux-qa-marker={VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER}
      data-workspace-mode={workspaceContext.mode}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Relationship Context</h3>
            <GrowthBadge
              label={workspaceContext.modeLabel}
              tone={growthBadgeToneForPriority(workspaceContext.visualPriority)}
            />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{workspaceContext.focusSummary}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2"
          onClick={onToggleExpanded}
          data-qa-action="call-workspace-context-rail-toggle"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {workspaceContext.nextBestAction ? (
        <div className="mb-3 rounded-xl border border-border/50 bg-muted/20 p-3 dark:border-white/5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next action</p>
          <p className="mt-1 text-sm leading-snug">{workspaceContext.nextBestAction}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Priority: {priorityLabel(workspaceContext.visualPriority)}
          </p>
        </div>
      ) : null}

      {expanded ? (
        <GrowthCallWorkspaceIntelligenceRail
          embedded
          workspaceContext={workspaceContext}
          showDeepIntelligence={showDeepPanels}
          leadContext={leadContext}
          nativeSessionId={nativeSessionId}
          sessionPhone={sessionPhone}
          operatorAssist={operatorAssist}
          relationshipMemory={relationshipMemory}
          revenueIntelligence={revenueIntelligence}
          retentionIntelligence={retentionIntelligence}
          onRelationshipMemoryRefresh={onRelationshipMemoryRefresh}
          onRevenueIntelligenceRefresh={onRevenueIntelligenceRefresh}
          onRetentionIntelligenceRefresh={onRetentionIntelligenceRefresh}
          onLeadAttached={onLeadAttached}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Context collapsed — expand when you need relationship intelligence during active workflows.
        </p>
      )}

      {expanded && workspaceContext.deferredAnalytics ? (
        <div className="mt-3 border-t border-border/50 pt-3 dark:border-white/5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs"
            onClick={onToggleDeepIntelligence}
            data-qa-action="call-workspace-deep-intelligence-toggle"
          >
            {showDeepPanels ? "Hide deep intelligence" : "Show deep intelligence"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
