"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  GrowthAudienceEnrollmentPreviewProgress,
  GrowthAudienceEnrollmentRunProgress,
} from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

type WizardStep = "configure" | "preview" | "confirm" | "enrolling" | "done"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  audienceId: string
  snapshotId: string | null
  selectedMemberIds?: string[]
  onComplete?: (message: string) => void
}

export function GrowthAudienceEnrollmentWizard({
  open,
  onOpenChange,
  audienceId,
  snapshotId,
  selectedMemberIds = [],
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>("configure")
  const [patterns, setPatterns] = useState<GrowthSequencePattern[]>([])
  const [patternId, setPatternId] = useState("")
  const [startImmediately, setStartImmediately] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GrowthAudienceEnrollmentPreviewProgress | null>(null)
  const [enrollProgress, setEnrollProgress] = useState<GrowthAudienceEnrollmentRunProgress | null>(null)
  const [enrollMode, setEnrollMode] = useState<"selected" | "eligible">("eligible")

  const reset = useCallback(() => {
    setStep("configure")
    setPreview(null)
    setEnrollProgress(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    void fetch("/api/platform/growth/sequences/patterns")
      .then((r) => r.json())
      .then((data: { patterns?: GrowthSequencePattern[] }) => {
        setPatterns(data.patterns ?? [])
      })
      .catch(() => setPatterns([]))
  }, [open, reset])

  async function runPreviewLoop(body: Record<string, unknown>): Promise<GrowthAudienceEnrollmentPreviewProgress> {
    let current: GrowthAudienceEnrollmentPreviewProgress | null = null
    do {
      const res = await fetch(`/api/platform/growth/audiences/${audienceId}/enrollment-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok: boolean
        progress: GrowthAudienceEnrollmentPreviewProgress
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? "Preview failed")
      current = data.progress
      setPreview(current)
      if (current.hasMore && current.previewId) {
        body = {
          snapshotId,
          sequencePatternId: patternId,
          previewId: current.previewId,
        }
      }
    } while (current?.hasMore)
    if (!current) throw new Error("Preview failed")
    return current
  }

  async function runEnrollmentLoop(body: Record<string, unknown>): Promise<GrowthAudienceEnrollmentRunProgress> {
    let current: GrowthAudienceEnrollmentRunProgress | null = null
    do {
      const res = await fetch(`/api/platform/growth/audiences/${audienceId}/enrollment-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok: boolean
        progress: GrowthAudienceEnrollmentRunProgress
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? "Enrollment failed")
      current = data.progress
      setEnrollProgress(current)
      if (current.hasMore && current.runId) {
        body = { runId: current.runId }
      }
    } while (current?.hasMore)
    if (!current) throw new Error("Enrollment failed")
    return current
  }

  async function handlePreview() {
    if (!snapshotId || !patternId) return
    setLoading(true)
    setError(null)
    setStep("preview")
    try {
      await runPreviewLoop({ snapshotId, sequencePatternId: patternId })
      setStep("confirm")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed")
      setStep("configure")
    } finally {
      setLoading(false)
    }
  }

  async function handleEnroll() {
    if (!snapshotId || !patternId || !preview) return
    setLoading(true)
    setError(null)
    setStep("enrolling")
    try {
      const result = await runEnrollmentLoop({
        snapshotId,
        sequencePatternId: patternId,
        previewId: preview.previewId,
        enrollEligible: enrollMode === "eligible",
        memberIds: enrollMode === "selected" ? selectedMemberIds : undefined,
        startImmediately,
        dryRun,
      })
      setStep("done")
      onComplete?.(
        `Enrollment completed · ${result.enrolledCount} enrolled · ${result.skippedCount} skipped · ${result.failedCount} failed`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed")
      setStep("confirm")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview &amp; Enroll Audience</DialogTitle>
          <DialogDescription>
            Operator-initiated only — review eligibility before enrolling into a sequence.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {step === "configure" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sequence pattern</Label>
              <Select value={patternId} onValueChange={setPatternId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sequence" />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="start-immediately">Start immediately after enroll</Label>
              <Switch id="start-immediately" checked={startImmediately} onCheckedChange={setStartImmediately} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dry-run">Dry run (no writes)</Label>
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            </div>
          </div>
        ) : null}

        {step === "preview" && loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Evaluating members… {preview?.processedCount ?? 0} / {preview?.totalMembers ?? "—"}
          </p>
        ) : null}

        {step === "confirm" && preview ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Enrollment preview</p>
            <div className="grid grid-cols-2 gap-2">
              <span>Eligible</span>
              <span className="text-right font-medium text-green-700">{preview.eligibleCount}</span>
              <span>Already enrolled</span>
              <span className="text-right">{preview.alreadyEnrolledCount}</span>
              <span>Suppressed</span>
              <span className="text-right">{preview.suppressedCount}</span>
              <span>Missing contact</span>
              <span className="text-right">{preview.missingContactCount}</span>
              <span>Blocked by limits</span>
              <span className="text-right">{preview.blockedCount}</span>
            </div>
            <div className="space-y-2 pt-2">
              <Label>Enroll scope</Label>
              <Select
                value={enrollMode}
                onValueChange={(v) => setEnrollMode(v as "selected" | "eligible")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligible">Enroll all eligible ({preview.eligibleCount})</SelectItem>
                  <SelectItem value="selected" disabled={selectedMemberIds.length === 0}>
                    Enroll selected ({selectedMemberIds.length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {step === "enrolling" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enrolling… {enrollProgress?.processedCount ?? 0} / {enrollProgress?.requestedCount ?? "—"}
          </p>
        ) : null}

        {step === "done" && enrollProgress ? (
          <p className="text-sm">
            Done · {enrollProgress.enrolledCount} enrolled · {enrollProgress.skippedCount} skipped ·{" "}
            {enrollProgress.failedCount} failed
          </p>
        ) : null}

        <DialogFooter>
          {step === "configure" ? (
            <Button disabled={!snapshotId || !patternId || loading} onClick={() => void handlePreview()}>
              Preview Enrollment
            </Button>
          ) : null}
          {step === "confirm" ? (
            <>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
              <Button
                disabled={loading || preview!.eligibleCount === 0}
                onClick={() => void handleEnroll()}
              >
                Confirm Enrollment
              </Button>
            </>
          ) : null}
          {step === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
