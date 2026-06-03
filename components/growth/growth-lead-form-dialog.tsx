"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
import { GROWTH_LEAD_SOURCE_KINDS, GROWTH_LEAD_STATUSES, GROWTH_LEAD_RESEARCH_PRIORITIES, type GrowthLeadResearchPriority, type GrowthLeadSourceKind, type GrowthLeadStatus } from "@/lib/growth/types"
import type { GrowthRepRosterEntry } from "@/lib/growth/assignment/assignment-types"

export type GrowthLeadFormValues = {
  sourceKind: GrowthLeadSourceKind
  sourceDetail: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  website: string
  city: string
  state: string
  status: GrowthLeadStatus
  assignedTo: string
  researchPriority: GrowthLeadResearchPriority
  notes: string
}

function createEmptyForm(defaultAssignee = ""): GrowthLeadFormValues {
  return {
    sourceKind: "manual",
    sourceDetail: "",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    city: "",
    state: "",
    status: "new",
    assignedTo: defaultAssignee,
    researchPriority: "normal",
    notes: "",
  }
}

type GrowthLeadFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: GrowthLeadFormValues) => Promise<void>
  saving?: boolean
  /** Defaults Assigned To on open; used for "Assign to me". */
  currentUserId?: string | null
}

export function GrowthLeadFormDialog({
  open,
  onOpenChange,
  onSubmit,
  saving = false,
  currentUserId = null,
}: GrowthLeadFormDialogProps) {
  const [form, setForm] = useState<GrowthLeadFormValues>(() => createEmptyForm())
  const [reps, setReps] = useState<GrowthRepRosterEntry[]>([])
  const [loadingReps, setLoadingReps] = useState(false)

  const activeReps = reps.filter((rep) => rep.status !== "inactive")

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
    if (!open) return
    void loadReps()
  }, [open, loadReps])

  useEffect(() => {
    if (!open) return
    setForm(createEmptyForm(""))
  }, [open])

  useEffect(() => {
    if (!open || loadingReps) return
    setForm((prev) => {
      if (prev.assignedTo) return prev
      const defaultAssignee =
        currentUserId && activeReps.some((rep) => rep.userId === currentUserId)
          ? currentUserId
          : activeReps[0]?.userId ?? ""
      return { ...prev, assignedTo: defaultAssignee }
    })
  }, [open, loadingReps, currentUserId, activeReps])

  function updateField<K extends keyof GrowthLeadFormValues>(key: K, value: GrowthLeadFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.assignedTo.trim()) return
    await onSubmit(form)
    setForm(createEmptyForm(currentUserId && activeReps.some((rep) => rep.userId === currentUserId) ? currentUserId : ""))
  }

  const canSubmit = form.companyName.trim().length > 0 && form.assignedTo.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Growth Lead</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="growth-lead-company">Company name *</Label>
              <Input
                id="growth-lead-company"
                value={form.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-source">Source</Label>
              <Select value={form.sourceKind} onValueChange={(value) => updateField("sourceKind", value as GrowthLeadSourceKind)}>
                <SelectTrigger id="growth-lead-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_LEAD_SOURCE_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => updateField("status", value as GrowthLeadStatus)}>
                <SelectTrigger id="growth-lead-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor="growth-lead-assigned-to" className="flex-1">
                  Assigned To *
                </Label>
                {currentUserId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={loadingReps || saving || !activeReps.some((rep) => rep.userId === currentUserId)}
                    onClick={() => updateField("assignedTo", currentUserId)}
                  >
                    Assign to me
                  </Button>
                ) : null}
              </div>
              <Select
                value={form.assignedTo || undefined}
                onValueChange={(value) => updateField("assignedTo", value)}
                disabled={loadingReps || saving || activeReps.length === 0}
                required
              >
                <SelectTrigger id="growth-lead-assigned-to">
                  <SelectValue placeholder={loadingReps ? "Loading reps…" : "Select owner"} />
                </SelectTrigger>
                <SelectContent>
                  {activeReps.map((rep) => (
                    <SelectItem key={rep.userId} value={rep.userId}>
                      {rep.displayName ?? rep.email}
                      {rep.status === "paused" ? " (paused)" : ""}
                      {rep.userId === currentUserId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingReps && activeReps.length === 0 ? (
                <p className="text-xs text-destructive">No active reps available. Configure the sales roster first.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-research-priority">Research priority</Label>
              <Select
                value={form.researchPriority}
                onValueChange={(value) => updateField("researchPriority", value as GrowthLeadResearchPriority)}
              >
                <SelectTrigger id="growth-lead-research-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_LEAD_RESEARCH_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="growth-lead-source-detail">Source detail</Label>
              <Input
                id="growth-lead-source-detail"
                value={form.sourceDetail}
                onChange={(e) => updateField("sourceDetail", e.target.value)}
                placeholder="Conference, referral name, import batch, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-contact-name">Contact name</Label>
              <Input
                id="growth-lead-contact-name"
                value={form.contactName}
                onChange={(e) => updateField("contactName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-contact-email">Contact email</Label>
              <Input
                id="growth-lead-contact-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-contact-phone">Contact phone</Label>
              <Input
                id="growth-lead-contact-phone"
                value={form.contactPhone}
                onChange={(e) => updateField("contactPhone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-website">Website</Label>
              <Input
                id="growth-lead-website"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-city">City</Label>
              <Input id="growth-lead-city" value={form.city} onChange={(e) => updateField("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="growth-lead-state">State</Label>
              <Input id="growth-lead-state" value={form.state} onChange={(e) => updateField("state", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="growth-lead-notes">Notes</Label>
              <Textarea
                id="growth-lead-notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? "Saving…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
