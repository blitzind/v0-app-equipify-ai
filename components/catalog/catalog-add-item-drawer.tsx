"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

/** Types shown in Add Item — excludes legacy `other`; filters elsewhere may still include it. */
export const ADD_CATALOG_ITEM_TYPES = [
  "equipment",
  "part",
  "labor",
  "service",
  "accessory",
  "rental",
  "kit",
  "option",
] as const

const STATUSES = ["active", "inactive", "discontinued", "needs_review"] as const

type VendorOption = { id: string; name: string }

type VerificationMode = "verified" | "needs_review" | "pending"

export function CatalogAddItemDrawer({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string | null
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [itemType, setItemType] = useState<string>("part")
  const [manufacturerName, setManufacturerName] = useState("")
  const [vendorId, setVendorId] = useState<string>("")
  const [partNumber, setPartNumber] = useState("")
  const [sku, setSku] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("ea")
  const [cost, setCost] = useState("")
  const [salePrice, setSalePrice] = useState("")
  const [taxable, setTaxable] = useState(true)
  const [status, setStatus] = useState<string>("active")
  const [notes, setNotes] = useState("")
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("verified")

  useEffect(() => {
    if (verificationMode === "needs_review") setStatus("needs_review")
  }, [verificationMode])

  const reset = useCallback(() => {
    setName("")
    setDescription("")
    setItemType("part")
    setManufacturerName("")
    setVendorId("")
    setPartNumber("")
    setSku("")
    setCategory("")
    setUnit("ea")
    setCost("")
    setSalePrice("")
    setTaxable(true)
    setStatus("active")
    setNotes("")
    setVerificationMode("verified")
  }, [])

  useEffect(() => {
    if (!open || !organizationId) return
    reset()
    let cancelled = false
    setVendorsLoading(true)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("org_vendors")
        .select("id, name")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("name")
      if (!cancelled) {
        setVendors((data as VendorOption[]) ?? [])
        setVendorsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, reset])

  async function handleSubmit() {
    if (!organizationId) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: "destructive", title: "Item name is required." })
      return
    }

    const costN = cost.trim() ? Number.parseFloat(cost) : null
    const saleN = salePrice.trim() ? Number.parseFloat(salePrice) : null
    if (cost.trim() && (costN == null || Number.isNaN(costN))) {
      toast({ variant: "destructive", title: "Invalid cost." })
      return
    }
    if (salePrice.trim() && (saleN == null || Number.isNaN(saleN))) {
      toast({ variant: "destructive", title: "Invalid sale price." })
      return
    }

    let marginPercent: number | null = null
    if (saleN != null && costN != null && saleN > 0) {
      marginPercent = ((saleN - costN) / saleN) * 100
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/catalog-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          item_type: itemType,
          manufacturer_name: manufacturerName.trim() || null,
          vendor_id: vendorId || null,
          part_number: partNumber.trim(),
          sku: sku.trim() || null,
          category: category.trim(),
          unit: unit.trim() || "ea",
          cost: costN,
          sale_price: saleN,
          list_price: saleN,
          margin_percent: marginPercent,
          taxable,
          status: verificationMode === "needs_review" ? "needs_review" : status,
          notes: notes.trim() || null,
          verification_mode: verificationMode,
        }),
      })
      const body = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not create item",
          description: body.message ?? body.error ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: "Item added to catalog" })
      onOpenChange(false)
      onCreated()
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0 h-full overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 text-left">
          <SheetTitle>Add item</SheetTitle>
          <SheetDescription>
            Create a reusable catalog line for quotes, invoices, work orders, and purchase orders.{" "}
            <span className="text-foreground/90">
              Catalog items are templates — not customer-owned assets (see{" "}
              <Link href="/equipment" className="text-primary underline-offset-2 hover:underline">
                Equipment
              </Link>
              ).
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <Label className="text-xs font-medium">Item name *</Label>
            <Input
              className="mt-1.5 h-9"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual PM — 2 hr labor"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              className="mt-1.5 text-sm min-h-[72px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this line represents on quotes and invoices…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Item type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADD_CATALOG_ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Manufacturer</Label>
              <Input
                className="mt-1.5 h-9"
                value={manufacturerName}
                onChange={(e) => setManufacturerName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Vendor</Label>
              <Select
                value={vendorId || "__none__"}
                onValueChange={(v) => setVendorId(v === "__none__" ? "" : v)}
                disabled={vendorsLoading}
              >
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder={vendorsLoading ? "Loading…" : "Optional"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Part number</Label>
              <Input
                className="mt-1.5 h-9 font-mono text-xs"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">SKU</Label>
              <Input className="mt-1.5 h-9 font-mono text-xs" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Category</Label>
            <Input className="mt-1.5 h-9" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium">Unit</Label>
              <Input className="mt-1.5 h-9" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ea, hr, mo" />
            </div>
            <div>
              <Label className="text-xs font-medium">Cost</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5 h-9 tabular-nums"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Sale price</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5 h-9 tabular-nums"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Taxable</p>
              <p className="text-[11px] text-muted-foreground">Include when calculating tax on invoices.</p>
            </div>
            <Switch checked={taxable} onCheckedChange={setTaxable} />
          </div>

          <div>
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea
              className="mt-1.5 text-sm min-h-[56px] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (not printed on customer docs by default)"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Verification (optional)</Label>
            <Select value={verificationMode} onValueChange={(v) => setVerificationMode(v as VerificationMode)}>
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified — ready to use</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="pending">Pending verification</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              AI confidence is only shown for imported / extracted rows in the item detail view.
            </p>
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-row justify-end gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add item
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
