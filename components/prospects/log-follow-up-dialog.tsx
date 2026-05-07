"use client"

/**
 * Leads + Follow-Up Phase 1 — log a follow-up touch on a prospect.
 *
 * Reuses the org-wide `communication_events` log via the
 * `/prospects/{id}/follow-up` endpoint. Channel options match the existing
 * communications schema; "Note" maps to `system` so it shows up on the
 * prospect timeline without sending an email or SMS.
 */

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { PROSPECT_STATUSES, type ProspectListItem, type ProspectStatus } from "@/lib/prospects/types"
import { formatProspectStatus } from "@/lib/prospects/format"

const CHANNEL_OPTIONS: Array<{ value: "system" | "email" | "sms" | "in_app"; label: string }> = [
  { value: "system", label: "Note" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "Call / in person" },
]

export type LogFollowUpDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: ProspectListItem | null
  onLogged: () => void
}

export function LogFollowUpDialog({
  open,
  onOpenChange,
  organizationId,
  prospect,
  onLogged,
}: LogFollowUpDialogProps) {
  const { toast } = useToast()
  const [channel, setChannel] = useState<"system" | "email" | "sms" | "in_app">("system")
  const [summary, setSummary] = useState("")
  const [body, setBody] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [advance, setAdvance] = useState<"keep" | ProspectStatus>("keep")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setChannel("system")
    setSummary("")
    setBody("")
    setNextDate("")
    setAdvance("keep")
  }, [open])

  async function handleSave() {
    if (!prospect) return
    const summaryTrim = summary.trim()
    if (!summaryTrim) {
      toast({ title: "Add a short summary so the timeline reads clearly.", variant: "destructive" })
      return
    }

    const followUpIso = nextDate
      ? new Date(`${nextDate}T17:00:00`).toISOString()
      : null

    setSaving(true)
    try {
      const url = `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/follow-up`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          summary: summaryTrim,
          body: body.trim() || null,
          next_follow_up_at: followUpIso,
          advance_status: advance === "keep" ? undefined : advance,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(j.message ?? "Could not log follow-up.")
      toast({ title: "Follow-up logged" })
      onLogged()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log follow-up</DialogTitle>
          <DialogDescription>
            Record an outreach touch on the prospect timeline. Setting a next follow-up date keeps
            this prospect on the dashboard's overdue / today list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Move pipeline to</Label>
            <Select value={advance} onValueChange={(v) => setAdvance(v as typeof advance)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep current status</SelectItem>
                {PROSPECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatProspectStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">
              Summary <span className="text-destructive">*</span>
            </Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Left voicemail, asked about rooftop unit replacement quote."
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Longer details, decision-makers, blockers, etc."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Next follow-up</Label>
            <Input
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              type="date"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to keep the existing follow-up date (or none).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Logging…
              </>
            ) : (
              "Log follow-up"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
