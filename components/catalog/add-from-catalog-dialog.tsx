"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type CatalogListItemRow,
  snapshotPurchaseUnitPriceDollars,
  snapshotSaleUnitPriceDollars,
} from "@/lib/catalog/catalog-line-snapshots"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

const ITEM_TYPE_FILTERS = [
  "all",
  "equipment",
  "part",
  "labor",
  "service",
  "accessory",
  "rental",
  "kit",
  "option",
  "other",
] as const

function coerceCatalogRow(raw: Record<string, unknown>): CatalogListItemRow | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  if (!id) return null
  const num = (k: string) => {
    const v = raw[k]
    return typeof v === "number" && Number.isFinite(v) ? v : null
  }
  const str = (k: string) => {
    const v = raw[k]
    return typeof v === "string" ? v : null
  }
  return {
    id,
    name: str("name"),
    description: str("description"),
    sku: str("sku"),
    part_number: str("part_number"),
    item_type: str("item_type"),
    unit: str("unit"),
    category: str("category"),
    list_price: num("list_price"),
    sale_price: num("sale_price"),
    cost: num("cost"),
  }
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

function skuLine(row: CatalogListItemRow): string {
  const s = (row.sku ?? "").trim()
  const p = (row.part_number ?? "").trim()
  if (s && p && s !== p) return `${s} · ${p}`
  return s || p || "—"
}

export interface AddFromCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string | null
  /** Fired for each quick-add; parent copies snapshot fields onto transactional lines. */
  onPick: (row: CatalogListItemRow, quantity: number) => void
  /** PO lines use cost-oriented snapshot pricing from `buildPurchaseOrderLineFromCatalog`. */
  pricingMode?: "sale" | "purchase"
}

export function AddFromCatalogDialog({
  open,
  onOpenChange,
  organizationId,
  onPick,
  pricingMode = "sale",
}: AddFromCatalogDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [items, setItems] = useState<CatalogListItemRow[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [defaultQty, setDefaultQty] = useState("1")

  const load = useCallback(async () => {
    if (!organizationId || !open) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/organizations/${organizationId}/catalog-items?limit=500`)
      const json = (await res.json()) as { items?: unknown[]; error?: string }
      if (!res.ok) {
        setItems([])
        setLoadError(json?.error ?? "Could not load catalog.")
        return
      }
      const rows = (json.items ?? [])
        .map((it) => coerceCatalogRow(it as Record<string, unknown>))
        .filter((r): r is CatalogListItemRow => Boolean(r))
      setItems(rows)
    } catch {
      setItems([])
      setLoadError("Could not load catalog.")
    } finally {
      setLoading(false)
    }
  }, [organizationId, open])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setTypeFilter("all")
      setCategoryFilter("all")
    }
  }, [open])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const raw of items) {
      const cat = raw.category
      if (typeof cat === "string" && cat.trim()) set.add(cat.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((row) => {
      if (typeFilter !== "all") {
        const t = (row.item_type ?? "").toLowerCase()
        if (t !== typeFilter.toLowerCase()) return false
      }
      if (categoryFilter !== "all") {
        const cat = row.category
        if ((typeof cat === "string" ? cat.trim() : "") !== categoryFilter) return false
      }
      if (!q) return true
      const hay = [
        row.name,
        row.description,
        row.sku,
        row.part_number,
        row.item_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, search, typeFilter, categoryFilter])

  function handleQuickAdd(row: CatalogListItemRow) {
    const qty = Math.max(1, Math.floor(Number.parseFloat(defaultQty) || 1))
    onPick(row, qty)
    toast({
      title: "Added from catalog",
      description: (row.name ?? "").trim() || "Line updated",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>Add from catalog</DialogTitle>
          <DialogDescription>
            Search your item library. Amounts are copied onto the document as a snapshot — later catalog price changes do not alter saved quotes, invoices, work orders, or POs.
            {pricingMode === "purchase" ? " Purchase lines prefer catalog cost when present." : null}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 shrink-0 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, description…"
                className="pl-9"
                aria-label="Search catalog"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPE_FILTERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "all" ? "All types" : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={defaultQty}
                  onChange={(e) => setDefaultQty(e.target.value)}
                  className="w-[72px] h-9 text-right"
                  aria-label="Quantity for add"
                />
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[240px] max-h-[min(420px,50vh)] px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading catalog…
            </div>
          ) : loadError ? (
            <p className="py-12 text-center text-sm text-destructive">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No matching catalog items.</p>
          ) : (
            <div className="pr-4 pb-4 space-y-2">
              {filtered.map((row) => {
                const type = (row.item_type ?? "").trim() || "other"
                const unit = (row.unit ?? "").trim()
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border px-3 py-2.5",
                      "bg-muted/20 hover:bg-muted/35 transition-colors",
                    )}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {(row.name ?? "").trim() || "Untitled item"}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-normal capitalize shrink-0">
                          {type}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{skuLine(row)}</p>
                      {(row.description ?? "").trim() ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">{(row.description ?? "").trim()}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end shrink-0">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {unit ? `${unit}` : "—"}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {fmtMoney(
                          pricingMode === "purchase"
                            ? snapshotPurchaseUnitPriceDollars(row)
                            : snapshotSaleUnitPriceDollars(row),
                        )}
                      </span>
                      <Button type="button" size="sm" className="shrink-0" onClick={() => handleQuickAdd(row)}>
                        Add
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
