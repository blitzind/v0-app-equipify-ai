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
import { cn } from "@/lib/utils"
import {
  GROWTH_LEAD_CALL_DISPOSITIONS,
  type GrowthCallQueueRow,
  type GrowthLeadCallDisposition,
} from "@/lib/growth/call-types"
import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"
import { GrowthWorkflowHealthBadge } from "@/components/growth/growth-workflow-health-badge"

const DISPOSITION_LABELS: Record<GrowthLeadCallDisposition, string> = {
  call_attempted: "Call attempted",
  left_voicemail: "Left voicemail",
  interested: "Interested",
  not_a_fit: "Not a fit",
  follow_up_later: "Follow up later",
}

function tierClass(tier: GrowthCallQueueRow["callPriorityTier"]) {
  switch (tier) {
    case "critical":
      return "bg-rose-50 text-rose-700 border-rose-200"
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-slate-100 text-slate-600 border-slate-200"
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
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
  recordingLeadId?: string | null
}

export function GrowthCallQueueTable({
  rows,
  onOpenLead,
  onRecordDisposition,
  recordingLeadId = null,
}: GrowthCallQueueTableProps) {
  const [followUpTarget, setFollowUpTarget] = useState<GrowthCallQueueRow | null>(null)
  const [followUpAt, setFollowUpAt] = useState("")
  const [note, setNote] = useState("")

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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Why this lead</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Momentum</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Health</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Disposition</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row) => {
              const saving = recordingLeadId === row.leadId
              return (
                <tr key={row.leadId} className="hover:bg-muted/30">
                  <td className="px-4 py-3 align-top font-medium text-muted-foreground">{row.rank}</td>
                  <td className="px-4 py-3 align-top">
                    <button type="button" className="text-left" onClick={() => onOpenLead(row.leadId)}>
                      <div className="font-medium text-foreground underline-offset-2 hover:underline">{row.companyName}</div>
                      {row.city || row.state ? (
                        <div className="text-xs text-muted-foreground">
                          {[row.city, row.state].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                      {row.recommendedNextAction ? (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.recommendedNextAction}</div>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{row.contactName ?? "—"}</div>
                    {row.contactPhone ? <div className="text-xs text-muted-foreground">{row.contactPhone}</div> : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold tabular-nums">{row.callPriorityScore ?? "—"}</span>
                      {row.callPriorityTier ? (
                        <span
                          className={cn(
                            "inline-flex w-fit rounded-full border px-2 py-0.5 text-xs capitalize",
                            tierClass(row.callPriorityTier),
                          )}
                        >
                          {row.callPriorityTier}
                        </span>
                      ) : null}
                      {row.callPriorityOverride != null ? (
                        <span className="text-xs text-muted-foreground">Override {row.callPriorityOverride}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top max-w-xs">
                    <p className="text-sm text-foreground">{row.whySummary}</p>
                    {row.followUpAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">Follow up {formatDate(row.followUpAt)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top max-w-[10rem]">
                    {row.nextBestAction ? (
                      <div>
                        <p className="text-sm font-medium">
                          {GROWTH_NEXT_BEST_ACTION_LABELS[row.nextBestAction as GrowthNextBestAction] ??
                            row.nextBestAction.replace(/_/g, " ")}
                        </p>
                        {row.primaryDecisionMakerName ? (
                          <p className="mt-1 text-xs text-muted-foreground">DM: {row.primaryDecisionMakerName}</p>
                        ) : row.decisionMakerStatus ? (
                          <p className="mt-1 text-xs text-muted-foreground capitalize">
                            {row.decisionMakerStatus.replace(/_/g, " ")}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold tabular-nums">{row.momentumScore ?? "—"}</div>
                    {row.momentumTier ? (
                      <div className="text-xs capitalize text-muted-foreground">{row.momentumTier}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <GrowthWorkflowHealthBadge status={row.workflowHealth as GrowthWorkflowHealthStatus | null} />
                  </td>
                  <td className="px-4 py-3 align-top max-w-[8rem]">
                    <div className="text-sm capitalize">{(row.sourceChannel ?? row.sourceKind).replace(/_/g, " ")}</div>
                    {row.sourceCampaign ? (
                      <div className="text-xs text-muted-foreground truncate">{row.sourceCampaign}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top capitalize">{row.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 align-top">
                    {row.callDisposition ? (
                      <span className="text-xs text-muted-foreground">{DISPOSITION_LABELS[row.callDisposition]}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => onOpenLead(row.leadId)}>
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
            <DialogTitle>Follow up later</DialogTitle>
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
              Save follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
