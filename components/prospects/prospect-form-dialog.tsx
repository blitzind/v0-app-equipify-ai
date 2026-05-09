"use client"

/**
 * Leads + Follow-Up Phase 1 — create / edit prospect dialog.
 *
 * Single component for both flows because the fields are identical:
 *   - new prospect: `prospect` is `null`, dialog posts to /prospects
 *   - edit prospect: `prospect` is set, dialog patches /prospects/[id]
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

export type ProspectFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: ProspectListItem | null
  /** Org members for ownership pickers (optional). */
  assignees?: Array<{ id: string; label: string }>
  onSaved: (prospect: ProspectListItem) => void
}

type FormState = {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  lead_source: string
  status: ProspectStatus
  next_follow_up_at: string
  estimated_value_dollars: string
  notes: string
  assigned_to_user_id: string
  next_action_owner_user_id: string
}

const EMPTY: FormState = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  lead_source: "",
  status: "new",
  next_follow_up_at: "",
  estimated_value_dollars: "",
  notes: "",
  assigned_to_user_id: "",
  next_action_owner_user_id: "",
}

function toLocalDateInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function ProspectFormDialog({
  open,
  onOpenChange,
  organizationId,
  prospect,
  assignees = [],
  onSaved,
}: ProspectFormDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (prospect) {
      setForm({
        company_name: prospect.company_name,
        contact_name: prospect.contact_name ?? "",
        contact_email: prospect.contact_email ?? "",
        contact_phone: prospect.contact_phone ?? "",
        lead_source: prospect.lead_source ?? "",
        status: prospect.status,
        next_follow_up_at: toLocalDateInput(prospect.next_follow_up_at),
        estimated_value_dollars:
          prospect.estimated_value_cents != null
            ? String(Math.round(Number(prospect.estimated_value_cents) / 100))
            : "",
        notes: prospect.notes ?? "",
        assigned_to_user_id: prospect.assigned_to_user_id ?? "",
        next_action_owner_user_id: prospect.next_action_owner_user_id ?? "",
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, prospect])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    const company = form.company_name.trim()
    if (!company) {
      toast({ title: "Company name is required.", variant: "destructive" })
      return
    }

    const cents =
      form.estimated_value_dollars.trim() === ""
        ? null
        : Math.max(0, Math.round(Number(form.estimated_value_dollars) * 100))
    if (cents != null && !Number.isFinite(cents)) {
      toast({ title: "Estimated value must be a number.", variant: "destructive" })
      return
    }

    const followUpIso = form.next_follow_up_at
      ? new Date(`${form.next_follow_up_at}T17:00:00`).toISOString()
      : null

    const payload = {
      company_name: company,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      lead_source: form.lead_source.trim() || null,
      status: form.status,
      next_follow_up_at: followUpIso,
      estimated_value_cents: cents,
      notes: form.notes.trim() || null,
      assigned_to_user_id: form.assigned_to_user_id.trim() || null,
      next_action_owner_user_id: form.next_action_owner_user_id.trim() || null,
    }

    setSaving(true)
    try {
      const baseUrl = `/api/organizations/${encodeURIComponent(organizationId)}/prospects`
      const res = await fetch(prospect ? `${baseUrl}/${encodeURIComponent(prospect.id)}` : baseUrl, {
        method: prospect ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = (await res.json().catch(() => ({}))) as {
        prospect?: ProspectListItem
        message?: string
      }
      if (!res.ok || !j.prospect) {
        throw new Error(j.message ?? "Could not save prospect.")
      }
      toast({ title: prospect ? "Prospect updated" : "Prospect created" })
      onSaved(j.prospect)
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
          <DialogTitle>{prospect ? "Edit prospect" : "New prospect"}</DialogTitle>
          <DialogDescription>
            Track inbound leads through the pipeline. Convert promising prospects into customers
            from the prospect drawer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="Acme Co"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact name</Label>
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              placeholder="Jordan Smith"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lead source</Label>
            <Input
              value={form.lead_source}
              onChange={(e) => set("lead_source", e.target.value)}
              placeholder="Referral, website, trade show…"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              value={form.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              placeholder="hello@example.com"
              type="email"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
              placeholder="(555) 555-1212"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as ProspectStatus)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROSPECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatProspectStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next follow-up</Label>
            <Input
              value={form.next_follow_up_at}
              onChange={(e) => set("next_follow_up_at", e.target.value)}
              type="date"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Estimated value (USD)</Label>
            <Input
              value={form.estimated_value_dollars}
              onChange={(e) => set("estimated_value_dollars", e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 5000"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="What do they need? Pain points? Decision-maker?"
            />
          </div>
          {assignees.length > 0 ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned rep</Label>
                <Select
                  value={form.assigned_to_user_id || "__none__"}
                  onValueChange={(v) => set("assigned_to_user_id", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {assignees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Next action owner</Label>
                <Select
                  value={form.next_action_owner_user_id || "__none__"}
                  onValueChange={(v) => set("next_action_owner_user_id", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Same as assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {assignees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…
              </>
            ) : prospect ? (
              "Save changes"
            ) : (
              "Create prospect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
