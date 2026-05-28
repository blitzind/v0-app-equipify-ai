"use client"

import { AlertTriangle, Brain, ShieldAlert, Sparkles, Target } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/types"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"
import { cn } from "@/lib/utils"

function IntelligenceSection({
  title,
  icon: Icon,
  events,
  emptyLabel,
  tone = "neutral",
}: {
  title: string
  icon: typeof Brain
  events: VoiceCallConversationIntelligenceSnapshot["objections"]
  emptyLabel: string
  tone?: "neutral" | "attention" | "critical" | "healthy"
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/80 p-3 dark:border-white/5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <GrowthBadge label={String(events.length)} tone={tone === "neutral" ? "neutral" : tone} />
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(-4).map((event) => (
            <li key={event.id} className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium capitalize">{event.eventType.replace(/_/g, " ")}</span>
                <GrowthBadge label={`${Math.round(event.confidenceScore * 100)}%`} tone="neutral" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Evidence: “{event.evidenceText}”</p>
              {event.suggestedOperatorAction ? (
                <p className="mt-1 text-xs text-foreground">{event.suggestedOperatorAction}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function GrowthCallWorkspaceConversationIntelligencePanel({
  intelligence,
}: {
  intelligence: VoiceCallConversationIntelligenceSnapshot | null
}) {
  if (!intelligence) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center"
        data-qa-marker={VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER}
      >
        <Brain className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Live conversation intelligence</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Passive insights appear here once transcript segments are analyzed. AI does not speak or act autonomously.
        </p>
      </div>
    )
  }

  const nextBest = intelligence.suggestedNextBestAction

  return (
    <div
      className="space-y-3"
      data-qa-marker={VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER}
      data-voice-conversation-intelligence-qa-marker={VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER}
    >
      <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-2 dark:border-violet-900/40 dark:bg-violet-950/20">
        <div className="flex flex-wrap items-center gap-2">
          <Brain className="size-4 text-violet-700 dark:text-violet-300" />
          <p className="text-sm font-semibold">Passive conversation intelligence</p>
          <GrowthBadge label="Operator assist only" tone="neutral" />
          <GrowthBadge label={intelligence.analysisProvider.replace(/_/g, " ")} tone="neutral" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Evidence-backed insights only. Autonomous actions remain disabled.
        </p>
      </div>

      {nextBest ? (
        <section className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="mb-1 flex items-center gap-2">
            <Target className="size-4 text-emerald-700 dark:text-emerald-300" />
            <h3 className="text-sm font-semibold">Suggested next best action</h3>
          </div>
          <p className="text-xs text-muted-foreground">Evidence: “{nextBest.evidenceText}”</p>
          <p className="mt-1 text-sm">{nextBest.suggestedOperatorAction}</p>
        </section>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <IntelligenceSection
          title="Live signals"
          icon={Sparkles}
          events={intelligence.liveSignals}
          emptyLabel="No live signals detected yet."
          tone="healthy"
        />
        <IntelligenceSection
          title="Objections"
          icon={AlertTriangle}
          events={intelligence.objections}
          emptyLabel="No objections detected yet."
          tone="attention"
        />
        <IntelligenceSection
          title="Buying signals"
          icon={Target}
          events={intelligence.buyingSignals}
          emptyLabel="No buying signals detected yet."
          tone="healthy"
        />
        <IntelligenceSection
          title="Risk / compliance"
          icon={ShieldAlert}
          events={intelligence.riskEvents}
          emptyLabel="No risk markers detected yet."
          tone="critical"
        />
      </div>

      <IntelligenceSection
        title="Operator guidance"
        icon={Brain}
        events={intelligence.operatorGuidance}
        emptyLabel="Guidance will appear when transcript evidence supports it."
      />

      {intelligence.memoryDrafts.length > 0 ? (
        <section className="rounded-xl border border-border/60 bg-card/80 p-3">
          <h3 className="text-sm font-semibold">Conversation memory drafts (pending review)</h3>
          <ul className="mt-2 space-y-2">
            {intelligence.memoryDrafts.map((draft) => (
              <li
                key={draft.id}
                className={cn("rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs")}
              >
                <p className="font-medium">
                  {draft.draftLabel}: {draft.draftValue}
                </p>
                <p className="mt-1 text-muted-foreground">Evidence: “{draft.evidenceText}”</p>
                <p className="mt-1 text-muted-foreground">Not merged into CRM automatically.</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
