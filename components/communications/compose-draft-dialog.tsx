"use client"

/**
 * Communications Phase 2 — compose-draft dialog.
 *
 * Manager-facing UI to capture a draft communication. Posts to the
 * `/communications/drafts` endpoint which writes a `pending` row
 * with `metadata.is_draft = true`. **No automatic provider send
 * happens.** The draft becomes visible in the Phase 1 feed (and
 * embedded entity cards) where a future phase can hand it off to
 * the appropriate live send route (invoice / quote / WO summary /
 * prospect follow-up). Phase 2 stays read-only on the wire — this
 * is purely a "save for later" workflow.
 *
 * Permission: `canManageCommunications` (gated on the server too).
 */

import { useEffect, useState } from "react"
import { Loader2, NotebookPen } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { RelatedEntityType } from "@/lib/notifications/types"

type RelatedTypeOption =
  | "none"
  | "work_order"
  | "invoice"
  | "quote"
  | "customer"
  | "prospect"
  | "equipment"
  | "maintenance_plan"

export type ComposeDraftPrefill = {
  subject?: string
  body?: string
  summary?: string
  recipientAddress?: string
  recipientCustomerId?: string
  relatedEntityType?: RelatedEntityType
  relatedEntityId?: string
}

export function ComposeDraftDialog({
  open,
  onOpenChange,
  organizationId,
  prefill,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  organizationId: string
  prefill?: ComposeDraftPrefill
  onSaved?: () => void
}) {
  const { toast } = useToast()

  const [channel, setChannel] = useState<"email" | "sms" | "in_app" | "system">("email")
  const [subject, setSubject] = useState("")
  const [summary, setSummary] = useState("")
  const [body, setBody] = useState("")
  const [recipient, setRecipient] = useState("")
  const [relatedType, setRelatedType] = useState<RelatedTypeOption>("none")
  const [relatedId, setRelatedId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setChannel("email")
    setSubject(prefill?.subject ?? "")
    setSummary(prefill?.summary ?? "")
    setBody(prefill?.body ?? "")
    setRecipient(prefill?.recipientAddress ?? "")
    setRelatedType(prefill?.relatedEntityType ?? "none")
    setRelatedId(prefill?.relatedEntityId ?? "")
  }, [open, prefill])

  async function save() {
    if (subject.trim().length < 2) {
      toast({ title: "Subject required", description: "Add a short subject (≥ 2 characters).", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/communications/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            subject,
            summary: summary || null,
            body: body || null,
            recipientAddress: recipient || null,
            recipientCustomerId: prefill?.recipientCustomerId ?? null,
            relatedEntityType: relatedType === "none" ? null : relatedType,
            relatedEntityId: relatedType === "none" ? null : relatedId || null,
          }),
        },
      )
      const out = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) throw new Error(out.message ?? out.error ?? "Save failed")
      toast({ title: "Draft saved", description: out.message })
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      toast({
        title: "Could not save draft",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-primary" aria-hidden />
            Compose draft communication
          </DialogTitle>
          <DialogDescription className="text-xs">
            Saves a draft into the Communications feed. Equipify never auto-sends drafts —
            forward them through the existing email / send flow when you&apos;re ready.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS (logged only)</SelectItem>
                  <SelectItem value="in_app">In-app</SelectItem>
                  <SelectItem value="system">System note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Recipient (optional)</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="email@customer.com"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Follow-up on quote"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Summary (one line, optional)</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Internal note shown in the feed list"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Body</Label>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Draft your message…"
            />
          </div>
          {!prefill?.relatedEntityType ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Link to</Label>
                <Select value={relatedType} onValueChange={(v) => setRelatedType(v as RelatedTypeOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No link</SelectItem>
                    <SelectItem value="work_order">Work order</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="maintenance_plan">Maintenance plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Record id</Label>
                <Input
                  value={relatedId}
                  onChange={(e) => setRelatedId(e.target.value)}
                  placeholder="UUID (optional)"
                  disabled={relatedType === "none"}
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
