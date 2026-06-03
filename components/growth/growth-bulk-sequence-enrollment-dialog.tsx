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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { BulkSequenceEnrollmentResult } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import { GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

type GrowthBulkSequenceEnrollmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadIds: string[]
  onCompleted?: (result: BulkSequenceEnrollmentResult) => void
}

export function GrowthBulkSequenceEnrollmentDialog({
  open,
  onOpenChange,
  leadIds,
  onCompleted,
}: GrowthBulkSequenceEnrollmentDialogProps) {
  const [patterns, setPatterns] = useState<GrowthSequencePattern[]>([])
  const [patternId, setPatternId] = useState("")
  const [startImmediately, setStartImmediately] = useState(true)
  const [scheduledStartAt, setScheduledStartAt] = useState("")
  const [loadingPatterns, setLoadingPatterns] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkSequenceEnrollmentResult | null>(null)

  const uniqueLeadIds = useMemo(() => [...new Set(leadIds)], [leadIds])
  const overLimit = uniqueLeadIds.length > GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS

  const loadPatterns = useCallback(async () => {
    setLoadingPatterns(true)
    try {
      const res = await fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { patterns?: GrowthSequencePattern[] }
      const next = data.patterns ?? []
      setPatterns(next)
      setPatternId((current) => current || next[0]?.id || "")
    } catch {
      setPatterns([])
    } finally {
      setLoadingPatterns(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setResult(null)
    void loadPatterns()
  }, [open, loadPatterns])

  async function submit(dryRun: boolean) {
    if (!patternId || uniqueLeadIds.length === 0 || overLimit) return
    if (dryRun) setPreviewing(true)
    else setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/enroll/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: uniqueLeadIds,
          sequencePatternId: patternId,
          startImmediately,
          scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
          dryRun,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        result?: BulkSequenceEnrollmentResult
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? "Bulk enrollment failed.")
      }
      setResult(data.result)
      if (!dryRun) onCompleted?.(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk enrollment failed.")
    } finally {
      setSubmitting(false)
      setPreviewing(false)
    }
  }

  const selectedPattern = patterns.find((entry) => entry.id === patternId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Bulk enroll in sequence
          </DialogTitle>
          <DialogDescription>
            Enroll {uniqueLeadIds.length} lead(s) into a Growth sequence pattern. Due email steps are planned by the
            sequence scheduler — human approval is still required before send.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <GrowthBadge label={`${uniqueLeadIds.length} selected`} tone="medium" />
            {overLimit ? (
              <GrowthBadge label={`Max ${GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS} per batch`} tone="critical" />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-sequence-pattern">Sequence pattern</Label>
            <Select value={patternId} onValueChange={setPatternId} disabled={loadingPatterns}>
              <SelectTrigger id="bulk-sequence-pattern">
                <SelectValue placeholder={loadingPatterns ? "Loading patterns…" : "Choose sequence"} />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((pattern) => (
                  <SelectItem key={pattern.id} value={pattern.id}>
                    {pattern.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPattern ? (
              <p className="text-xs text-muted-foreground">
                {selectedPattern.steps.length} steps · {selectedPattern.key}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Start immediately</p>
              <p className="text-xs text-muted-foreground">Activate enrollments so the scheduler can plan due steps.</p>
            </div>
            <Switch checked={startImmediately} onCheckedChange={setStartImmediately} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-sequence-start-at">Scheduled start (optional)</Label>
            <Input
              id="bulk-sequence-start-at"
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(event) => setScheduledStartAt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shifts step 1 scheduling anchor. Scheduler still respects business hours when steps become due.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">{result.dryRun ? "Preview" : "Enrollment complete"}</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Enrolled: {result.enrolled.length}</li>
                <li>Already enrolled: {result.skippedAlreadyEnrolled.length}</li>
                <li>Blocked: {result.skippedBlocked.length}</li>
                <li>Failed: {result.failed.length}</li>
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={previewing || submitting || overLimit || !patternId}
              onClick={() => void submit(true)}
            >
              {previewing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Preview
            </Button>
            <Button
              type="button"
              disabled={previewing || submitting || overLimit || !patternId}
              onClick={() => void submit(false)}
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Enroll {uniqueLeadIds.length} leads
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
