"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Loader2,
  RefreshCw,
  Truck,
  Warehouse,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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

type ReorderCapabilities = {
  can_manage_reorder: boolean
  can_request_restock: boolean
  can_draft_po: boolean
  can_transfer_truck: boolean
  can_mark_truck_restock_complete: boolean
}

type StockRow = {
  stock_id: string
  catalog_item_id: string
  location_id: string
  quantity_on_hand: number
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
  suggested_quantity: number
  item_name: string | null
  part_number: string | null
  location_name: string | null
  location_type: string | null
  technician_label: string | null
  vendor_name: string | null
  ui_status: string
  tone: string
}

type PoSuggestion = {
  vendor_id: string
  vendor_name: string
  lines: Array<{
    stock_id: string
    catalog_item_id: string
    location_id: string
    item_name: string | null
    part_number: string | null
    quantity_available: number
    reorder_point: number | null
    suggested_quantity: number
    unit_cost_cents: number
  }>
}

type RestockRequest = {
  id: string
  catalog_item_id: string
  location_id: string
  quantity: number
  notes: string | null
  created_at: string
  requested_quantity: number | null
  item_name?: string | null
  part_number?: string | null
  location_name?: string | null
}

function statusBadgeClass(uiStatus: string): string {
  switch (uiStatus) {
    case "reorder_recommended":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30"
    case "restock_truck_recommended":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30"
    case "out":
      return "bg-red-500/15 text-red-900 dark:text-red-100 border-red-500/30"
    case "low":
      return "bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/25"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function formatStatusLabel(uiStatus: string): string {
  switch (uiStatus) {
    case "reorder_recommended":
      return "Reorder recommended"
    case "restock_truck_recommended":
      return "Restock truck recommended"
    case "out":
      return "Out"
    case "low":
      return "Low"
    case "ok":
      return "OK"
    default:
      return uiStatus.replace(/_/g, " ")
  }
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? res.statusText ?? "Request failed")
  }
  return data
}

export type InventoryReorderCenterProps = {
  organizationId: string
  onInventoryMutated?: () => void
}

export function InventoryReorderCenter({ organizationId, onInventoryMutated }: InventoryReorderCenterProps) {
  const { toast } = useToast()
  const baseUrl = `/api/organizations/${encodeURIComponent(organizationId)}`

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [capabilities, setCapabilities] = useState<ReorderCapabilities | null>(null)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [warehouseLowOrOut, setWarehouseLowOrOut] = useState<StockRow[]>([])
  const [truckRestock, setTruckRestock] = useState<StockRow[]>([])
  const [missingReorderPoints, setMissingReorderPoints] = useState<StockRow[]>([])
  const [vendorPoSuggestions, setVendorPoSuggestions] = useState<PoSuggestion[]>([])
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([])
  const [warehousePickLocations, setWarehousePickLocations] = useState<
    Array<{ id: string; name: string; location_type: string; code: string | null }>
  >([])
  const [myVehicleLocationId, setMyVehicleLocationId] = useState<string | null>(null)

  const [xferOpen, setXferOpen] = useState(false)
  const [xferRow, setXferRow] = useState<StockRow | null>(null)
  const [xferFromId, setXferFromId] = useState("")
  const [xferQty, setXferQty] = useState("")

  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeCtx, setCompleteCtx] = useState<{
    catalog_item_id: string
    truck_location_id: string
    warehouse_location_id: string | null
    qty: string
    correlation_id: string | null
  } | null>(null)

  const [requestOpen, setRequestOpen] = useState(false)
  const [requestCatalogId, setRequestCatalogId] = useState("")
  const [requestQty, setRequestQty] = useState("")

  const load = useCallback(async () => {
    if (!organizationId) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/inventory/reorder-center`, { cache: "no-store" })
      const body = (await res.json().catch(() => ({}))) as {
        message?: string
        capabilities?: ReorderCapabilities
        summary?: Record<string, number>
        warehouse_low_or_out?: StockRow[]
        truck_restock?: StockRow[]
        missing_reorder_points?: StockRow[]
        vendor_po_suggestions?: PoSuggestion[]
        restock_requests?: RestockRequest[]
        warehouse_pick_locations?: Array<{
          id: string
          name: string
          location_type: string
          code: string | null
        }>
        my_vehicle_location_id?: string | null
      }
      if (!res.ok) throw new Error(body.message ?? "Failed to load reorder center")
      setCapabilities(body.capabilities ?? null)
      setSummary(body.summary ?? null)
      setWarehouseLowOrOut(body.warehouse_low_or_out ?? [])
      setTruckRestock(body.truck_restock ?? [])
      setMissingReorderPoints(body.missing_reorder_points ?? [])
      setVendorPoSuggestions(body.vendor_po_suggestions ?? [])
      setRestockRequests(body.restock_requests ?? [])
      setWarehousePickLocations(body.warehouse_pick_locations ?? [])
      setMyVehicleLocationId(body.my_vehicle_location_id ?? null)

      const picks = body.warehouse_pick_locations ?? []
      setXferFromId((prev) => {
        if (prev && picks.some((p) => p.id === prev)) return prev
        return picks[0]?.id ?? ""
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [baseUrl, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const defaultWarehouseId = useMemo(() => warehousePickLocations[0]?.id ?? "", [warehousePickLocations])

  const openTransfer = (row: StockRow) => {
    setXferRow(row)
    setXferQty(String(row.suggested_quantity > 0 ? row.suggested_quantity : 1))
    setXferFromId(defaultWarehouseId || warehousePickLocations[0]?.id || "")
    setXferOpen(true)
  }

  const submitTransfer = async () => {
    if (!xferRow || !xferFromId) return
    const q = Number(xferQty)
    if (!Number.isFinite(q) || q <= 0) return
    try {
      const data = (await postJson(`${baseUrl}/inventory/transfer`, {
        catalog_item_id: xferRow.catalog_item_id,
        from_location_id: xferFromId,
        to_location_id: xferRow.location_id,
        quantity: q,
        notes: "Reorder Center — warehouse to truck restock",
      })) as { correlation_id?: string }
      toast({ title: "Transfer recorded", description: "Stock moved toward the vehicle bin." })
      setCompleteCtx({
        catalog_item_id: xferRow.catalog_item_id,
        truck_location_id: xferRow.location_id,
        warehouse_location_id: xferFromId,
        qty: String(q),
        correlation_id: typeof data.correlation_id === "string" ? data.correlation_id : null,
      })
      setXferOpen(false)
      setCompleteOpen(true)
      onInventoryMutated?.()
      void load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Transfer failed",
        variant: "destructive",
      })
    }
  }

  const submitComplete = async () => {
    if (!completeCtx) return
    const q = Number(completeCtx.qty)
    if (!Number.isFinite(q) || q <= 0) return
    try {
      await postJson(`${baseUrl}/inventory/truck-restock-complete`, {
        catalog_item_id: completeCtx.catalog_item_id,
        truck_location_id: completeCtx.truck_location_id,
        warehouse_location_id: completeCtx.warehouse_location_id,
        quantity_completed: q,
        transfer_correlation_id: completeCtx.correlation_id,
        notes: "Marked restock complete (Reorder Center)",
      })
      toast({ title: "Restock logged", description: "Ledger updated — no stock delta." })
      setCompleteOpen(false)
      setCompleteCtx(null)
      void load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    }
  }

  const submitDraftPo = async (group: PoSuggestion) => {
    try {
      const data = (await postJson(`${baseUrl}/inventory/draft-po-from-reorder`, {
        vendor_id: group.vendor_id,
        lines: group.lines.map((l) => ({
          catalog_item_id: l.catalog_item_id,
          quantity: l.suggested_quantity,
        })),
      })) as { purchase_order_number?: string | null }
      toast({
        title: "Draft PO created",
        description: data.purchase_order_number
          ? `${data.purchase_order_number} — internal draft only.`
          : "Draft saved — not sent.",
      })
      void load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not create draft",
        variant: "destructive",
      })
    }
  }

  const submitRestockRequest = async () => {
    if (!requestCatalogId || !myVehicleLocationId) return
    const qRaw = requestQty.trim()
    const qty =
      qRaw.length > 0 && Number.isFinite(Number(qRaw)) && Number(qRaw) > 0 ? Number(qRaw) : null
    try {
      await postJson(`${baseUrl}/inventory/restock-request`, {
        catalog_item_id: requestCatalogId,
        location_id: myVehicleLocationId,
        quantity: qty,
        notes: "Requested from Reorder Center",
      })
      toast({ title: "Restock requested", description: "Dispatch will see this on the ledger." })
      setRequestOpen(false)
      setRequestQty("")
      void load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading reorder center…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Could not load reorder center
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const cap = capabilities

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reorder Center</h2>
          <p className="text-sm text-muted-foreground">
            Warehouse coverage, truck restock, and internal draft PO prep — nothing is sent to vendors automatically.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true)
            void load()
          }}
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {summary ?
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Below reorder point
            </p>
            <p className="text-2xl font-semibold tabular-nums">{summary.items_below_reorder_point ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Warehouse + truck rows</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Warehouse out
            </p>
            <p className="text-2xl font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              {summary.urgent_out_warehouse ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Needs purchasing attention</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Trucks needing restock
            </p>
            <p className="text-2xl font-semibold tabular-nums">{summary.trucks_needing_restock ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Distinct vehicles</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vendor PO drafts suggested
            </p>
            <p className="text-2xl font-semibold tabular-nums">{summary.vendor_po_groups ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Grouped by preferred vendor</p>
          </div>
        </div>
      : null}

      {cap?.can_request_restock && myVehicleLocationId ?
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Your truck
            </CardTitle>
            <CardDescription>Request a restock signal for your assigned vehicle bin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRequestCatalogId(truckRestock[0]?.catalog_item_id ?? "")
                setRequestOpen(true)
              }}
            >
              Request restock
            </Button>
          </CardContent>
        </Card>
      : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Pending restock requests
          </CardTitle>
          <CardDescription>Zero-delta ledger entries technicians filed — not transfers.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {restockRequests.length === 0 ?
            <p className="text-sm text-muted-foreground py-2">No pending requests in view.</p>
          : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="hidden sm:table-cell">Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restockRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium truncate max-w-[180px]">{r.item_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.part_number ?? r.catalog_item_id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {r.location_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.requested_quantity ?? r.quantity ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {warehouseLowOrOut.length > 0 ?
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              Warehouse / staging — low or out
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Avail</TableHead>
                  <TableHead className="hidden md:table-cell">Vendor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouseLowOrOut.map((r) => (
                  <TableRow key={r.stock_id}>
                    <TableCell className="max-w-[220px]">
                      <div className="font-medium text-sm truncate">{r.item_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.part_number ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.location_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.quantity_available}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {r.vendor_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(r.ui_status))}>
                        {formatStatusLabel(r.ui_status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      : null}

      {truckRestock.length > 0 ?
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Truck stock — restock recommended
            </CardTitle>
            <CardDescription>
              Transfer from a warehouse or staging bin onto the route vehicle (requires inventory manage permission).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="hidden sm:table-cell">Tech</TableHead>
                  <TableHead className="text-right">Avail</TableHead>
                  <TableHead className="text-right">Suggested</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {truckRestock.map((r) => (
                  <TableRow key={r.stock_id}>
                    <TableCell className="max-w-[200px]">
                      <div className="font-medium text-sm truncate">{r.item_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.part_number ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.location_name ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {r.technician_label ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.quantity_available}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.suggested_quantity}</TableCell>
                    <TableCell className="text-right">
                      {cap?.can_transfer_truck ?
                        <Button type="button" size="sm" variant="secondary" onClick={() => openTransfer(r)}>
                          Transfer…
                        </Button>
                      : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      : null}

      {missingReorderPoints.length > 0 ?
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="w-4 h-4" />
              Items without reorder points
            </CardTitle>
            <CardDescription>Positive on-hand but no threshold — configure under stock adjustments.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingReorderPoints.slice(0, 40).map((r) => (
                  <TableRow key={r.stock_id}>
                    <TableCell className="max-w-[220px]">
                      <div className="font-medium text-sm truncate">{r.item_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.part_number ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.location_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantity_on_hand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      : null}

      {vendorPoSuggestions.length > 0 ?
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4" />
            Draft PO suggestions (by vendor)
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {vendorPoSuggestions.map((g) => (
              <Card key={g.vendor_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{g.vendor_name}</CardTitle>
                  <CardDescription>{g.lines.length} line(s) from preferred vendor linkage.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-xs space-y-1 text-muted-foreground max-h-36 overflow-y-auto">
                    {g.lines.map((l) => (
                      <li key={`${l.stock_id}-${l.catalog_item_id}`}>
                        <span className="font-medium text-foreground">{l.part_number ?? l.catalog_item_id}</span>
                        {" · "}
                        suggested {l.suggested_quantity}{" "}
                        {l.unit_cost_cents ?
                          <span className="tabular-nums">
                            (@ ${(l.unit_cost_cents / 100).toFixed(2)})
                          </span>
                        : null}
                      </li>
                    ))}
                  </ul>
                  {cap?.can_draft_po ?
                    <Button type="button" size="sm" onClick={() => void submitDraftPo(g)}>
                      Create draft PO
                    </Button>
                  : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      : null}

      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Warehouse → truck transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">From warehouse / staging</Label>
              <Select value={xferFromId} onValueChange={setXferFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose source bin" />
                </SelectTrigger>
                <SelectContent>
                  {warehousePickLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      {l.code ? ` (${l.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input value={xferQty} onChange={(e) => setXferQty(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setXferOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitTransfer()} disabled={!xferFromId}>
              Transfer stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark truck restock complete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adds a zero-delta ledger marker tied to this SKU on the truck. Use after the physical transfer is verified.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteOpen(false)}>
              Skip
            </Button>
            <Button type="button" onClick={() => void submitComplete()}>
              Log complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request restock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Part on your truck</Label>
              {truckRestock.length > 0 ?
                <Select value={requestCatalogId} onValueChange={setRequestCatalogId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {truckRestock.map((r) => (
                      <SelectItem key={r.catalog_item_id} value={r.catalog_item_id}>
                        {(r.part_number ?? r.item_name ?? r.catalog_item_id).slice(0, 48)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              : <Input
                  value={requestCatalogId}
                  onChange={(e) => setRequestCatalogId(e.target.value.trim())}
                  placeholder="Catalog item UUID"
                  className="font-mono text-xs"
                />
              }
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Requested quantity (optional)</Label>
              <Input value={requestQty} onChange={(e) => setRequestQty(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitRestockRequest()} disabled={!requestCatalogId}>
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
