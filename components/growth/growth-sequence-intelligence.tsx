"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GrowthBadge,
  GrowthActionRequiredBadge,
  GrowthCollapsibleEngineCard,
} from "@/components/growth/growth-ui-utils"
import { growthLeadSequenceActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type {
  GrowthSequenceEnrollmentStep,
  GrowthSequenceEnrollmentWithSteps,
} from "@/lib/growth/sequence-enrollment-types"
import type { GrowthSequencePattern, GrowthSequenceRecommendedNextStep } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthSequenceIntelligenceProps = {
  lead: GrowthLead
}

function isNextStep(value: GrowthLead["recommendedSequenceNextStep"]): value is GrowthSequenceRecommendedNextStep {
  return typeof value === "object" && value != null && "stepOrder" in value
}

function stepStatusTone(status: GrowthSequenceEnrollmentStep["status"]): "healthy" | "attention" | "warning" | "neutral" {
  if (status === "executed") return "healthy"
  if (status === "failed") return "warning"
  if (status === "queued" || status === "draft_created" || status === "approved") return "attention"
  return "neutral"
}

function StepProgress({ steps, currentStepOrder }: { steps: GrowthSequenceEnrollmentStep[]; currentStepOrder: number }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const isCurrent = step.stepOrder === currentStepOrder + 1
        return (
          <li
            key={step.id}
            className={`rounded-lg border px-3 py-2 text-sm ${isCurrent ? "border-emerald-300 bg-emerald-50/50" : "border-border"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium capitalize">
                Step {step.stepOrder}: {step.channel.replace(/_/g, " ")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={step.status.replace(/_/g, " ")} tone={stepStatusTone(step.status)} />
                <span className="text-xs tabular-nums text-muted-foreground">conf {step.stepExecutionConfidence}</span>
              </div>
            </div>
            {step.scheduledFor ? (
              <p className="text-xs text-muted-foreground">Scheduled {new Date(step.scheduledFor).toLocaleString()}</p>
            ) : null}
            {step.failureReason ? <p className="text-xs text-destructive">{step.failureReason}</p> : null}
          </li>
        )
      })}
    </ol>
  )
}

export function GrowthSequenceIntelligence({ lead }: GrowthSequenceIntelligenceProps) {
  const [pattern, setPattern] = useState<GrowthSequencePattern | null>(null)
  const [enrollment, setEnrollment] = useState<GrowthSequenceEnrollmentWithSteps | null>(null)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pauseReason, setPauseReason] = useState("")

  const loadEnrollment = useCallback(async () => {
    setLoadingEnrollment(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/sequence-enrollments`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        enrollment?: GrowthSequenceEnrollmentWithSteps | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load enrollment.")
      setEnrollment(data.enrollment ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoadingEnrollment(false)
    }
  }, [lead.id])

  useEffect(() => {
    if (!lead.recommendedSequencePatternId) {
      setPattern(null)
      return
    }
    void fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { patterns?: GrowthSequencePattern[] }) => {
        const match = data.patterns?.find((entry) => entry.id === lead.recommendedSequencePatternId) ?? null
        setPattern(match)
      })
      .catch(() => setPattern(null))
  }, [lead.recommendedSequencePatternId])

  useEffect(() => {
    void loadEnrollment()
  }, [loadEnrollment])

  async function postEnrollment(path: string, body?: Record<string, unknown>) {
    setActing(path)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        enrollment?: GrowthSequenceEnrollmentWithSteps
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Action failed.")
      if (data.enrollment) setEnrollment(data.enrollment)
      else await loadEnrollment()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  async function postStep(stepId: string, action: "queue" | "complete" | "skip") {
    setActing(`${action}-${stepId}`)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/sequence-enrollment-steps/${stepId}/${action}`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        enrollment?: GrowthSequenceEnrollmentWithSteps
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Step action failed.")
      if (data.enrollment) setEnrollment(data.enrollment)
      else await loadEnrollment()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step action failed.")
    } finally {
      setActing(null)
    }
  }

  const nextStep = isNextStep(lead.recommendedSequenceNextStep) ? lead.recommendedSequenceNextStep : null
  const currentStep = enrollment?.steps.find((step) => step.stepOrder === (enrollment.currentStepOrder ?? 0) + 1) ?? null
  const actionRequired =
    growthLeadSequenceActionRequired(lead) ||
    enrollment?.enrollmentStalled === true ||
    enrollment?.status === "draft"

  const collapsedSummary = enrollment
    ? `${enrollment.status} · health ${enrollment.enrollmentHealthScore}${enrollment.enrollmentStalled ? " · stalled" : ""}`
    : [pattern?.label ?? null, lead.recommendedSequenceConfidence != null ? `${lead.recommendedSequenceConfidence}` : null, lead.sequenceFatigueRisk ?? null]
        .filter(Boolean)
        .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      title="Sequence Intelligence"
      icon={<GitBranch className="size-4" />}
      headerAside={collapsedSummary || "No sequence recommendation"}
      headerTrailing={actionRequired ? <GrowthActionRequiredBadge /> : null}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.sequence}
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loadingEnrollment ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading enrollment…
          </div>
        ) : enrollment ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{enrollment.patternLabel ?? "Sequence enrollment"}</span>
              <GrowthBadge label={enrollment.status} tone={enrollment.status === "active" ? "healthy" : "neutral"} />
              {enrollment.enrollmentStalled ? <GrowthBadge label="stalled" tone="warning" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Health {enrollment.enrollmentHealthScore} · step {enrollment.currentStepOrder}
              {enrollment.pauseReason ? ` · paused: ${enrollment.pauseReason}` : ""}
            </p>

            <StepProgress steps={enrollment.steps} currentStepOrder={enrollment.currentStepOrder} />

            <div className="flex flex-wrap gap-2">
              {enrollment.status === "draft" ? (
                <Button
                  size="sm"
                  disabled={acting !== null}
                  onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/confirm`)}
                >
                  Confirm enrollment
                </Button>
              ) : null}
              {enrollment.status === "active" ? (
                <>
                  <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
                    <Input
                      placeholder="Pause reason"
                      value={pauseReason}
                      onChange={(e) => setPauseReason(e.target.value)}
                      className="h-8 max-w-[200px] text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting !== null || !pauseReason.trim()}
                      onClick={() =>
                        void postEnrollment(`/sequence-enrollments/${enrollment.id}/pause`, {
                          pauseReason: pauseReason.trim(),
                        })
                      }
                    >
                      Pause
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting !== null}
                    onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/cancel`, { reason: "Cancelled from drawer" })}
                  >
                    Cancel
                  </Button>
                </>
              ) : null}
              {enrollment.status === "paused" ? (
                <>
                  <Button
                    size="sm"
                    disabled={acting !== null}
                    onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/resume`)}
                  >
                    Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting !== null}
                    onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/cancel`, { reason: "Cancelled from drawer" })}
                  >
                    Cancel
                  </Button>
                </>
              ) : null}
            </div>

            {currentStep && ["draft_created", "queued"].includes(currentStep.status) ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {currentStep.status === "draft_created" && currentStep.channel === "email" ? (
                  <Button
                    size="sm"
                    disabled={acting !== null}
                    onClick={() => void postStep(currentStep.id, "queue")}
                  >
                    Queue email step
                  </Button>
                ) : null}
                {currentStep.channel !== "email" ? (
                  <>
                    <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void postStep(currentStep.id, "complete")}>
                      Mark complete
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void postStep(currentStep.id, "skip")}>
                      Skip step
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {pattern ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{pattern.label}</span>
                <GrowthBadge label={`v${pattern.sequenceVersion}`} tone="neutral" />
                {lead.sequenceFatigueRisk ? (
                  <GrowthBadge label={`fatigue ${lead.sequenceFatigueRisk}`} tone="warning" />
                ) : null}
              </div>
            ) : null}

            {lead.recommendedSequenceReason ? (
              <p className="text-sm text-muted-foreground">{lead.recommendedSequenceReason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No recommended sequence for this lead yet.</p>
            )}

            {lead.recommendedSequenceConfidence != null ? (
              <p className="text-sm">
                Confidence: <span className="font-semibold tabular-nums">{lead.recommendedSequenceConfidence}</span>
              </p>
            ) : null}

            {nextStep ? (
              <div className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-muted-foreground">Next step</p>
                <p className="font-medium capitalize">
                  {nextStep.channel.replace(/_/g, " ")}
                  {nextStep.generationType ? ` · ${nextStep.generationType.replace(/_/g, " ")}` : ""}
                </p>
                <p className="text-muted-foreground">
                  Delay {nextStep.delayDays}d · expect {nextStep.expectedSignal.replace(/_/g, " ")}
                  {nextStep.requiredHumanApproval ? " · approval required" : ""}
                </p>
              </div>
            ) : null}

            {pattern && lead.recommendedSequencePatternId ? (
              <Button
                size="sm"
                disabled={acting !== null || lead.sequenceFatigueRisk === "high"}
                onClick={() =>
                  void postEnrollment("/sequence-enrollments", { patternId: lead.recommendedSequencePatternId })
                }
              >
                Start recommended sequence
              </Button>
            ) : null}

            {pattern ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Metric label="Quality score" value={pattern.sequenceQualityScore} />
                <Metric label="Positive reply rate" value={`${Math.round(pattern.positiveReplyRate * 100)}%`} />
                <Metric label="Abandonment rate" value={`${Math.round(pattern.sequenceAbandonmentRate * 100)}%`} />
                <Metric label="Opp lift" value={pattern.opportunityLift.toFixed(1)} />
                <Metric label="Rev lift" value={pattern.revenueProbabilityLift.toFixed(1)} />
                <Metric label="Conversation lift" value={pattern.conversationHealthLift.toFixed(1)} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}
