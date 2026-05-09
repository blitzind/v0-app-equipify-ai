"use client"

/**
 * Leads + Follow-Up Phase 1 — convert prospect to customer dialog.
 *
 * Confirms the destination customer's company / primary contact details
 * before creating the customer record. Pre-fills with the prospect's
 * fields so a one-click convert is the common path. The server route is
 * the source of truth — it handles the customer + contact insert, plan
 * limit gate, and prospect stamping.
 */

import { useEffect, useState } from "react"
import { Loader2, ArrowRight } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import type { ProspectListItem } from "@/lib/prospects/types"

export type ConvertProspectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: ProspectListItem | null
  onConverted: (result: {
    customerId: string
    customerName: string | null
    convertedAt: string
  }) => void
}

export function ConvertProspectDialog({
  open,
  onOpenChange,
  organizationId,
  prospect,
  onConverted,
}: ConvertProspectDialogProps) {
  const { toast } = useToast()
  const [company, setCompany] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !prospect) return
    setCompany(prospect.company_name)
    setContactName(prospect.contact_name ?? "")
    setEmail(prospect.contact_email ?? "")
    setPhone(prospect.contact_phone ?? "")
  }, [open, prospect])

  async function handleConvert() {
    if (!prospect) return
    if (!company.trim()) {
      toast({ title: "Company name is required.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: company.trim(),
            contact_name: contactName.trim() || null,
            contact_email: email.trim() || null,
            contact_phone: phone.trim() || null,
          }),
        },
      )
      const j = (await res.json().catch(() => ({}))) as {
        customer_id?: string
        customer_name?: string | null
        converted_at?: string
        message?: string
      }
      if (!res.ok || !j.customer_id) {
        throw new Error(j.message ?? "Could not convert prospect.")
      }
      toast({
        title: "Prospect converted",
        description: `Created customer ${j.customer_name ?? company.trim()}.`,
      })
      onConverted({
        customerId: j.customer_id,
        customerName: j.customer_name ?? company.trim(),
        convertedAt: j.converted_at ?? new Date().toISOString(),
      })
      onOpenChange(false)
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert prospect to customer</DialogTitle>
          <DialogDescription>
            We&apos;ll create a customer using the existing customers + contacts tables. The original
            prospect stays in your pipeline marked as <strong>Won</strong> with a link to the new
            customer record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Primary contact</Label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConvert()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Converting…
              </>
            ) : (
              <>
                Convert
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
