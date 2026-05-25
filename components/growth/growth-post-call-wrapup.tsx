"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceSessionPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { NATIVE_CALL_WRAPUP_OUTCOME_LABELS, NATIVE_CALL_WRAPUP_OUTCOMES } from "@/lib/growth/native-dialer/native-dialer-types"

export function GrowthPostCallWrapup({
  session,
  onSubmit,
  submitting,
  embedded,
}: {
  session: NativeCallWorkspaceSessionPublicView
  onSubmit: (input: {
    outcome: NativeCallWrapupOutcome
    objectionCategory?: string | null
    buyingSignals?: string[]
    competitorMentioned?: boolean
    timelineDetected?: boolean
    budgetDetected?: boolean
    championIdentified?: boolean
    decisionMakerPresent?: boolean
    notes?: string
  }) => Promise<NativeCallWrapupPublicView | null>
  submitting?: boolean
  embedded?: boolean
}) {
  const [outcome, setOutcome] = useState<NativeCallWrapupOutcome>("connected")
  const [objectionCategory, setObjectionCategory] = useState("")
  const [buyingSignals, setBuyingSignals] = useState("")
  const [competitorMentioned, setCompetitorMentioned] = useState(false)
  const [timelineDetected, setTimelineDetected] = useState(false)
  const [budgetDetected, setBudgetDetected] = useState(false)
  const [championIdentified, setChampionIdentified] = useState(false)
  const [decisionMakerPresent, setDecisionMakerPresent] = useState(false)
  const [notes, setNotes] = useState("")
  const [saved, setSaved] = useState<NativeCallWrapupPublicView | null>(null)

  async function handleSubmit() {
    const result = await onSubmit({
      outcome,
      objectionCategory: objectionCategory.trim() || null,
      buyingSignals: buyingSignals
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      competitorMentioned,
      timelineDetected,
      budgetDetected,
      championIdentified,
      decisionMakerPresent,
      notes,
    })
    if (result) setSaved(result)
  }

  if (saved) {
    const savedContent = (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
        <div className="space-y-2">
          <p className="text-sm font-medium">{NATIVE_CALL_WRAPUP_OUTCOME_LABELS[saved.outcome]}</p>
          {saved.suggestedNextActions.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {saved.suggestedNextActions.map((action) => (
                <li key={action}>• {action}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    )

    if (embedded) return <div className="flex flex-1 flex-col overflow-auto">{savedContent}</div>

    return (
      <GrowthEngineCard title="Wrap-up saved" subtitle="Operator confirmed — no autonomous CRM movement">
        {savedContent}
      </GrowthEngineCard>
    )
  }

  const formContent = (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {session.companyName ?? "Lead"} · {session.phoneNumber}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {NATIVE_CALL_WRAPUP_OUTCOMES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={outcome === value ? "default" : "outline"}
            onClick={() => setOutcome(value)}
          >
            {NATIVE_CALL_WRAPUP_OUTCOME_LABELS[value]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Objection category"
          value={objectionCategory}
          onChange={(e) => setObjectionCategory(e.target.value)}
        />
        <Input
          placeholder="Buying signals (comma separated)"
          value={buyingSignals}
          onChange={(e) => setBuyingSignals(e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["competitorMentioned", "Competitor", competitorMentioned, setCompetitorMentioned],
          ["timelineDetected", "Timeline", timelineDetected, setTimelineDetected],
          ["budgetDetected", "Budget", budgetDetected, setBudgetDetected],
          ["championIdentified", "Champion", championIdentified, setChampionIdentified],
          ["decisionMakerPresent", "Decision maker", decisionMakerPresent, setDecisionMakerPresent],
        ].map(([key, label, active, setter]) => (
          <Button
            key={key as string}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => (setter as (value: boolean) => void)(!active)}
          >
            {label as string}
          </Button>
        ))}
      </div>

      <Textarea className="mt-3" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GrowthBadge label="Operator required" tone="attention" />
        <GrowthBadge label="No auto CRM" tone="neutral" />
        <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? "Saving…" : "Confirm wrap-up"}
        </Button>
      </div>
    </>
  )

  if (embedded) return <div className="flex flex-1 flex-col overflow-auto">{formContent}</div>

  return (
    <GrowthEngineCard
      title="Post-call wrap-up"
      subtitle="Required operator confirmation — recommendations only, no autonomous actions"
    >
      {formContent}
    </GrowthEngineCard>
  )
}
