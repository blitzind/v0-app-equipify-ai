"use client"

import { useMemo, useState } from "react"
import { CalendarClock, Loader2, MoreHorizontal, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GrowthBadge,
  formatRelativeTime,
  momentumTierTone,
  priorityTierTone,
} from "@/components/growth/growth-ui-utils"
import { GrowthWorkflowHealthBadge } from "@/components/growth/growth-workflow-health-badge"
import { GrowthCallActionSheet } from "@/components/growth/growth-call-action-sheet"
import {
  GROWTH_LEAD_CALL_DISPOSITIONS,
  type GrowthCallQueueRow,
  type GrowthLeadCallDisposition,
} from "@/lib/growth/call-types"
import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthMomentumTier } from "@/lib/growth/momentum-types"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"

const DISPOSITION_LABELS: Record<GrowthLeadCallDisposition, string> = {
  call_attempted: "Call attempted",
  left_voicemail: "Left voicemail",
  interested: "Interested",
  not_a_fit: "Not a fit",
  follow_up_later: "Follow up later",
  no_answer: "No answer",
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type GrowthCallQueueTableProps = {
  rows: GrowthCallQueueRow[]
  onOpenLead: (leadId: string) => void
  onRecordDisposition: (
    leadId: string,
    input: { disposition: GrowthLeadCallDisposition; note?: string | null; followUpAt?: string | null },
  ) => Promise<void>
  onLeadUpdated?: (leadId: string, patch: Partial<GrowthCallQueueRow>) => void
  recordingLeadId?: string | null
}

export function GrowthCallQueueTable({
  rows,
  onOpenLead,
  onRecordDisposition,
  onLeadUpdated,
  recordingLeadId = null,
}: GrowthCallQueueTableProps) {
  const [followUpTarget, setFollowUpTarget] = useState<GrowthCallQueueRow | null>(null)
  const [followUpAt, setFollowUpAt] = useState("")
  const [note, setNote] = useState("")
  const [callTarget, setCallTarget] = useState<GrowthCallQueueRow | null>(null)

  const followUpSaving = followUpTarget ? recordingLeadId === followUpTarget.leadId : false

  const quickFollowUpOptions = useMemo(
    () => [
      { label: "1 day", value: addDays(1) },
      { label: "3 days", value: addDays(3) },
      { label: "7 days", value: addDays(7) },
    ],
    [],
  )

  function openFollowUpDialog(row: GrowthCallQueueRow) {
    setFollowUpTarget(row)
    setFollowUpAt(toDateInputValue(addDays(3)))
    setNote("")
  }

  function closeFollowUpDialog() {
    if (followUpSaving) return
    setFollowUpTarget(null)
    setFollowUpAt("")
    setNote("")
  }

  async function submitFollowUp() {
    if (!followUpTarget || !followUpAt) return
    const parsed = new Date(followUpAt)
    if (Number.isNaN(parsed.getTime())) return
    await onRecordDisposition(followUpTarget.leadId, {
      disposition: "follow_up_later",
      followUpAt: parsed.toISOString(),
      note: note.trim() || null,
    })
    setFollowUpTarget(null)
    setFollowUpAt("")
    setNote("")
  }

  async function handleDisposition(row: GrowthCallQueueRow, disposition: GrowthLeadCallDisposition) {
    if (disposition === "follow_up_later") {
      openFollowUpDialog(row)
      return
    }
    await onRecordDisposition(row.leadId, { disposition })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
        No leads match this queue filter.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Priority</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Momentum</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Engagement</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Health</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Company</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Owner</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Decision maker</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Contact</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Next action</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Last touch</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Age</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row) => {
              const saving = recordingLeadId === row.leadId
              return (
                <tr key={row.leadId} className="hover:bg-muted/30">
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-base font-bold tabular-nums">{row.callPriorityScore ?? "—"}</span>
                      {row.callPriorityTier ? (
                        <GrowthBadge label={row.callPriorityTier} tone={priorityTierTone(row.callPriorityTier)} />
                      ) : null}
                      {row.callPriorityOverride != null ? (
                        <span className="text-[11px] text-muted-foreground">Override {row.callPriorityOverride}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold tabular-nums">{row.momentumScore ?? "—"}</div>
                    {row.momentumTier ? (
                      <GrowthBadge
                        label={row.momentumTier}
                        tone={momentumTierTone(row.momentumTier as GrowthMomentumTier)}
                        className="mt-1"
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold tabular-nums">{row.engagementScore ?? "—"}</div>
                    {row.engagementTier ? (
                      <GrowthBadge label={row.engagementTier} tone="healthy" className="mt-1" />
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <GrowthWorkflowHealthBadge status={row.workflowHealth as GrowthWorkflowHealthStatus | null} />
                  </td>
                  <td className="px-3 py-3 align-top min-w-[10rem]">
                    <button type="button" className="text-left" onClick={() => onOpenLead(row.leadId)}>
                      <div className="font-semibold text-foreground underline-offset-2 hover:underline">{row.companyName}</div>
                      {row.city || row.state ? (
                        <div className="text-xs text-muted-foreground">
                          {[row.city, row.state].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {row.assignedToLabel ? (
                      <span className="text-sm">{row.assignedToLabel}</span>
                    ) : (
                      <span className="text-sm text-amber-700">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top max-w-[8rem]">
                    <div className="text-sm">{row.primaryDecisionMakerName ?? "—"}</div>
                    {row.decisionMakerStatus ? (
                      <div className="mt-1 text-xs capitalize text-muted-foreground">
                        {row.decisionMakerStatus.replace(/_/g, " ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div>{row.contactName ?? "—"}</div>
                    {row.contactPhone ? <div className="text-xs text-muted-foreground">{row.contactPhone}</div> : null}
                  </td>
                  <td className="px-3 py-3 align-top max-w-[10rem]">
                    {row.nextBestAction ? (
                      <p className="text-sm font-medium leading-snug">
                        {GROWTH_NEXT_BEST_ACTION_LABELS[row.nextBestAction as GrowthNextBestAction] ??
                          row.nextBestAction.replace(/_/g, " ")}
                      </p>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 align-top max-w-[8rem]">
                    <div className="text-sm capitalize">{(row.sourceChannel ?? row.sourceKind).replace(/_/g, " ")}</div>
                    {row.sourceCampaign ? (
                      <div className="text-xs text-muted-foreground truncate">{row.sourceCampaign}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-sm">
                    {formatRelativeTime(row.lastHumanTouchAt)}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {row.agingDays != null ? (
                      <div>
                        <div className="font-medium tabular-nums">{row.agingDays}d</div>
                        {row.agingBucket ? (
                          <div className="text-xs capitalize text-muted-foreground">{row.agingBucket}</div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 align-top capitalize text-sm">{row.status.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving || !row.contactPhone}
                        onClick={() => setCallTarget(row)}
                      >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={saving}>
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {GROWTH_LEAD_CALL_DISPOSITIONS.map((disposition) => (
                            <DropdownMenuItem key={disposition} onClick={() => void handleDisposition(row, disposition)}>
                              {DISPOSITION_LABELS[disposition]}
                              {row.callDisposition === disposition ? " ✓" : ""}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openFollowUpDialog(row)}>
                            <CalendarClock className="mr-2 size-4" />
                            Schedule follow-up…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {row.callDisposition ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{DISPOSITION_LABELS[row.callDisposition]}</p>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(followUpTarget)} onOpenChange={(open) => !open && closeFollowUpDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow Up Later</DialogTitle>
            <DialogDescription>
              {followUpTarget ? `Schedule a follow-up for ${followUpTarget.companyName}.` : "Schedule a follow-up."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quickFollowUpOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFollowUpAt(toDateInputValue(option.value))}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="follow-up-at">Custom date</Label>
              <Input
                id="follow-up-at"
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="follow-up-note">Note (optional)</Label>
              <Textarea
                id="follow-up-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why follow up later?"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFollowUpDialog} disabled={followUpSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitFollowUp()} disabled={followUpSaving || !followUpAt}>
              {followUpSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save Follow Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {callTarget?.contactPhone ? (
        <GrowthCallActionSheet
          open={Boolean(callTarget)}
          onOpenChange={(open) => !open && setCallTarget(null)}
          leadId={callTarget.leadId}
          phone={callTarget.contactPhone}
          contactLabel={callTarget.contactName ?? callTarget.companyName}
          onLeadUpdated={() => onLeadUpdated?.(callTarget.leadId, {})}
        />
      ) : null}
    </>
  )
}
