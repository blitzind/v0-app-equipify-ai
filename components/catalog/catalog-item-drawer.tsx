"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Loader2,
  Package,
  DollarSign,
  Puzzle,
  BarChart3,
  Paperclip,
  Sparkles,
  ExternalLink,
  Archive,
  Upload,
} from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getCatalogAiStatusLabel } from "@/lib/catalog/catalog-ai-status"
import type { CatalogCompatibility } from "@/lib/catalog/catalog-compatibility"
import { DetailDrawer } from "@/components/detail-drawer"
import { DRAWER_NESTED_CARD } from "@/components/detail-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cnDrawerTabButton } from "@/components/ui/tabs-chrome"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { AttachmentTypeIcon } from "@/components/attachments/attachment-preview"
import { attachmentKindLabel, displayAttachmentFileName } from "@/lib/attachments/attachment-media-kind"

type CatalogDetail = {
  id: string
  name: string
  part_number: string
  sku: string | null
  manufacturer_name: string | null
  vendor_id: string | null
  vendor_name: string | null
  category: string
  item_type: string
  status: string
  description: string | null
  notes: string | null
  list_price: number | null
  cost: number | null
  sale_price: number | null
  margin_percent: number | null
  unit: string
  taxable?: boolean | null
  effective_date: string | null
  price_source: string | null
  replacement_part_number: string | null
  discontinued_replacement_notes: string | null
  confidence_score: number | null
  ai_generated: boolean | null
  ai_confidence: number | null
  human_verified_at: string | null
  source_file_name: string | null
  source_import_id: string | null
  source_type?: string | null
  archived_at: string | null
  compatibility: CatalogCompatibility
}

const ITEM_TYPES = [
  "equipment",
  "part",
  "accessory",
  "service",
  "labor",
  "rental",
  "option",
  "kit",
  "other",
] as const

const STATUSES = ["active", "inactive", "discontinued", "needs_review"] as const

const FILE_CATEGORIES = [
  { value: "price_sheet", label: "Price sheet" },
  { value: "manual", label: "Manual" },
  { value: "spec_sheet", label: "Spec sheet" },
  { value: "warranty", label: "Warranty" },
  { value: "manufacturer_doc", label: "Manufacturer docs" },
  { value: "other", label: "Other" },
] as const

function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n))
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00")
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type TabId = "overview" | "pricing" | "compatibility" | "usage" | "files" | "ai"

export function CatalogItemDrawer({
  organizationId,
  itemId,
  open,
  onClose,
  canManage,
  onUpdated,
}: {
  organizationId: string
  itemId: string | null
  open: boolean
  onClose: () => void
  canManage: boolean
  onUpdated?: () => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<TabId>("overview")
  const [loading, setLoading] = useState(false)
  const [item, setItem] = useState<CatalogDetail | null>(null)
  const [draft, setDraft] = useState<Partial<CatalogDetail>>({})
  const [saving, setSaving] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const [usageLoading, setUsageLoading] = useState(false)
  const [usage, setUsage] = useState<{
    quotes: Array<{ id: string; quote_number: string; title: string; created_at: string; line_total: number }>
    invoices: Array<{ id: string; invoice_number: string; title: string; issued_at: string; line_total: number }>
    purchase_orders: Array<{ id: string; purchase_order_number: string; order_date: string | null; line_cost: number }>
    work_orders: Array<{
      id: string
      work_order_id: string
      work_order_number: number | null
      title: string
      line_cost: number
      created_at: string
    }>
    last_used_at: string | null
    lifetime_revenue: number
    lifetime_cost: number
  } | null>(null)

  const [attachments, setAttachments] = useState<
    Array<{ id: string; file_name: string; category: string; uploaded_at: string; storage_path: string }>
  >([])
  const [attachUploading, setAttachUploading] = useState(false)
  const [fileCategory, setFileCategory] = useState<string>("manual")

  const loadItem = useCallback(async () => {
    if (!itemId || !organizationId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as { item?: CatalogDetail; message?: string }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not load item", description: body.message })
        setItem(null)
        return
      }
      const it = body.item!
      setItem(it)
      setDraft({
        name: it.name,
        part_number: it.part_number,
        sku: it.sku,
        manufacturer_name: it.manufacturer_name,
        category: it.category,
        item_type: it.item_type,
        status: it.status,
        description: it.description,
        notes: it.notes,
        list_price: it.list_price,
        cost: it.cost,
        sale_price: it.sale_price,
        unit: it.unit,
        taxable: it.taxable,
        effective_date: it.effective_date,
        replacement_part_number: it.replacement_part_number,
        discontinued_replacement_notes: it.discontinued_replacement_notes,
        compatibility: it.compatibility,
      })
    } finally {
      setLoading(false)
    }
  }, [itemId, organizationId, toast])

  const loadUsage = useCallback(async () => {
    if (!itemId || !organizationId) return
    setUsageLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}/usage`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as { usage?: typeof usage }
      if (res.ok && body.usage) setUsage(body.usage)
      else setUsage(null)
    } finally {
      setUsageLoading(false)
    }
  }, [itemId, organizationId])

  const loadAttachments = useCallback(async () => {
    if (!itemId || !organizationId) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}/attachments`,
      { cache: "no-store" },
    )
    const body = (await res.json()) as { attachments?: typeof attachments }
    if (res.ok) setAttachments(body.attachments ?? [])
  }, [itemId, organizationId])

  useEffect(() => {
    if (!open || !itemId) return
    void loadItem()
    setTab("overview")
  }, [open, itemId, loadItem])

  useEffect(() => {
    if (!open || !itemId || tab !== "usage") return
    void loadUsage()
  }, [open, itemId, tab, loadUsage])

  useEffect(() => {
    if (!open || !itemId || tab !== "files") return
    void loadAttachments()
  }, [open, itemId, tab, loadAttachments])

  const marginDisplay = useMemo(() => {
    const sale = draft.sale_price ?? item?.sale_price
    const cost = draft.cost ?? item?.cost
    if (sale == null || cost == null) return "—"
    if (sale <= 0) return "—"
    return `${(((Number(sale) - Number(cost)) / Number(sale)) * 100).toFixed(1)}%`
  }, [draft.sale_price, draft.cost, item?.sale_price, item?.cost])

  async function patch(payload: Record<string, unknown>) {
    if (!itemId || !organizationId || !canManage) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const body = (await res.json()) as { message?: string }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Save failed", description: body.message })
        return
      }
      await loadItem()
      onUpdated?.()
      toast({ title: "Saved", description: "Catalog item updated." })
    } finally {
      setSaving(false)
    }
  }

  async function patchVerification(action: "verify" | "needs_review") {
    if (!itemId || !organizationId) return
    setVerifyingId(itemId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}/verification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        toast({ variant: "destructive", title: "Update failed", description: body.message })
        return
      }
      await loadItem()
      onUpdated?.()
      toast({ title: action === "verify" ? "Marked verified" : "Flagged for review" })
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleAttachmentUpload(fileList: FileList | null) {
    if (!fileList?.length || !itemId || !organizationId || !canManage) return
    setAttachUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]!
        const fd = new FormData()
        fd.append("file", file)
        fd.append("category", fileCategory)
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(itemId)}/attachments`,
          { method: "POST", body: fd },
        )
        if (!res.ok) {
          const body = (await res.json()) as { message?: string }
          toast({ variant: "destructive", title: "Upload failed", description: body.message })
          return
        }
      }
      toast({ title: "Upload complete" })
      await loadAttachments()
    } finally {
      setAttachUploading(false)
    }
  }

  async function signedDownload(path: string) {
    const supabase = createBrowserSupabaseClient()
    const { data, error } = await supabase.storage.from("catalog-item-files").createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: "Could not download", description: error?.message })
      return
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  const aiLabel = item
    ? getCatalogAiStatusLabel({
        ai_generated: Boolean(item.ai_generated),
        ai_confidence: item.ai_confidence,
        confidence_score: item.confidence_score,
        human_verified_at: item.human_verified_at,
      })
    : null

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Package className="w-3.5 h-3.5" /> },
    { id: "pricing", label: "Pricing", icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: "compatibility", label: "Compatibility", icon: <Puzzle className="w-3.5 h-3.5" /> },
    { id: "usage", label: "Usage", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "files", label: "Files", icon: <Paperclip className="w-3.5 h-3.5" /> },
    { id: "ai", label: "AI / Import", icon: <Sparkles className="w-3.5 h-3.5" /> },
  ]

  const compat = draft.compatibility ?? item?.compatibility ?? {}
  const modelsStr = (compat.equipment_models ?? []).join(", ")
  const mfgStr = (compat.manufacturers ?? []).join(", ")
  const relatedStr = (compat.related_catalog_item_ids ?? []).join(", ")

  return (
    <DetailDrawer
      open={open && Boolean(itemId)}
      onClose={onClose}
      title={item?.name || "Catalog item"}
      subtitle={
        item
          ? [item.part_number || null, item.manufacturer_name || null].filter(Boolean).join(" · ") || undefined
          : undefined
      }
      width="2xl"
      noScroll
      badge={
        item?.archived_at ? (
          <Badge variant="outline" className="text-[10px]">
            Archived
          </Badge>
        ) : null
      }
      actions={
        item ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
              <Link href={`/quotes?catalogItem=${encodeURIComponent(item.id)}`}>Add to quote</Link>
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
              <Link href={`/invoices?catalogItem=${encodeURIComponent(item.id)}`}>Add to invoice</Link>
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
              <Link href={`/work-orders?catalogItem=${encodeURIComponent(item.id)}`}>Add to work order</Link>
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
              <Link href={`/purchase-orders?catalogItem=${encodeURIComponent(item.id)}`}>Add to PO</Link>
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href="/equipment">Equipment assets</Link>
            </Button>
            {canManage ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => void patch({ archived: !item.archived_at })}
                disabled={saving}
              >
                <Archive className="w-3.5 h-3.5" />
                {item.archived_at ? "Restore" : "Archive"}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {loading || !item ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div
            className={cn(
              "flex flex-nowrap overflow-x-auto gap-1 border-b border-border px-2 py-2 shrink-0",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cnDrawerTabButton(tab === t.id, "gap-1.5")}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {tab === "overview" && (
              <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-4")}>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {(item.source_type ?? "manual") === "imported" && "Imported from a price list · "}
                  {(item.source_type ?? "manual") === "ai_generated" && "AI-sourced row · "}
                  {(item.source_type ?? "manual") === "manual" && "Manual library item · "}
                  Reusable template for quotes and jobs — not a customer-owned equipment record.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Item name</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={draft.name ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Part number / SKU</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        className="h-9 text-sm flex-1 font-mono text-xs"
                        placeholder="Part #"
                        value={draft.part_number ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, part_number: e.target.value }))}
                        disabled={!canManage}
                      />
                      <Input
                        className="h-9 text-sm w-28 font-mono text-xs"
                        placeholder="SKU"
                        value={draft.sku ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value || null }))}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Manufacturer</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={draft.manufacturer_name ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, manufacturer_name: e.target.value || null }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vendor</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      readOnly
                      value={item.vendor_name ?? "—"}
                      disabled
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={draft.category ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Item type</Label>
                    <Select
                      value={(draft.item_type ?? item.item_type) || "other"}
                      onValueChange={(v) => setDraft((d) => ({ ...d, item_type: v }))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={(draft.status ?? item.status) || "active"}
                      onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1 h-9 text-sm">
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
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[72px]"
                    value={draft.description ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[56px]"
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))}
                    disabled={!canManage}
                  />
                </div>
                {canManage ? (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void patch({
                          name: draft.name,
                          part_number: draft.part_number,
                          sku: draft.sku,
                          manufacturer_name: draft.manufacturer_name,
                          category: draft.category,
                          item_type: draft.item_type,
                          status: draft.status,
                          description: draft.description,
                          notes: draft.notes,
                        })
                      }
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save overview"}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "pricing" && (
              <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-4")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">List price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 h-9 text-sm tabular-nums"
                      value={draft.list_price ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          list_price: e.target.value === "" ? null : Number.parseFloat(e.target.value),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 h-9 text-sm tabular-nums"
                      value={draft.cost ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          cost: e.target.value === "" ? null : Number.parseFloat(e.target.value),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sale price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 h-9 text-sm tabular-nums"
                      value={draft.sale_price ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          sale_price: e.target.value === "" ? null : Number.parseFloat(e.target.value),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Margin</Label>
                    <Input className="mt-1 h-9 text-sm tabular-nums" readOnly value={marginDisplay} disabled />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={draft.taxable ?? item.taxable ?? true}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, taxable: v }))}
                      disabled={!canManage}
                    />
                    <span className="text-sm">Taxable</span>
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Input
                      className="mt-1 h-9 text-sm"
                      value={draft.unit ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Effective date</Label>
                    <Input
                      type="date"
                      className="mt-1 h-9 text-sm"
                      value={(draft.effective_date ?? item.effective_date ?? "").slice(0, 10)}
                      onChange={(e) => setDraft((d) => ({ ...d, effective_date: e.target.value || null }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Price source / import source</Label>
                    <Input className="mt-1 h-9 text-sm" readOnly value={item.price_source ?? item.source_file_name ?? "—"} />
                  </div>
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() =>
                        void patch({
                          list_price: draft.list_price,
                          cost: draft.cost,
                          sale_price: draft.sale_price,
                          taxable: draft.taxable,
                          unit: draft.unit,
                          effective_date: draft.effective_date,
                        })
                      }
                      disabled={saving}
                    >
                      Save pricing
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "compatibility" && (
              <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-3")}>
                <p className="text-xs text-muted-foreground">
                  Templates for reuse — not customer-owned assets. Use Equipment for installed assets with serial numbers.
                </p>
                <div>
                  <Label className="text-xs">Compatible equipment models (comma-separated)</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[56px]"
                    value={modelsStr}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        compatibility: {
                          ...compat,
                          equipment_models: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label className="text-xs">Compatible manufacturers (comma-separated)</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[56px]"
                    value={mfgStr}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        compatibility: {
                          ...compat,
                          manufacturers: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label className="text-xs">Related catalog items (UUIDs, comma-separated)</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[56px] font-mono text-xs"
                    value={relatedStr}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        compatibility: {
                          ...compat,
                          related_catalog_item_ids: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label className="text-xs">Replacement part number</Label>
                  <Input
                    className="mt-1 h-9 text-sm font-mono text-xs"
                    value={draft.replacement_part_number ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, replacement_part_number: e.target.value || null }))}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <Label className="text-xs">Discontinued replacement notes</Label>
                  <Textarea
                    className="mt-1 text-sm min-h-[56px]"
                    value={draft.discontinued_replacement_notes ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, discontinued_replacement_notes: e.target.value || null }))
                    }
                    disabled={!canManage}
                  />
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() =>
                        void patch({
                          compatibility: draft.compatibility ?? compat,
                          replacement_part_number: draft.replacement_part_number,
                          discontinued_replacement_notes: draft.discontinued_replacement_notes,
                        })
                      }
                      disabled={saving}
                    >
                      Save compatibility
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "usage" && (
              <div className="space-y-4">
                {usageLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading usage…
                  </div>
                ) : usage ? (
                  <>
                    <div className={cn(DRAWER_NESTED_CARD, "p-4 grid sm:grid-cols-3 gap-3 text-sm")}>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Last used</p>
                        <p className="font-medium tabular-nums">{fmtDate(usage.last_used_at)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Lifetime revenue (invoiced)</p>
                        <p className="font-medium tabular-nums">{fmtMoney(usage.lifetime_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Lifetime cost (PO + WO parts)</p>
                        <p className="font-medium tabular-nums">{fmtMoney(usage.lifetime_cost)}</p>
                      </div>
                    </div>
                    <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
                      <p className="text-xs font-semibold mb-2">Quotes</p>
                      {usage.quotes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No quote lines reference this catalog item yet.</p>
                      ) : (
                        <ul className="text-xs space-y-1">
                          {usage.quotes.map((q) => (
                            <li key={q.id} className="flex justify-between gap-2">
                              <Link href={`/quotes?open=${q.id}`} className="text-primary hover:underline truncate">
                                {q.quote_number} — {q.title}
                              </Link>
                              <span className="tabular-nums text-muted-foreground">{fmtMoney(q.line_total)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
                      <p className="text-xs font-semibold mb-2">Invoices</p>
                      {usage.invoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None yet.</p>
                      ) : (
                        <ul className="text-xs space-y-1">
                          {usage.invoices.map((inv) => (
                            <li key={inv.id} className="flex justify-between gap-2">
                              <Link href={`/invoices?open=${inv.id}`} className="text-primary hover:underline truncate">
                                {inv.invoice_number} — {inv.title}
                              </Link>
                              <span className="tabular-nums text-muted-foreground">{fmtMoney(inv.line_total)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
                      <p className="text-xs font-semibold mb-2">Work orders</p>
                      {usage.work_orders.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None yet.</p>
                      ) : (
                        <ul className="text-xs space-y-1">
                          {usage.work_orders.map((w) => (
                            <li key={w.id} className="flex justify-between gap-2">
                              <Link
                                href={`/work-orders?open=${w.work_order_id}`}
                                className="text-primary hover:underline truncate"
                              >
                                WO-{w.work_order_number ?? "?"} — {w.title}
                              </Link>
                              <span className="tabular-nums text-muted-foreground">{fmtMoney(w.line_cost)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
                      <p className="text-xs font-semibold mb-2">Purchase orders</p>
                      {usage.purchase_orders.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None yet.</p>
                      ) : (
                        <ul className="text-xs space-y-1">
                          {usage.purchase_orders.map((p) => (
                            <li key={p.id} className="flex justify-between gap-2">
                              <Link href={`/purchase-orders?open=${p.id}`} className="text-primary hover:underline">
                                {p.purchase_order_number}
                              </Link>
                              <span className="tabular-nums text-muted-foreground">{fmtMoney(p.line_cost)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Could not load usage.</p>
                )}
              </div>
            )}

            {tab === "files" && (
              <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-4")}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs">Category</Label>
                    <Select value={fileCategory} onValueChange={setFileCategory}>
                      <SelectTrigger className="mt-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {canManage ? (
                    <>
                      <input
                        id="catalog-item-file-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        disabled={attachUploading}
                        onChange={(e) => void handleAttachmentUpload(e.target.files)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-9 gap-1"
                        disabled={attachUploading}
                        onClick={() => document.getElementById("catalog-item-file-upload")?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {attachUploading ? "Uploading…" : "Upload"}
                      </Button>
                    </>
                  ) : null}
                </div>
                <ul className="space-y-2 text-sm">
                  {attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
                      No files attached to this catalog item.
                    </div>
                  ) : (
                    attachments.map((a) => {
                      const label = displayAttachmentFileName(a.file_name)
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 bg-muted/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AttachmentTypeIcon mimeType="" fileName={a.file_name} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground" title={a.file_name}>
                                {label}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {attachmentKindLabel("", a.file_name)} · {a.category.replace(/_/g, " ")} ·{" "}
                                {fmtDate(a.uploaded_at)}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-8 gap-1"
                            aria-label={`Open ${label}`}
                            onClick={() => void signedDownload(a.storage_path)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                            Open
                          </Button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            )}

            {tab === "ai" && (
              <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-3 text-sm")}>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground">AI status:</span>
                  {aiLabel ? (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {aiLabel.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Confidence (extracted)</p>
                    <p className="font-mono tabular-nums">
                      {item.confidence_score != null ? `${(Number(item.confidence_score) * 100).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">AI confidence</p>
                    <p className="font-mono tabular-nums">
                      {item.ai_confidence != null ? `${(Number(item.ai_confidence) * 100).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Human verification</p>
                    <p>{item.human_verified_at ? fmtDate(item.human_verified_at) : "Not verified"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Source price list</p>
                    <p className="break-all">{item.source_file_name || "—"}</p>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={verifyingId === item.id}
                      onClick={() => void patchVerification("verify")}
                    >
                      Mark verified
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={verifyingId === item.id}
                      onClick={() => void patchVerification("needs_review")}
                    >
                      Needs review
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}
