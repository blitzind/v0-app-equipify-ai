"use client"

import { Bot } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER } from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  growthAvaEmptyAssistUnavailable,
  growthAvaReplyAssistTitle,
} from "@/lib/growth/workspace/growth-workspace-ava-identity"

export function GrowthInboxActionCenterCopilotEmbed() {
  const { teammate } = useAiTeammateIdentity()
  const { copilot, loading } = useGrowthInboxLeadContext()

  return (
    <div className="space-y-2" data-equipify-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}>
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{growthAvaReplyAssistTitle(teammate)}</p>
      </div>
      {loading && !copilot ? (
        <p className="text-xs text-muted-foreground">Loading Ava…</p>
      ) : !copilot ? (
        <p className="text-xs text-muted-foreground">{growthAvaEmptyAssistUnavailable(teammate)}</p>
      ) : (
        <div className="space-y-2 rounded-md border border-border bg-muted/10 p-2 text-xs">
          <GrowthBadge label={copilot.assistedLabel} tone="attention" />
          <p>{copilot.summary}</p>
          <p>
            <span className="font-medium">Next step:</span> {copilot.suggestedNextStep}
          </p>
          <p className="rounded-md bg-muted/40 p-2 text-muted-foreground">{copilot.suggestedReplyDraft}</p>
          <p className="text-[10px] text-muted-foreground">
            Confidence: {copilot.confidenceTier} · {copilot.uncertaintyState}
          </p>
        </div>
      )}
    </div>
  )
}
