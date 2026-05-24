"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, UserCheck, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthBadge, GrowthEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_ASSIGNMENT_SOURCE_LABELS,
  GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
  type GrowthRepRosterEntry,
} from "@/lib/growth/assignment/assignment-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadAssignmentPanelProps = {
  lead: GrowthLead
  ownerLabel?: string | null
  onLeadUpdated?: (patch: Partial<GrowthLead>) => void
  onTimelineRefresh?: () => void
  compact?: boolean
}

export function GrowthLeadAssignmentPanel({
  lead,
  ownerLabel,
  onLeadUpdated,
  onTimelineRefresh,
  compact = false,
}: GrowthLeadAssignmentPanelProps) {
  const [reps, setReps] = useState<GrowthRepRosterEntry[]>([])
  const [loadingReps, setLoadingReps] = useState(true)
  const [selectedRepId, setSelectedRepId] = useState<string>("__none__")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReps = useCallback(async () => {
    setLoadingReps(true)
    try {
      const res = await fetch("/api/platform/growth/assignment/reps", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reps?: GrowthRepRosterEntry[] }
      if (res.ok && data.ok) setReps(data.reps ?? [])
    } finally {
      setLoadingReps(false)
    }
  }, [])

  useEffect(() => {
    void loadReps()
  }, [loadReps])

  useEffect(() => {
    setSelectedRepId(lead.assignedTo ?? "__none__")
  }, [lead.assignedTo])

  async function applyAssignment(managerOverride = false) {
    setSaving(true)
    setError(null)
    try {
      const assignedToUserId = selectedRepId === "__none__" ? null : selectedRepId
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId,
          managerOverride,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not update assignment.")
      }
      onLeadUpdated?.(data.lead)
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update assignment.")
    } finally {
      setSaving(false)
    }
  }

  const displayOwner =
    ownerLabel ??
    (lead.assignedTo ? reps.find((rep) => rep.userId === lead.assignedTo)?.displayName ?? reps.find((rep) => rep.userId === lead.assignedTo)?.email : null)

  return (
    <GrowthEngineCard title="Sales ownership">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_LEAD_ASSIGNMENT_QA_MARKER} tone="neutral" />
          {!compact ? (
            <span className="text-xs text-muted-foreground">
              Assign internal accountability without changing outreach approval gates.
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.assignedTo ? (
            <GrowthBadge label={displayOwner ?? "Assigned rep"} tone="healthy" />
          ) : (
            <GrowthBadge label="Unassigned" tone="attention" />
          )}
          {lead.assignmentSource ? (
            <GrowthBadge
              label={GROWTH_ASSIGNMENT_SOURCE_LABELS[lead.assignmentSource] ?? lead.assignmentSource}
              tone="neutral"
            />
          ) : null}
          {lead.assignedAt ? (
            <span className="text-xs text-muted-foreground">Assigned {formatRelativeTime(lead.assignedAt)}</span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor={`assign-rep-${lead.id}`}>Owner</Label>
            <Select value={selectedRepId} onValueChange={setSelectedRepId} disabled={loadingReps || saving}>
              <SelectTrigger id={`assign-rep-${lead.id}`}>
                <SelectValue placeholder={loadingReps ? "Loading reps…" : "Select rep"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {reps
                  .filter((rep) => rep.status !== "inactive")
                  .map((rep) => (
                    <SelectItem key={rep.userId} value={rep.userId}>
                      {rep.displayName ?? rep.email}
                      {rep.status === "paused" ? " (paused)" : ""}
                      {rep.isOverCapacity ? " (at capacity)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void applyAssignment(false)} disabled={saving || loadingReps}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
              Save owner
            </Button>
            {lead.assignmentSource === "manual" || lead.assignmentSource === "manager_override" ? (
              <Button size="sm" variant="outline" onClick={() => void applyAssignment(true)} disabled={saving}>
                <UserCheck className="mr-2 size-4" />
                Manager override
              </Button>
            ) : null}
            {lead.assignedTo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedRepId("__none__")
                  void applyAssignment(false)
                }}
                disabled={saving}
              >
                <UserMinus className="mr-2 size-4" />
                Unassign
              </Button>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </GrowthEngineCard>
  )
}
