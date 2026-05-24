"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock3, GitBranch, Loader2 } from "lucide-react"
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
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type {
  GrowthSequenceEnrollmentStep,
  GrowthSequenceEnrollmentWithSteps,
} from "@/lib/growth/sequence-enrollment-types"
import {
  GROWTH_SEQUENCE_TEST_PATTERN_KEYS,
  buildSequenceProgressStages,
  enrollmentStatusTone,
  formatEnrollmentCollapsedSummary,
  formatEnrollmentCurrentStepLabel,
  formatEnrollmentDisplayConfidence,
  formatEnrollmentNextAction,
  formatEnrollmentStatusLabel,
  formatHumanPhrase,
  formatRecommendedNextStepLabel,
  formatSequenceFatigueLabel,
  formatSequenceFatigueTone,
  formatSequencePatternTitle,
  formatSequencePatternTitleFromPattern,
  formatSequenceChannelLabel,
  formatSequenceScheduledFor,
  formatSequenceUserMessage,
  formatStepStatusLabel,
  formatStepStatusMeta,
  getEnrollmentCurrentStep,
  getSequenceProgressStageKey,
  growthSequenceEnrollmentActionRequired,
  mapPreflightCodeToMessage,
  stepStatusTone,
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

function SequenceProgressBar({ enrollment }: { enrollment: GrowthSequenceEnrollmentWithSteps }) {
  const stages = buildSequenceProgressStages(enrollment)
  const activeKey = getSequenceProgressStageKey(enrollment)

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1.5 text-xs">
        {stages.map((stage, index) => {
          const isActive = stage.key === activeKey
          const isPast = stages.findIndex((entry) => entry.key === activeKey) > index
          return (
            <div key={stage.key} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-muted-foreground">→</span> : null}
              <span
                className={`rounded-full border px-2.5 py-1 font-medium ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : isPast
                      ? "border-border bg-muted/30 text-foreground"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EnrollmentHeader({
  enrollment,
  patternTitle,
  currentStep,
}: {
  enrollment: GrowthSequenceEnrollmentWithSteps
  patternTitle: string
  currentStep: GrowthSequenceEnrollmentStep | null
}) {
  const currentStepLabel = formatEnrollmentCurrentStepLabel(enrollment)
  const nextAction = formatEnrollmentNextAction(enrollment, currentStep)
  const confidence = formatEnrollmentDisplayConfidence(enrollment, currentStep)
  const awaitingConfirmation = enrollment.status === "draft" || currentStepLabel === "Awaiting Confirmation"

  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{patternTitle}</p>

      <div className="flex flex-wrap items-center gap-2">
        <GrowthBadge
          label={formatEnrollmentStatusLabel(enrollment.status)}
          tone={enrollment.status === "draft" ? "neutral" : enrollmentStatusTone(enrollment.status)}
        />
        <span className="text-sm text-muted-foreground">
          Health <span className="font-semibold tabular-nums text-foreground">{enrollment.enrollmentHealthScore}</span>
        </span>
        {confidence != null ? (
          <span className="text-sm text-muted-foreground">
            Confidence <span className="font-semibold tabular-nums text-foreground">{confidence}%</span>
          </span>
        ) : null}
        {enrollment.enrollmentStalled ? <GrowthBadge label="Execution stalled" tone="warning" /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border px-3 py-2 text-sm">
          <p className="text-muted-foreground">Current Step</p>
          {awaitingConfirmation ? (
            <p className="mt-1 flex items-center gap-2 font-medium">
              <Clock3 className="size-4 text-muted-foreground" />
              Awaiting Confirmation
            </p>
          ) : (
            <p className="mt-1 font-medium">{currentStepLabel}</p>
          )}
        </div>
        {nextAction ? (
          <div className="rounded-lg border border-border px-3 py-2 text-sm">
            <p className="text-muted-foreground">Next Action</p>
            <p className="mt-1 font-medium">{nextAction}</p>
          </div>
        ) : null}
      </div>

      {enrollment.status === "draft" ? (
        <p className="text-sm text-muted-foreground">
          Confirm enrollment to create guided execution steps.
        </p>
      ) : null}

      {enrollment.pauseReason ? (
        <p className="text-sm text-muted-foreground">Pause reason: {enrollment.pauseReason}</p>
      ) : null}
    </div>
  )
}

function StepProgress({
  steps,
  currentStepOrder,
}: {
  steps: GrowthSequenceEnrollmentStep[]
  currentStepOrder: number
}) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const isCurrent = step.stepOrder === currentStepOrder + 1
        return (
          <li
            key={step.id}
            className={`rounded-lg border px-3 py-2 text-sm ${isCurrent ? "border-emerald-300 bg-emerald-50/50" : "border-border"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-medium">{formatSequenceChannelLabel(step.channel)}</p>
                <p className="text-xs text-muted-foreground">{formatStepStatusMeta(step)}</p>
                {step.scheduledFor ? (
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {formatSequenceScheduledFor(step.scheduledFor)}
                  </p>
                ) : null}
                {step.failureReason ? <p className="text-xs text-destructive">{step.failureReason}</p> : null}
              </div>
              <GrowthBadge label={formatStepStatusLabel(step.status)} tone={stepStatusTone(step.status)} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SequenceRecommendationSummary({
  lead,
  sequence,
  pattern,
  hasEnrollment,
}: {
  lead: GrowthLead
  sequence?: SequenceDrawerPayload["sequence"]
  pattern: GrowthSequencePattern | null
  hasEnrollment: boolean
}) {
  const confidence = sequence?.recommendedConfidence ?? lead.recommendedSequenceConfidence
  const fatigue = sequence?.fatigueRisk ?? lead.sequenceFatigueRisk
  const reason = sequence?.recommendedReason ?? lead.recommendedSequenceReason

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Metric label="Recommended sequence" value={pattern ? formatSequencePatternTitleFromPattern(pattern) : "Not available yet"} />
      <Metric label="Confidence" value={confidence ?? "—"} />
      <Metric label="Fatigue" value={formatSequenceFatigueLabel(fatigue)} />
      <Metric label="Enrollment" value={hasEnrollment ? "In progress" : "None"} />
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string } & SequenceDrawerPayload
      if (!res.ok || !data.ok) {
        throw new Error(formatSequenceUserMessage({ code: data.error, message: data.message, fallback: "Could not load sequence state." }))
      }
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
        throw new Error(formatSequenceUserMessage({ code: data.error, message: data.message, fallback: "Action failed." }))
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
      if (!res.ok || !data.ok) {
        throw new Error(formatSequenceUserMessage({ code: data.error, message: data.message, fallback: "Step action failed." }))
      }
      if (data.enrollment) setEnrollment(data.enrollment)
      else await loadDrawerState()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step action failed.")
    } finally {
      setActing(null)
    }
  }

  const nextStep = isNextStep(lead.recommendedSequenceNextStep) ? lead.recommendedSequenceNextStep : null
  const currentStep = enrollment ? getEnrollmentCurrentStep(enrollment) : null
  const actionRequired = growthSequenceEnrollmentActionRequired(enrollment)
  const canStartRecommended = startAvailability?.canStart === true && !enrollment
  const unavailableMessage =
    startAvailability?.canStart === false && !enrollment
      ? formatSequenceUserMessage({
          code: startAvailability.code,
          message: startAvailability.message,
          fallback: "Sequence enrollment unavailable.",
        })
      : null
  const unavailableIsBlocked = ["fatigue_blocked", "lead_blocked", "suppressed", "low_confidence"].includes(
    startAvailability?.code ?? "",
  )
  const hasRecommendation = Boolean(sequenceMeta?.recommendedPatternId ?? lead.recommendedSequencePatternId)

  const enrollmentPatternTitle = enrollment
    ? enrollment.steps.length > 0
      ? formatSequencePatternTitle(enrollment.steps)
      : recommendedPattern
        ? formatSequencePatternTitleFromPattern(recommendedPattern)
        : (enrollment.patternLabel?.replace(/\bthen\b/gi, "→").replace(/\s+/g, " ").trim() ?? "Sequence")
    : ""

  const collapsedSummary = enrollment
    ? formatEnrollmentCollapsedSummary(enrollment)
    : [
        recommendedPattern ? formatSequencePatternTitleFromPattern(recommendedPattern) : null,
        (sequenceMeta?.recommendedConfidence ?? lead.recommendedSequenceConfidence) != null
          ? `Confidence ${sequenceMeta?.recommendedConfidence ?? lead.recommendedSequenceConfidence}`
          : null,
        fatigueSummaryLabel(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk),
      ]
        .filter(Boolean)
        .join(" · ")

  return (
    <>
      <GrowthCollapsibleEngineCard
        id="growth-sequence"
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
              <EnrollmentHeader
                enrollment={enrollment}
                patternTitle={enrollmentPatternTitle}
                currentStep={currentStep}
              />

              <SequenceProgressBar enrollment={enrollment} />

              <StepProgress steps={enrollment.steps} currentStepOrder={enrollment.currentStepOrder} />

              <div className="flex flex-wrap gap-2">
                {enrollment.status === "draft" ? (
                  <Button
                    size="sm"
                    disabled={acting !== null}
                    onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/confirm`)}
                  >
                    Confirm Enrollment
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
                      Queue Email Step
                    </Button>
                  ) : null}
                  {currentStep.channel !== "email" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void postStep(currentStep.id, "complete")}>
                        Mark Complete
                      </Button>
                      <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void postStep(currentStep.id, "skip")}>
                        Skip Step
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <SequenceRecommendationSummary
                lead={lead}
                sequence={sequenceMeta}
                pattern={recommendedPattern}
                hasEnrollment={Boolean(sequenceMeta?.activeEnrollmentId)}
              />

              {recommendedPattern ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{formatSequencePatternTitleFromPattern(recommendedPattern)}</span>
                  <GrowthBadge label={`Version ${recommendedPattern.sequenceVersion}`} tone="neutral" />
                  {(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk) ? (
                    <GrowthBadge
                      label={formatSequenceFatigueLabel(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk)}
                      tone={formatSequenceFatigueTone(sequenceMeta?.fatigueRisk ?? lead.sequenceFatigueRisk)}
                    />
                  ) : null}
                </div>
              ) : hasRecommendation ? (
                <p className="text-sm text-muted-foreground">Loading recommended sequence details…</p>
              ) : null}

              {unavailableMessage ? (
                <div
                  className={
                    unavailableIsBlocked
                      ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                      : "rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                  }
                >
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
                  <p className="text-muted-foreground">Suggested next step</p>
                  <p className="font-medium">
                    {formatRecommendedNextStepLabel(nextStep.channel)}
                    {nextStep.generationType ? ` · ${formatHumanPhrase(nextStep.generationType)}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Delay {nextStep.delayDays} days · expect {formatHumanPhrase(nextStep.expectedSignal)}
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
                  <Metric label="Opportunity lift" value={recommendedPattern.opportunityLift.toFixed(1)} />
                  <Metric label="Revenue lift" value={recommendedPattern.revenueProbabilityLift.toFixed(1)} />
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
                    <p className="font-medium">{formatSequencePatternTitleFromPattern(pattern)}</p>
                    <p className="text-muted-foreground">{pattern.description ?? pattern.label}</p>
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
              Create Draft Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function fatigueSummaryLabel(risk: string | null | undefined): string | null {
  if (!risk) return null
  return formatSequenceFatigueLabel(risk)
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}
