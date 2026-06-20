"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GrowthSendrLaunchAudienceStep } from "@/components/growth/sendr/growth-sendr-launch-audience-step"
import { GrowthSendrLaunchCompleteStep } from "@/components/growth/sendr/growth-sendr-launch-complete-step"
import { GrowthSendrLaunchPageStep } from "@/components/growth/sendr/growth-sendr-launch-page-step"
import { GrowthSendrLaunchPreviewStep } from "@/components/growth/sendr/growth-sendr-launch-preview-step"
import { GrowthSendrLaunchSequenceStep } from "@/components/growth/sendr/growth-sendr-launch-sequence-step"
import type {
  GrowthSendrLaunchPreviewResult,
  GrowthSendrLaunchRunProgress,
  GrowthSendrLaunchWorkspaceSummary,
} from "@/lib/growth/sendr/growth-sendr-types"
import { GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL, GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"

type WizardStep =
  | "audience"
  | "sequence"
  | "page"
  | "preview"
  | "confirm"
  | "launching"
  | "complete"

const STEPS: WizardStep[] = ["audience", "sequence", "page", "preview", "confirm", "launching", "complete"]

function stepLabel(step: WizardStep): string {
  switch (step) {
    case "audience":
      return "Audience"
    case "sequence":
      return "Sequence"
    case "page":
      return GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL
    case "preview":
      return "Preview"
    case "confirm":
      return "Confirm"
    case "launching":
      return "Launching"
    case "complete":
      return "Complete"
    default:
      return step
  }
}

export function GrowthSendrLaunchWizard() {
  const [step, setStep] = useState<WizardStep>("audience")
  const [summary, setSummary] = useState<GrowthSendrLaunchWorkspaceSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [audienceId, setAudienceId] = useState("")
  const [sequencePatternId, setSequencePatternId] = useState("")
  const [landingPageId, setLandingPageId] = useState("")
  const [preview, setPreview] = useState<GrowthSendrLaunchPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [launchProgress, setLaunchProgress] = useState<GrowthSendrLaunchRunProgress | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch("/api/platform/growth/sendr/launch", { cache: "no-store" })
      const data = (await res.json()) as {
        ok: boolean
        summary?: GrowthSendrLaunchWorkspaceSummary
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? "Failed to load launch workspace")
      setSummary(data.summary ?? null)
    } catch {
      setSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const reset = useCallback(() => {
    setStep("audience")
    setAudienceId("")
    setSequencePatternId("")
    setLandingPageId("")
    setPreview(null)
    setPreviewError(null)
    setLaunchProgress(null)
    setLaunchError(null)
    void loadSummary()
  }, [loadSummary])

  async function loadPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/launch-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId, sequencePatternId, landingPageId }),
      })
      const data = (await res.json()) as {
        ok: boolean
        preview?: GrowthSendrLaunchPreviewResult
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? "Preview failed")
      setPreview(data.preview ?? null)
    } catch (err) {
      setPreview(null)
      setPreviewError(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setPreviewLoading(false)
    }
  }

  async function postLaunchRun(body: Record<string, unknown>): Promise<GrowthSendrLaunchRunProgress> {
    const res = await fetch("/api/platform/growth/sendr/launch-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as {
      ok: boolean
      progress?: GrowthSendrLaunchRunProgress
      message?: string
    }
    if (!res.ok) throw new Error(data.message ?? "Launch failed")
    if (!data.progress) throw new Error("Launch failed")
    return data.progress
  }

  async function runLaunchStart() {
    setBusy(true)
    setLaunchError(null)
    setStep("launching")
    try {
      const progress = await postLaunchRun({
        action: "start",
        audienceId,
        sequencePatternId,
        landingPageId,
      })
      setLaunchProgress(progress)
      if (progress.nextAction === "continue") {
        setStep("launching")
      } else {
        setStep("complete")
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Launch failed")
      setStep("confirm")
    } finally {
      setBusy(false)
    }
  }

  async function runLaunchContinue() {
    if (!launchProgress?.launchRunId) return
    setBusy(true)
    setLaunchError(null)
    try {
      const progress = await postLaunchRun({
        action: "continue",
        launchRunId: launchProgress.launchRunId,
      })
      setLaunchProgress(progress)
      if (progress.nextAction === "continue") {
        setStep("launching")
      } else {
        setStep("complete")
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Launch failed")
    } finally {
      setBusy(false)
    }
  }

  async function runLaunchCancel() {
    if (!launchProgress?.launchRunId) return
    setBusy(true)
    setLaunchError(null)
    try {
      const progress = await postLaunchRun({
        action: "cancel",
        launchRunId: launchProgress.launchRunId,
      })
      setLaunchProgress(progress)
      setStep("complete")
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Cancel failed")
    } finally {
      setBusy(false)
    }
  }

  function goNext() {
    if (step === "audience") setStep("sequence")
    else if (step === "sequence") setStep("page")
    else if (step === "page") {
      setStep("preview")
      void loadPreview()
    } else if (step === "preview") setStep("confirm")
    else if (step === "confirm") void runLaunchStart()
  }

  function goBack() {
    if (step === "sequence") setStep("audience")
    else if (step === "page") setStep("sequence")
    else if (step === "preview") setStep("page")
    else if (step === "confirm") setStep("preview")
  }

  const stepIndex = STEPS.indexOf(step)
  const canNext =
    (step === "audience" && audienceId) ||
    (step === "sequence" && sequencePatternId) ||
    (step === "page" && landingPageId) ||
    step === "preview" ||
    step === "confirm"

  if (loadingSummary) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading launch workspace…
      </div>
    )
  }

  if (!summary) {
    return <p className="text-sm text-destructive">{GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} launch workspace unavailable.</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campaign launch wizard</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          {STEPS.filter((s) => s !== "launching").map((s) => (
            <span
              key={s}
              className={`rounded-full px-2 py-0.5 text-xs ${
                s === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {stepLabel(s)}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "audience" ? (
          <GrowthSendrLaunchAudienceStep
            summary={summary}
            audienceId={audienceId}
            onAudienceIdChange={setAudienceId}
            disabled={busy}
          />
        ) : null}

        {step === "sequence" ? (
          <GrowthSendrLaunchSequenceStep
            summary={summary}
            sequencePatternId={sequencePatternId}
            onSequencePatternIdChange={setSequencePatternId}
            disabled={busy}
          />
        ) : null}

        {step === "page" ? (
          <GrowthSendrLaunchPageStep
            summary={summary}
            landingPageId={landingPageId}
            onLandingPageIdChange={setLandingPageId}
            disabled={busy}
          />
        ) : null}

        {step === "preview" || step === "confirm" ? (
          <GrowthSendrLaunchPreviewStep preview={preview} loading={previewLoading} error={previewError} />
        ) : null}

        {step === "confirm" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            Confirm enrollment for <strong>{preview?.eligibleCount ?? 0}</strong> eligible members.
            Sequence will not auto-send — operator controls all execution.
            {launchError ? <p className="mt-2 text-destructive">{launchError}</p> : null}
          </div>
        ) : null}

        {step === "launching" && launchProgress ? (
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>
                {launchProgress.status === "previewing"
                  ? "Previewing audience…"
                  : launchProgress.status === "ready_to_enroll"
                    ? "Preview complete — ready to enroll"
                    : launchProgress.status === "enrolling"
                      ? "Enrolling members…"
                      : "Processing launch…"}
              </span>
            </div>
            <div className="grid gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processed</span>
                <span className="font-medium tabular-nums">{launchProgress.processedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium tabular-nums">{launchProgress.remainingCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{launchProgress.status}</span>
              </div>
            </div>
            {launchError ? <p className="text-destructive">{launchError}</p> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {launchProgress.nextAction === "continue" ? (
                <Button onClick={() => void runLaunchContinue()} disabled={busy}>
                  Continue
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void runLaunchCancel()} disabled={busy}>
                Cancel launch
              </Button>
            </div>
          </div>
        ) : null}

        {step === "launching" && !launchProgress ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting launch…
          </div>
        ) : null}

        {step === "complete" && launchProgress ? (
          <GrowthSendrLaunchCompleteStep progress={launchProgress} onStartOver={reset} />
        ) : null}

        {step !== "complete" && step !== "launching" ? (
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={goBack} disabled={stepIndex <= 0 || busy}>
              Back
            </Button>
            <Button onClick={goNext} disabled={!canNext || busy || previewLoading}>
              {step === "confirm" ? "Launch enrollment" : "Continue"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
