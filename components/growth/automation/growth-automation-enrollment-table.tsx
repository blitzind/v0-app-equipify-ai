"use client"

import { Button } from "@/components/ui/button"
import { GrowthAutomationEnrollmentStatusBadge } from "@/components/growth/automation/growth-automation-enrollment-status-badge"
import type { GrowthAutomationEnrollmentRecord } from "@/lib/growth/automation/growth-automation-enrollment-types"

type Props = {
  enrollments: GrowthAutomationEnrollmentRecord[]
  loading?: boolean
  onSelect?: (enrollment: GrowthAutomationEnrollmentRecord) => void
  onCancel?: (enrollment: GrowthAutomationEnrollmentRecord) => void
  cancellingId?: string | null
}

export function GrowthAutomationEnrollmentTable({
  enrollments,
  loading,
  onSelect,
  onCancel,
  cancellingId,
}: Props) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading enrollments…</p>
  }

  if (enrollments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No enrollments yet. Publish and activate the runtime, then enroll a lead manually or via trigger match.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Lead</th>
            <th className="py-2 pr-3 font-medium">Trigger</th>
            <th className="py-2 pr-3 font-medium">Entry reason</th>
            <th className="py-2 pr-3 font-medium">Created</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => {
            const canCancel =
              enrollment.status === "enrolled" || enrollment.status === "draft" || enrollment.status === "blocked"

            return (
              <tr key={enrollment.enrollmentId} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <GrowthAutomationEnrollmentStatusBadge
                    status={enrollment.status}
                    duplicate={enrollment.duplicateEnrollment}
                  />
                </td>
                <td className="py-2 pr-3 font-mono">{enrollment.leadId.slice(0, 8)}…</td>
                <td className="py-2 pr-3">{enrollment.triggerSource}</td>
                <td className="py-2 pr-3 max-w-[160px] truncate" title={enrollment.entryReason}>
                  {enrollment.entryReason}
                </td>
                <td className="py-2 pr-3">{new Date(enrollment.createdAt).toLocaleDateString()}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onSelect?.(enrollment)}>
                      Detail
                    </Button>
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        disabled={cancellingId === enrollment.enrollmentId}
                        onClick={() => onCancel?.(enrollment)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
