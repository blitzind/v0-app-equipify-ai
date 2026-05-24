"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  GROWTH_SEQUENCE_TEST_PATTERN_KEYS,
  mapPreflightCodeToMessage,
  type SequenceStartAvailability,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-ui"
import type { GrowthSequencePattern, GrowthSequenceRecommendedNextStep } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthSequenceIntelligenceProps = {
  lead: GrowthLead
}

type SequenceDrawerPayload = {
  enrollment?: GrowthSequenceEnrollmentWithSteps | null
  sequence?: {
    recommendedPatternId: string | null
    recommendedReason: string | null
    recommendedConfidence: number | null
    activeEnrollmentId: string | null
    fatigueRisk: string | null
    computedAt: string | null
  }
  startAvailability?: SequenceStartAvailability
  recommendedPreflight?: { allowed: boolean; code?: string; reason?: string }
  testPreflight?: { allowed: boolean; code?: string; reason?: string } | null
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

function SequenceCacheSummary({ lead, sequence }: { lead: GrowthLead; sequence?: SequenceDrawerPayload["sequence"] }) {
  const patternId = sequence?.recommendedPatternId ?? lead.recommendedSequencePatternId
  const reason = sequence?.recommendedReason ?? lead.recommendedSequenceReason
  const confidence = sequence?.recommendedConfidence ?? lead.recommendedSequenceConfidence
  const fatigue = sequence?.fatigueRisk ?? lead.sequenceFatigueRisk
  const activeEnrollmentId = sequence?.activeEnrollmentId ?? lead.activeSequenceEnrollmentId

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Metric label="Recommended pattern" value={patternId ? `${patternId.slice(0, 8)}…` : "—"} />
      <Metric label="Confidence" value={confidence ?? "—"} />
      <Metric label="Fatigue risk" value={fatigue ?? "—"} />
      <Metric label="Active enrollment" value={activeEnrollmentId ? `${activeEnrollmentId.slice(0, 8)}…` : "None"} />
      {reason ? (
        <div className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
          <p className="text-muted-foreground">Recommendation reason</p>
          <p className="font-medium">{reason}</p>
        </div>
      ) : null}
    </div>
  )
}

export function GrowthSequenceIntelligence({ lead }: GrowthSequenceIntelligenceProps) {
  const [patterns, setPatterns] = useState<GrowthSequencePattern[]>([])
  const [enrollment, setEnrollment] = useState<GrowthSequenceEnrollmentWithSteps | null>(null)
  const [startAvailability, setStartAvailability] = useState<SequenceStartAvailability | null>(null)
  const [sequenceMeta, setSequenceMeta] = useState<SequenceDrawerPayload["sequence"]>()
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pauseReason, setPauseReason] = useState("")
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [selectedTestPatternId, setSelectedTestPatternId] = useState<string | null>(null)
  const [testPreflight, setTestPreflight] = useState<{ allowed: boolean; code?: string; reason?: string } | null>(null)
  const [loadingTestPreflight, setLoadingTestPreflight] = useState(false)

  const recommendedPattern = useMemo(
    () => patterns.find((entry) => entry.id === (sequenceMeta?.recommendedPatternId ?? lead.recommendedSequencePatternId)) ?? null,
    [patterns, sequenceMeta?.recommendedPatternId, lead.recommendedSequencePatternId],
  )

  const testPatterns = useMemo(
    () =>
      GROWTH_SEQUENCE_TEST_PATTERN_KEYS.map((key) => patterns.find((entry) => entry.key === key)).filter(
        (entry): entry is GrowthSequencePattern => entry != null,
      ),
    [patterns],
  )

  const loadPatterns = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { patterns?: GrowthSequencePattern[] }
      setPatterns(data.patterns ?? [])
    } catch {
      setPatterns([])
    }
  }, [])

  const loadDrawerState = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/sequence-enrollments`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & SequenceDrawerPayload
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load sequence state.")
      setEnrollment(data.enrollment ?? null)
      setStartAvailability(data.startAvailability ?? null)
      setSequenceMeta(data.sequence)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void loadPatterns()
  }, [loadPatterns])

  useEffect(() => {
    void loadDrawerState()
  }, [loadDrawerState])

  useEffect(() => {
    if (!testDialogOpen || !selectedTestPatternId) {
      setTestPreflight(null)
      return
    }

    let cancelled = false
    setLoadingTestPreflight(true)
    void fetch(
      `/api/platform/growth/leads/${lead.id}/sequence-enrollments?preflightPatternId=${encodeURIComponent(selectedTestPatternId)}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data: SequenceDrawerPayload & { ok?: boolean }) => {
        if (cancelled) return
        setTestPreflight(data.testPreflight ?? null)
      })
      .catch(() => {
        if (!cancelled) setTestPreflight(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingTestPreflight(false)
      })

    return () => {
      cancelled = true
    }
  }, [testDialogOpen, selectedTestPatternId, lead.id])

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
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Action failed.")
      }
      if (data.enrollment) setEnrollment(data.enrollment)
      await loadDrawerState()
      setTestDialogOpen(false)
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
      else await loadDrawerState()
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

  const canStartRecommended = startAvailability?.canStart === true && !enrollment
  const unavailableMessage = startAvailability?.canStart === false ? startAvailability.message : null
  const hasRecommendation = Boolean(sequenceMeta?.recommendedPatternId ?? lead.recommendedSequencePatternId)

  const collapsedSummary = enrollment
    ? `${enrollment.status} · health ${enrollment.enrollmentHealthScore}${enrollment.enrollmentStalled ? " · stalled" : ""}`
    : [
        recommendedPattern?.label ?? null,
        (sequenceMeta?.recommendedConfidence ?? lead.recommendedSequenceConfidence) != null
          ? `${sequenceMeta?.recommendedConfidence ?? lead.recommendedSequenceConfidence}`
          : null,
        sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk ?? null,
      ]
        .filter(Boolean)
        .join(" · ")

  return (
    <>
      <GrowthCollapsibleEngineCard
        title="Sequence Intelligence"
        icon={<GitBranch className="size-4" />}
        headerAside={collapsedSummary || unavailableMessage || "Sequence execution"}
        headerTrailing={actionRequired ? <GrowthActionRequiredBadge /> : null}
        defaultOpen={false}
        persistKey={GROWTH_DRAWER_CARD_KEYS.sequence}
      >
        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading sequence intelligence…
            </div>
          ) : enrollment ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{enrollment.patternLabel ?? recommendedPattern?.label ?? "Sequence enrollment"}</span>
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
                      onClick={() =>
                        void postEnrollment(`/sequence-enrollments/${enrollment.id}/cancel`, {
                          reason: "Cancelled from drawer",
                        })
                      }
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
                      onClick={() =>
                        void postEnrollment(`/sequence-enrollments/${enrollment.id}/cancel`, {
                          reason: "Cancelled from drawer",
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>

              {currentStep && ["draft_created", "queued"].includes(currentStep.status) ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {currentStep.status === "draft_created" && currentStep.channel === "email" ? (
                    <Button size="sm" disabled={acting !== null} onClick={() => void postStep(currentStep.id, "queue")}>
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
              <SequenceCacheSummary lead={lead} sequence={sequenceMeta} />

              {recommendedPattern ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{recommendedPattern.label}</span>
                  <GrowthBadge label={`v${recommendedPattern.sequenceVersion}`} tone="neutral" />
                  {(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk) ? (
                    <GrowthBadge
                      label={`fatigue ${sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk}`}
                      tone={(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk) === "high" ? "warning" : "neutral"}
                    />
                  ) : null}
                </div>
              ) : hasRecommendation ? (
                <p className="text-sm text-muted-foreground">
                  Recommended pattern id is cached but catalog label is still loading or unavailable.
                </p>
              ) : null}

              {(sequenceMeta?.recommendedReason ?? lead.recommendedSequenceReason) ? (
                <p className="text-sm text-muted-foreground">
                  {sequenceMeta?.recommendedReason ?? lead.recommendedSequenceReason}
                </p>
              ) : null}

              {unavailableMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {unavailableMessage}
                </div>
              ) : null}

              {!hasRecommendation ? (
                <p className="text-sm text-muted-foreground">
                  Generate outreach activity or use Test Sequence.
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

              <div className="flex flex-wrap gap-2">
                {canStartRecommended && (sequenceMeta?.recommendedPatternId ?? lead.recommendedSequencePatternId) ? (
                  <Button
                    size="sm"
                    disabled={acting !== null}
                    onClick={() =>
                      void postEnrollment("/sequence-enrollments", {
                        patternId: sequenceMeta?.recommendedPatternId ?? lead.recommendedSequencePatternId,
                      })
                    }
                  >
                    Start Recommended Sequence
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting !== null || testPatterns.length === 0}
                  onClick={() => {
                    setSelectedTestPatternId(testPatterns[0]?.id ?? null)
                    setTestDialogOpen(true)
                  }}
                >
                  Create Test Sequence
                </Button>
              </div>

              {recommendedPattern ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Metric label="Quality score" value={recommendedPattern.sequenceQualityScore} />
                  <Metric label="Positive reply rate" value={`${Math.round(recommendedPattern.positiveReplyRate * 100)}%`} />
                  <Metric label="Abandonment rate" value={`${Math.round(recommendedPattern.sequenceAbandonmentRate * 100)}%`} />
                  <Metric label="Opp lift" value={recommendedPattern.opportunityLift.toFixed(1)} />
                  <Metric label="Rev lift" value={recommendedPattern.revenueProbabilityLift.toFixed(1)} />
                  <Metric label="Conversation lift" value={recommendedPattern.conversationHealthLift.toFixed(1)} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </GrowthCollapsibleEngineCard>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Test Sequence</DialogTitle>
            <DialogDescription>
              Platform-admin test mode. Creates a draft enrollment only — no auto execute.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {testPatterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No seeded catalog patterns available.</p>
            ) : (
              testPatterns.map((pattern) => {
                const selected = selectedTestPatternId === pattern.id
                return (
                  <button
                    key={pattern.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selected ? "border-emerald-400 bg-emerald-50" : "border-border hover:bg-muted/40"
                    }`}
                    onClick={() => setSelectedTestPatternId(pattern.id)}
                  >
                    <p className="font-medium">{pattern.label}</p>
                    <p className="text-muted-foreground">{pattern.key.replace(/_/g, " ")}</p>
                  </button>
                )
              })
            )}
          </div>

          {loadingTestPreflight ? (
            <p className="text-sm text-muted-foreground">Checking preflight…</p>
          ) : testPreflight && !testPreflight.allowed ? (
            <p className="text-sm text-amber-800">
              {mapPreflightCodeToMessage(testPreflight.code ?? "preflight_blocked", testPreflight.reason)}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                acting !== null ||
                !selectedTestPatternId ||
                loadingTestPreflight ||
                testPreflight?.allowed === false
              }
              onClick={() => void postEnrollment("/sequence-enrollments", { patternId: selectedTestPatternId })}
            >
              Create draft enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
