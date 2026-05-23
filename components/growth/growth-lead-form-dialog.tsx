"use client"

import { useState } from "react"
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
  researchPriority: GrowthLeadResearchPriority
  notes: string
}

const EMPTY_FORM: GrowthLeadFormValues = {
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
  researchPriority: "normal",
  notes: "",
}

type GrowthLeadFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: GrowthLeadFormValues) => Promise<void>
  saving?: boolean
}

export function GrowthLeadFormDialog({
  open,
  onOpenChange,
  onSubmit,
  saving = false,
}: GrowthLeadFormDialogProps) {
  const [form, setForm] = useState<GrowthLeadFormValues>(EMPTY_FORM)

  function updateField<K extends keyof GrowthLeadFormValues>(key: K, value: GrowthLeadFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await onSubmit(form)
    setForm(EMPTY_FORM)
  }

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
            <Button type="submit" disabled={saving || !form.companyName.trim()}>
              {saving ? "Saving…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
