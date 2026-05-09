"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal, Package, Plus, Search, Upload } from "lucide-react"
import { CatalogAddItemDrawer } from "@/components/catalog/catalog-add-item-drawer"
import { CatalogItemDrawer } from "@/components/catalog/catalog-item-drawer"
import { getCatalogAiStatusLabel } from "@/lib/catalog/catalog-ai-status"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const CATALOG_MANAGER_ROLES = new Set(["owner", "admin", "manager"])

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

const ROW_STATUSES = ["active", "inactive", "discontinued", "needs_review"] as const

type CatalogRow = {
  id: string
  manufacturer_name: string | null
  vendor_name?: string | null
  category: string
  item_type: string
  part_number: string
  sku?: string | null
  name: string
  description: string | null
  list_price: number | null
  cost: number | null
  sale_price?: number | null
  unit: string
  status: string
  confidence_score: number | null
  ai_generated: boolean | null
  ai_confidence: number | null
  human_verified_at: string | null
  source_file_name: string | null
  source_type?: string | null
  created_at: string
}

function CatalogSourceBadge({ sourceType }: { sourceType?: string | null }) {
  const s = sourceType ?? "manual"
  if (s === "imported") {
    return (
      <Badge variant="outline" className="text-[10px] font-medium border-sky-500/35 bg-sky-500/5 text-sky-900 dark:text-sky-100">
        Imported
      </Badge>
    )
  }
  if (s === "ai_generated") {
    return (
      <Badge variant="outline" className="text-[10px] font-medium">
        AI
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] font-medium text-foreground">
      Manual
    </Badge>
  )
}

function rowVerificationKey(row: CatalogRow): "verified" | "needs_review" | "ai_generated" | "manual" {
  const label = getCatalogAiStatusLabel({
    ai_generated: Boolean(row.ai_generated),
    ai_confidence: row.ai_confidence,
    confidence_score: row.confidence_score,
    human_verified_at: row.human_verified_at,
  })
  if (label === "verified") return "verified"
  if (label === "needs_review") return "needs_review"
  if (label === "ai_generated") return "ai_generated"
  return "manual"
}

function CatalogAiIndicator({ row }: { row: CatalogRow }) {
  const st = getCatalogAiStatusLabel({
    ai_generated: Boolean(row.ai_generated),
    ai_confidence: row.ai_confidence,
    confidence_score: row.confidence_score,
    human_verified_at: row.human_verified_at,
  })
  if (!st) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (st === "verified") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-medium px-1.5 py-0 h-5 text-emerald-800/90 border-emerald-500/30 bg-emerald-500/5"
      >
        Verified
      </Badge>
    )
  }
  if (st === "needs_review") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-medium px-1.5 py-0 h-5 text-amber-900/80 border-amber-500/35 bg-amber-500/5"
      >
        Needs review
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-5 text-muted-foreground">
      AI
    </Badge>
  )
}

function formatItemType(raw: string): string {
  if (!raw) return "—"
  return raw.replace(/_/g, " ")
}

export default function CatalogPage() {
  const { toast } = useToast()
  const { isPlatformAdmin } = useAdmin()
  const { organizationId, status } = useActiveOrganization()
  const [items, setItems] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schemaHint, setSchemaHint] = useState<string | null>(null)
  const [canManageCatalog, setCanManageCatalog] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [verificationFilter, setVerificationFilter] = useState<string>("all")
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all")
  const [vendorFilter, setVendorFilter] = useState<string>("all")
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)
  const [addItemOpen, setAddItemOpen] = useState(false)

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setSchemaHint(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/catalog-items`, {
        cache: "no-store",
      })
      const body = (await res.json()) as {
        items?: CatalogRow[]
        message?: string
        error?: string
        hint?: string
      }
      if (!res.ok) {
        const schemaNotReady = body.error === "catalog_schema_not_ready"
        setSchemaHint(schemaNotReady ? body.hint ?? null : null)
        setError(body.message ?? body.error ?? "Could not load catalog.")
        setItems([])
        return
      }
      setItems(body.items ?? [])
    } catch {
      setSchemaHint(null)
      setError("Network error.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!organizationId || status !== "ready") {
      setCanManageCatalog(false)
      return
    }
    let cancelled = false
    ;(async () => {
      if (isPlatformAdmin) {
        if (!cancelled) setCanManageCatalog(true)
        return
      }
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id || cancelled) return
      const { data: mem } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
      if (!cancelled) {
        setCanManageCatalog(CATALOG_MANAGER_ROLES.has((mem?.role as string) ?? ""))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status, isPlatformAdmin])

  const manufacturers = useMemo(() => {
    const set = new Set<string>()
    for (const r of items) {
      const m = r.manufacturer_name?.trim()
      if (m) set.add(m)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  }, [items])

  const vendors = useMemo(() => {
    const set = new Set<string>()
    for (const r of items) {
      const v = r.vendor_name?.trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  }, [items])

  const filtered = useMemo(() => {
    let list = [...items]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.name,
          r.description ?? "",
          r.part_number,
          r.sku ?? "",
          r.category,
          r.manufacturer_name ?? "",
          r.vendor_name ?? "",
        ]
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
    }
    if (typeFilter !== "all") {
      list = list.filter((r) => r.item_type === typeFilter)
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter)
    }
    if (verificationFilter !== "all") {
      list = list.filter((r) => rowVerificationKey(r) === verificationFilter)
    }
    if (manufacturerFilter !== "all") {
      list = list.filter((r) => (r.manufacturer_name ?? "").trim() === manufacturerFilter)
    }
    if (vendorFilter !== "all") {
      list = list.filter((r) => (r.vendor_name ?? "").trim() === vendorFilter)
    }
    return list
  }, [items, search, typeFilter, statusFilter, verificationFilter, manufacturerFilter, vendorFilter])

  const patchVerification = useCallback(
    async (itemId: string, action: "verify" | "needs_review") => {
      if (!organizationId) return
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
        const body = (await res.json()) as { message?: string; error?: string }
        if (!res.ok) {
          toast({
            variant: "destructive",
            title: "Update failed",
            description: body.message ?? body.error ?? `HTTP ${res.status}`,
          })
          return
        }
        await load()
        toast({
          title: action === "verify" ? "Marked verified" : "Flagged for review",
          description: "Catalog item updated.",
        })
      } catch {
        toast({ variant: "destructive", title: "Network error" })
      } finally {
        setVerifyingId(null)
      }
    },
    [organizationId, load, toast],
  )

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading organization…
      </div>
    )
  }

  if (!organizationId) {
    return <p className="text-sm text-muted-foreground py-10">Select an organization to view the catalog.</p>
  }

  const catalogActionButtons = (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {canManageCatalog ? (
        <Button
          type="button"
          className="gap-2 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
          onClick={() => setAddItemOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      ) : null}
      <Button asChild variant="outline" className="gap-2 text-muted-foreground border-border">
        <Link href="/catalog/import">
          <Upload className="h-4 w-4" />
          Import price list
        </Link>
      </Button>
    </div>
  )

  /** Compact triggers keep search + 5 filters on one row at xl; narrow viewports wrap or scroll horizontally. */
  const filterTriggerClass =
    "h-9 w-full min-w-0 sm:min-w-[128px] sm:max-w-[160px] sm:w-[min(100%,152px)] xl:w-[152px] xl:shrink-0"

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1 (desktop): search + filters on one line. Row 2: count + actions */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-nowrap xl:items-center xl:gap-2">
          <div className="flex items-center gap-2 w-full shrink-0 rounded-md border border-border bg-card px-3 py-1.5 min-w-0 xl:max-w-[min(100%,280px)] xl:basis-[280px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search catalog items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex-nowrap xl:overflow-x-auto xl:pb-0.5 xl:[scrollbar-width:thin]">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatItemType(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ROW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatItemType(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="ai_generated">AI (ok)</SelectItem>
                <SelectItem value="manual">Not AI-sourced</SelectItem>
              </SelectContent>
            </Select>

            {manufacturers.length > 0 ? (
              <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                <SelectTrigger className={filterTriggerClass}>
                  <SelectValue placeholder="Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All manufacturers</SelectItem>
                  {manufacturers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {vendors.length > 0 ? (
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className={filterTriggerClass}>
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vendors</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0">
          <p className="text-sm text-muted-foreground min-w-0 shrink">
            {!loading && !error ? (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{items.length}</span> items
              </>
            ) : null}
          </p>
          <div className="w-full sm:w-auto min-w-0 shrink-0">{catalogActionButtons}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading catalog…
        </div>
      ) : error ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            schemaHint
              ? "border-amber-500/40 bg-amber-500/10 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          <p className={cn("font-medium", schemaHint && "text-foreground")}>{error}</p>
          {schemaHint ? (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{schemaHint}</p>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center gap-4">
            <div
              className="w-12 h-12 rounded-xl border flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, #D97706 14%, var(--card))",
                borderColor: "color-mix(in srgb, #D97706 24%, var(--border))",
              }}
            >
              <Package className="w-6 h-6" style={{ color: "#D97706" }} />
            </div>
            <div className="space-y-2 max-w-lg">
              <p className="text-base font-semibold text-foreground">Build your item catalog</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create reusable products, parts, labor items, services, and equipment templates for quotes, invoices,
                work orders, and purchase orders.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md justify-center">
              {canManageCatalog ? (
                <Button
                  type="button"
                  className="gap-2 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
                  onClick={() => setAddItemOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              ) : null}
              <Button asChild variant="outline" className="gap-2 border-border">
                <Link href="/catalog/import">
                  <Upload className="h-4 w-4" />
                  Import price list
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="ds-table-header-row-subtle">
                    <TableHead className="min-w-[200px]">Item / description</TableHead>
                    <TableHead className="whitespace-nowrap">Part number</TableHead>
                    <TableHead className="whitespace-nowrap">SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="min-w-[120px]">Manufacturer</TableHead>
                    <TableHead className="min-w-[100px]">Vendor</TableHead>
                    <TableHead className="whitespace-nowrap">Source</TableHead>
                    <TableHead className="text-right whitespace-nowrap">List price</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="whitespace-nowrap">Verification</TableHead>
                    {canManageCatalog ? <TableHead className="w-[44px] pr-2" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManageCatalog ? 13 : 12}
                        className="text-center text-sm text-muted-foreground py-12"
                      >
                        No items match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setDrawerItemId(r.id)}
                      >
                        <TableCell className="align-top max-w-[280px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground text-sm line-clamp-2">{r.name || "—"}</span>
                            {r.description ? (
                              <span className="text-xs text-muted-foreground line-clamp-2">{r.description}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top whitespace-nowrap">
                          {r.part_number || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top whitespace-nowrap">
                          {r.sku?.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-xs capitalize align-top">{formatItemType(r.item_type)}</TableCell>
                        <TableCell className="max-w-[140px] truncate align-top">{r.category || "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[160px] truncate align-top">
                          {r.manufacturer_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate align-top text-xs">
                          {r.vendor_name ?? "—"}
                        </TableCell>
                        <TableCell className="align-top">
                          <CatalogSourceBadge sourceType={r.source_type} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums align-top whitespace-nowrap">
                          {r.list_price != null ? `$${Number(r.list_price).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums align-top whitespace-nowrap">
                          {r.cost != null ? `$${Number(r.cost).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs capitalize align-top">{r.status}</TableCell>
                        <TableCell className="align-top">
                          <CatalogAiIndicator row={r} />
                        </TableCell>
                        {canManageCatalog ? (
                          <TableCell className="pr-2 text-right align-top" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                  disabled={verifyingId === r.id}
                                  aria-label="Row actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {verifyingId === r.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem asChild>
                                  <Link href={`/quotes?catalogItem=${encodeURIComponent(r.id)}`}>Add to quote</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/invoices?catalogItem=${encodeURIComponent(r.id)}`}>Add to invoice</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/work-orders?catalogItem=${encodeURIComponent(r.id)}`}>
                                    Add to work order
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/purchase-orders?catalogItem=${encodeURIComponent(r.id)}`}>
                                    Add to purchase order
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href="/equipment">Equipment assets</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    void (async () => {
                                      if (!organizationId) return
                                      const res = await fetch(
                                        `/api/organizations/${encodeURIComponent(organizationId)}/catalog-items/${encodeURIComponent(r.id)}`,
                                        {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ archived: true }),
                                        },
                                      )
                                      if (!res.ok) {
                                        toast({ variant: "destructive", title: "Could not archive item" })
                                        return
                                      }
                                      toast({ title: "Item archived" })
                                      await load()
                                    })()
                                  }}
                                >
                                  Archive item
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void patchVerification(r.id, "verify")}>
                                  Mark verified
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void patchVerification(r.id, "needs_review")}>
                                  Mark needs review
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <CatalogAddItemDrawer
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        organizationId={organizationId}
        onCreated={() => void load()}
      />

      <CatalogItemDrawer
        organizationId={organizationId}
        itemId={drawerItemId}
        open={Boolean(drawerItemId)}
        onClose={() => setDrawerItemId(null)}
        canManage={canManageCatalog}
        onUpdated={() => void load()}
      />
    </div>
  )
}
