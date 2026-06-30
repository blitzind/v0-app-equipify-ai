"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthAutomationEnrollmentDetailDrawer } from "@/components/growth/automation/growth-automation-enrollment-detail-drawer"
import { GrowthAutomationEnrollmentTable } from "@/components/growth/automation/growth-automation-enrollment-table"
import { GrowthAutomationRuntimeExecutionPanel } from "@/components/growth/automation/growth-automation-runtime-execution-panel"
import { GrowthAutomationObservabilityPanel } from "@/components/growth/automation/growth-automation-observability-panel"
import { GrowthAutomationTriggerMatchPanel } from "@/components/growth/automation/growth-automation-trigger-match-panel"
import {
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
  type GrowthAutomationEnrollmentRecord,
} from "@/lib/growth/automation/growth-automation-enrollment-types"

type Props = {
  flowId: string
  runtimeActive?: boolean
  onChanged?: () => void
}

type EnrollmentsResponse = {
  enrollments?: GrowthAutomationEnrollmentRecord[]
}

type EnrollResponse = {
  ok?: boolean
  enrollment?: GrowthAutomationEnrollmentRecord
}

export function GrowthAutomationEnrollmentPanel({ flowId, runtimeActive, onChanged }: Props) {
  const [enrollments, setEnrollments] = useState<GrowthAutomationEnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [allowOverride, setAllowOverride] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<GrowthAutomationEnrollmentRecord | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/enrollments`)
      const data = (await res.json()) as EnrollmentsResponse
      setEnrollments(data.enrollments ?? [])
    } finally {
      setLoading(false)
    }
  }, [flowId])

  useEffect(() => {
    void load()
  }, [load])

  const activeCount = useMemo(
    () => enrollments.filter((entry) => entry.status === "enrolled" || entry.status === "draft").length,
    [enrollments],
  )
  const completedCount = useMemo(
    () => enrollments.filter((entry) => entry.status === "completed").length,
    [enrollments],
  )
  const duplicateCount = useMemo(
    () => enrollments.filter((entry) => entry.status === "duplicate" || entry.duplicateEnrollment).length,
    [enrollments],
  )

  const enrollLead = useCallback(async () => {
    if (!leadId.trim()) {
      setMessage("Lead ID is required for manual enrollment.")
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId.trim(),
          triggerSource: "manual.enrollment",
          entryReason: "Manual enrollment from automation canvas",
          allowReEnrollmentOverride: allowOverride,
        }),
      })
      const data = (await res.json()) as EnrollResponse
      if (!res.ok || !data.enrollment) {
        setMessage("Enrollment blocked — activate this automation or resolve duplicate protection.")
      } else if (data.enrollment.status === "duplicate") {
        setMessage("This lead is already enrolled in this automation.")
      } else if (data.enrollment.status === "enrolled") {
        setMessage("Lead enrolled. Runs automatically once approved.")
        setLeadId("")
      } else {
        setMessage(`Enrollment status: ${data.enrollment.status}`)
      }
      await load()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }, [allowOverride, flowId, leadId, load, onChanged])

  const cancelEnrollment = useCallback(
    async (enrollment: GrowthAutomationEnrollmentRecord) => {
      setCancellingId(enrollment.enrollmentId)
      setMessage(null)
      try {
        const res = await fetch(`/api/platform/growth/automation/${flowId}/unenroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId: enrollment.enrollmentId }),
        })
        const data = (await res.json()) as EnrollResponse
        if (!res.ok) {
          setMessage("Cancellation failed.")
        } else {
          setMessage("Enrollment cancelled.")
        }
        if (selected?.enrollmentId === enrollment.enrollmentId) {
          setSelected(data.enrollment ?? null)
        }
        await load()
        onChanged?.()
      } finally {
        setCancellingId(null)
      }
    },
    [flowId, load, onChanged, selected?.enrollmentId],
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-qa-marker={GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Enrollments</h3>
          <p className="text-xs text-muted-foreground">
            Add leads to this automation · duplicate protection · requires approval to run
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
          <p>active {activeCount}</p>
          <p>completed {completedCount}</p>
          <p>duplicates {duplicateCount}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.enrollment_execution_enabled ? (
          <span>enrollment enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.sequence_execution_enabled === false ? (
          <span>no execution</span>
        ) : null}
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.requires_human_review ? (
          <span>human review</span>
        ) : null}
      </div>

      <div className="mt-4 rounded-md border border-border/70 p-3">
        <p className="text-xs font-medium">Manual enrollment</p>
        <div className="mt-2 grid gap-2">
          <Input
            placeholder="Lead ID"
            value={leadId}
            disabled={!runtimeActive || busy}
            onChange={(event) => setLeadId(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allowOverride}
              disabled={!runtimeActive || busy}
              onChange={(event) => setAllowOverride(event.target.checked)}
            />
            Allow re-enrollment override (cancels active enrollment first)
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!runtimeActive || busy}
            onClick={() => void enrollLead()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Enroll lead
          </Button>
          {!runtimeActive ? (
            <p className="text-xs text-muted-foreground">Publish and activate this automation before enrolling leads.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <GrowthAutomationEnrollmentTable
          enrollments={enrollments}
          loading={loading}
          cancellingId={cancellingId}
          onSelect={(enrollment) => {
            setSelected(enrollment)
            setDrawerOpen(true)
          }}
          onCancel={(enrollment) => void cancelEnrollment(enrollment)}
        />
      </div>

      <div className="mt-4">
        <GrowthAutomationTriggerMatchPanel compact />
      </div>

      {selected ? (
        <div className="mt-4 space-y-4">
          <GrowthAutomationObservabilityPanel
            flowId={flowId}
            enrollmentId={selected.enrollmentId}
            leadId={selected.leadId}
            onChanged={() => void load()}
          />
          <GrowthAutomationRuntimeExecutionPanel
            flowId={flowId}
            enrollmentId={selected.enrollmentId}
            leadId={selected.leadId}
            onChanged={() => void load()}
          />
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}

      <GrowthAutomationEnrollmentDetailDrawer
        flowId={flowId}
        enrollment={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
