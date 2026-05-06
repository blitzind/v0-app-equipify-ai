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
      <DialogContent
        showCloseButton
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "h-[min(92vh,900px)] max-h-[min(92vh,900px)] max-sm:h-[100dvh] max-sm:max-h-[100dvh]",
          "w-[calc(100vw-1rem)] max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0",
          "max-sm:inset-x-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:right-0",
          // Override dialog default sm:max-w-lg — wide catalog workspace (quotes / nested modals)
          "sm:!max-w-[min(1240px,calc(100vw-2rem))]",
        )}
      >
        <DialogHeader className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6 border-b border-border shrink-0 bg-background">
          <DialogTitle>Add from catalog</DialogTitle>
          <DialogDescription className="text-pretty">
            Search your item library. Amounts are copied onto the document as a snapshot — later catalog price changes do not alter saved quotes, invoices, work orders, or POs.
            {pricingMode === "purchase" ? " Purchase lines prefer catalog cost when present." : null}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-x-hidden [&>[data-slot=scroll-area-viewport]]:overflow-x-hidden">
          <div className="flex min-h-full flex-col">
            {/* Sticky toolbar: search + filters stay visible while scrolling the list */}
            <div
              className={cn(
                "sticky top-0 z-10 shrink-0 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80",
                "sm:px-6",
              )}
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, SKU, description…"
                    className="h-10 w-full min-w-0 pl-9"
                    aria-label="Search catalog"
                  />
                </div>
                <div className="flex min-w-0 flex-wrap gap-3 sm:gap-2 lg:flex-nowrap lg:justify-end lg:gap-3">
                  <div className="min-w-[9.5rem] flex-1 sm:flex-initial">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="mt-1 h-10 w-full min-w-0 sm:w-[148px]">
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
                  <div className="min-w-[11rem] flex-1 sm:flex-initial">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="mt-1 h-10 w-full min-w-0 sm:w-[168px]">
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
                  <div className="w-[5.25rem] shrink-0">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={defaultQty}
                      onChange={(e) => setDefaultQty(e.target.value)}
                      className="mt-1 h-10 w-full text-right tabular-nums"
                      aria-label="Quantity for add"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 px-5 pb-6 pt-4 sm:px-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-sm">Loading catalog…</p>
                </div>
              ) : loadError ? (
                <p className="mx-auto max-w-md py-20 text-center text-sm leading-relaxed text-destructive">{loadError}</p>
              ) : filtered.length === 0 ? (
                <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-20 text-center">
                  <p className="text-sm font-medium text-foreground">No matching catalog items</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Try another search or adjust type / category filters.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filtered.map((row) => {
                    const type = (row.item_type ?? "").trim() || "other"
                    const unit = (row.unit ?? "").trim()
                    const cat = (row.category ?? "").trim()
                    return (
                      <li key={row.id}>
                        <div
                          className={cn(
                            "rounded-xl border border-border bg-muted/15 px-4 py-3.5 transition-colors hover:bg-muted/30",
                            "grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 lg:gap-8",
                          )}
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground break-words">
                                {(row.name ?? "").trim() || "Untitled item"}
                              </span>
                              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                                  {type}
                                </Badge>
                                {cat ? (
                                  <Badge variant="outline" className="max-w-[12rem] truncate text-[10px] font-normal">
                                    {cat}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <p className="font-mono text-[11px] leading-snug text-muted-foreground break-all sm:break-words">
                              {skuLine(row)}
                            </p>
                            {(row.description ?? "").trim() ? (
                              <p className="text-xs leading-snug text-muted-foreground line-clamp-2">
                                {(row.description ?? "").trim()}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-5 sm:gap-y-2 sm:border-t-0 sm:pt-0 md:flex-nowrap md:justify-end">
                            <span className="text-[11px] text-muted-foreground sm:w-[4.5rem] sm:text-right md:w-auto">
                              {unit ? <span className="whitespace-nowrap">{unit}</span> : "—"}
                            </span>
                            <span className="text-base font-semibold tabular-nums tracking-tight sm:min-w-[5.5rem] sm:text-right">
                              {fmtMoney(
                                pricingMode === "purchase"
                                  ? snapshotPurchaseUnitPriceDollars(row)
                                  : snapshotSaleUnitPriceDollars(row),
                              )}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 w-full shrink-0 whitespace-nowrap sm:ml-auto sm:w-auto md:ml-0"
                              onClick={() => handleQuickAdd(row)}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
