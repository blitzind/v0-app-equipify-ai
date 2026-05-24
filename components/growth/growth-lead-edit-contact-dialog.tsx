"use client"

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
import { GROWTH_LEAD_SOURCE_KINDS, type GrowthLead } from "@/lib/growth/types"
import { friendlyLeadContactValidationError } from "@/lib/growth/lead-contact-validation"

type GrowthLeadEditContactDialogProps = {
  lead: GrowthLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (lead: GrowthLead) => void
}

export function GrowthLeadEditContactDialog({
  lead,
  open,
  onOpenChange,
  onSaved,
}: GrowthLeadEditContactDialogProps) {
  const [companyName, setCompanyName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [sourceKind, setSourceKind] = useState<GrowthLead["sourceKind"]>("manual")
  const [sourceChannel, setSourceChannel] = useState("")
  const [sourceCampaign, setSourceCampaign] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lead || !open) return
    setCompanyName(lead.companyName)
    setContactName(lead.contactName ?? "")
    setContactEmail(lead.contactEmail ?? "")
    setContactPhone(lead.contactPhone ?? "")
    setWebsite(lead.website ?? "")
    setSourceKind(lead.sourceKind)
    setSourceChannel(lead.sourceChannel ?? "")
    setSourceCampaign(lead.sourceCampaign ?? "")
    setNotes(lead.notes ?? "")
    setError(null)
  }, [lead, open])

  async function save() {
    if (!lead) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          website: website.trim() || null,
          sourceKind,
          sourceChannel: sourceChannel.trim() || null,
          sourceCampaign: sourceCampaign.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? friendlyLeadContactValidationError("unknown"))
      }
      onSaved(data.lead)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : friendlyLeadContactValidationError("unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Contact Info</DialogTitle>
          <DialogDescription>Update core contact fields for this Growth lead.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="edit-company">Company name</Label>
            <Input id="edit-company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-contact">Primary contact</Label>
              <Input id="edit-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input id="edit-website" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-source-kind">Source kind</Label>
              <select
                id="edit-source-kind"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={sourceKind}
                onChange={(event) => setSourceKind(event.target.value as GrowthLead["sourceKind"])}
              >
                {GROWTH_LEAD_SOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source-channel">Source channel</Label>
              <Input id="edit-source-channel" value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-source-campaign">Campaign</Label>
            <Input id="edit-source-campaign" value={sourceCampaign} onChange={(event) => setSourceCampaign(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Lead notes</Label>
            <Textarea id="edit-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !companyName.trim()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
