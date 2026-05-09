"use client"

/**
 * Prospect conversion — fast paths into operational records (customer, quote, WO, etc.).
 * Server owns inserts and duplicate-customer avoidance via `converted_customer_id`.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import type { ProspectConversionTarget, ProspectListItem } from "@/lib/prospects/types"

const TARGETS: Array<{ value: ProspectConversionTarget; label: string; hint: string }> = [
  { value: "customer", label: "Customer (won)", hint: "Creates customer + marks prospect won." },
  { value: "quote", label: "Draft quote", hint: "Links customer + draft quote · proposal sent stage." },
  {
    value: "work_order",
    label: "Open work order",
    hint: "Links customer + open WO for scheduling.",
  },
  { value: "equipment", label: "Equipment record", hint: "Stub asset under the customer." },
  {
    value: "customer_location",
    label: "Service location",
    hint: "Requires full address below.",
  },
  {
    value: "opportunity",
    label: "Track opportunity",
    hint: "Creates an internal task + qualifies the prospect.",
  },
]

export type ConvertProspectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: ProspectListItem | null
  onConverted: (result: {
    customerId: string
    customerName: string | null
    convertedAt?: string
    quoteId?: string
    workOrderId?: string
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
  const [target, setTarget] = useState<ProspectConversionTarget>("customer")
  const [locName, setLocName] = useState("")
  const [locAddress, setLocAddress] = useState("")
  const [locCity, setLocCity] = useState("")
  const [locState, setLocState] = useState("")
  const [locZip, setLocZip] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !prospect) return
    setCompany(prospect.company_name)
    setContactName(prospect.contact_name ?? "")
    setEmail(prospect.contact_email ?? "")
    setPhone(prospect.contact_phone ?? "")
    setTarget("customer")
    setLocName(prospect.company_name ? `${prospect.company_name} — Site` : "")
    setLocAddress("")
    setLocCity("")
    setLocState("")
    setLocZip("")
  }, [open, prospect])

  async function handleConvert() {
    if (!prospect) return
    if (!company.trim()) {
      toast({ title: "Company name is required.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        conversion_target: target,
        company_name: company.trim(),
        contact_name: contactName.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
      }
      if (target === "customer_location") {
        body.location = {
          name: locName.trim(),
          address_line1: locAddress.trim(),
          city: locCity.trim(),
          state: locState.trim(),
          postal_code: locZip.trim(),
          is_default: false,
        }
      }

      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )
      const j = (await res.json().catch(() => ({}))) as {
        customer_id?: string
        customer_name?: string | null
        converted_at?: string
        quote_id?: string
        work_order_id?: string
        message?: string
      }
      if (!res.ok || !j.customer_id) {
        throw new Error(j.message ?? "Could not convert prospect.")
      }
      toast({
        title: "Conversion complete",
        description:
          target === "quote" && j.quote_id
            ? `Draft quote ready — open Quotes to finish lines and send.`
            : target === "work_order" && j.work_order_id
              ? `Work order created — schedule from Work orders.`
              : `Linked customer ${j.customer_name ?? company.trim()}.`,
      })
      onConverted({
        customerId: j.customer_id,
        customerName: j.customer_name ?? company.trim(),
        convertedAt: j.converted_at,
        quoteId: j.quote_id,
        workOrderId: j.work_order_id,
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

  const meta = TARGETS.find((t) => t.value === target)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert prospect</DialogTitle>
          <DialogDescription>
            Choose where this lead should land next. We reuse one customer record per prospect so you don&apos;t get
            duplicates — timeline stays on the prospect.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Destination</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as ProspectConversionTarget)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meta ? <p className="text-[11px] text-muted-foreground leading-snug">{meta.hint}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">
                Company <span className="text-destructive">*</span>
              </Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-9 text-sm" />
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

          {target === "customer_location" ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Service location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Location name</Label>
                  <Input value={locName} onChange={(e) => setLocName(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Street</Label>
                  <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input value={locCity} onChange={(e) => setLocCity(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">State</Label>
                  <Input value={locState} onChange={(e) => setLocState(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">ZIP</Label>
                  <Input value={locZip} onChange={(e) => setLocZip(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          ) : null}

          {(target === "quote" || target === "work_order") && (
            <p className="text-[11px] text-muted-foreground">
              After converting, open{" "}
              <Link href={target === "quote" ? "/quotes" : "/work-orders"} className="text-primary underline">
                {target === "quote" ? "Quotes" : "Work orders"}
              </Link>{" "}
              from the nav to continue.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConvert()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Working…
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
