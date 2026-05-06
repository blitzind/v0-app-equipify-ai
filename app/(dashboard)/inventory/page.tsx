"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Package, Truck, Warehouse } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

const MANAGER_ROLES = new Set(["owner", "admin", "manager"])

type LocationRow = {
  id: string
  name: string
  code: string | null
  location_type: string
  technician_name: string | null
  is_active: boolean
}

type StockRow = {
  id: string
  catalog_item_id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
  part_number: string | null
  item_name: string | null
  unit: string | null
  location_name: string | null
}

type TxRow = {
  id: string
  transaction_type: string
  quantity: number
  delta_on_hand: number
  delta_allocated: number
  catalog_item_id: string
  location_id: string
  work_order_id: string | null
  purchase_order_id: string | null
  notes: string | null
  created_at: string
}

type CatalogOpt = { id: string; name: string; part_number: string }

export default function InventoryPage() {
  const { toast } = useToast()
  const { isPlatformAdmin } = useAdmin()
  const { organizationId, status } = useActiveOrganization()
  const [canManage, setCanManage] = useState(false)

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [lowStock, setLowStock] = useState<
    Array<{
      stock_id: string
      catalog_item_id: string
      location_id: string
      quantity_available: number
      reorder_point: number | null
      item_name: string | null
      location_name: string | null
    }>
  >([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [vehicleAssignments, setVehicleAssignments] = useState<
    Array<{ technician_id: string; technician_name: string | null; inventory_location_id: string; location_name: string | null }>
  >([])
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string }>>([])
  const [catalogParts, setCatalogParts] = useState<CatalogOpt[]>([])

  const [loading, setLoading] = useState(true)

  const [locOpen, setLocOpen] = useState(false)
  const [newLocName, setNewLocName] = useState("")
  const [newLocType, setNewLocType] = useState("warehouse")

  const baseUrl = organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}` : ""

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [lr, sr, ls, tx, vs, catRes] = await Promise.all([
        fetch(`${baseUrl}/inventory/locations`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/low-stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/transactions?limit=200`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/vehicle-stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/catalog-items?limit=500`, { cache: "no-store" }),
      ])
      const lj = await lr.json().catch(() => ({}))
      const sj = await sr.json().catch(() => ({}))
      const lowj = await ls.json().catch(() => ({}))
      const txj = await tx.json().catch(() => ({}))
      const vsj = await vs.json().catch(() => ({}))
      const cj = await catRes.json().catch(() => ({}))

      setLocations(lj.locations ?? [])
      setStock(sj.stock ?? [])
      setLowStock(lowj.items ?? [])
      setTransactions(txj.transactions ?? [])
      setVehicleAssignments(vsj.assignments ?? [])
      const items = (cj.items ?? []) as Array<{ id: string; name: string; part_number?: string | null }>
      setCatalogParts(items.map((i) => ({ id: i.id, name: i.name, part_number: i.part_number ?? "" })))
    } catch {
      toast({ title: "Could not load inventory", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [baseUrl, organizationId, status, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!organizationId || status !== "ready") {
      setCanManage(false)
      return
    }
    let cancelled = false
    ;(async () => {
      if (isPlatformAdmin) {
        if (!cancelled) setCanManage(true)
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
      if (!cancelled) setCanManage(MANAGER_ROLES.has((mem?.role as string) ?? ""))
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status, isPlatformAdmin])

  useEffect(() => {
    if (!organizationId || status !== "ready") return
    let cancelled = false
    ;(async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("technicians")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .eq("operational_status", "active")
        .order("full_name", { ascending: true })
      if (!cancelled && data) {
        setTechnicians(data.map((t) => ({ id: t.id as string, full_name: (t.full_name as string) ?? "" })))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status])

  const vehicleLocations = useMemo(
    () => locations.filter((l) => l.location_type === "vehicle" && l.is_active),
    [locations],
  )

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const j = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(j.message ?? "Request failed.")
  }

  const [adjCatalog, setAdjCatalog] = useState("")
  const [adjLoc, setAdjLoc] = useState("")
  const [adjQty, setAdjQty] = useState("1")
  const [adjDir, setAdjDir] = useState<"in" | "out">("in")

  const [xfCatalog, setXfCatalog] = useState("")
  const [xfFrom, setXfFrom] = useState("")
  const [xfTo, setXfTo] = useState("")
  const [xfQty, setXfQty] = useState("1")

  const [rcvCatalog, setRcvCatalog] = useState("")
  const [rcvLoc, setRcvLoc] = useState("")
  const [rcvQty, setRcvQty] = useState("1")
  const [rcvPo, setRcvPo] = useState("")

  const [conWo, setConWo] = useState("")
  const [conCatalog, setConCatalog] = useState("")
  const [conLoc, setConLoc] = useState("")
  const [conQty, setConQty] = useState("1")

  const [thrStock, setThrStock] = useState("")
  const [thrPoint, setThrPoint] = useState("")
  const [thrQty, setThrQty] = useState("")

  const [vanTech, setVanTech] = useState("")
  const [vanLoc, setVanLoc] = useState("")

  async function submitThresholds() {
    if (!canManage || !baseUrl) return
    try {
      await postJson(`${baseUrl}/inventory/thresholds`, {
        stock_id: thrStock,
        reorder_point: thrPoint === "" ? null : Number(thrPoint),
        reorder_quantity: thrQty === "" ? null : Number(thrQty),
      })
      toast({ title: "Reorder thresholds saved" })
      void load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  async function submitVanAssign() {
    if (!canManage || !baseUrl) return
    try {
      await postJson(`${baseUrl}/inventory/vehicle-stock`, {
        technician_id: vanTech,
        inventory_location_id: vanLoc,
      })
      toast({ title: "Van stock location assigned" })
      void load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  if (!organizationId || status !== "ready") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading workspace…
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading inventory…
      </div>
    )
  }

  return (
    <div className="space-y-6 px-3 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Operations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track parts by location, transfers, work order consumption, and van stock.
          </p>
        </div>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={() => setLocOpen(true)}>
            <Warehouse className="w-3.5 h-3.5 mr-1.5" />
            New location
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="adjust">Stock adjustments</TabsTrigger>
          <TabsTrigger value="transfer">Transfers</TabsTrigger>
          <TabsTrigger value="history">Consumption &amp; history</TabsTrigger>
          <TabsTrigger value="vans">Van inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {lowStock.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Low stock alerts</CardTitle>
                <CardDescription>
                  Available quantity is at or below the reorder point for these SKU / location pairs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((r) => (
                      <TableRow key={r.stock_id}>
                        <TableCell className="text-sm">{r.item_name ?? r.catalog_item_id}</TableCell>
                        <TableCell className="text-sm">{r.location_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity_available}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.reorder_point ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> On-hand by location
              </CardTitle>
              <CardDescription>Parts linked to catalog items. Available = on hand − allocated.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground py-8 text-center">
                        No stock rows yet. Receive or adjust stock to create balances.
                      </TableCell>
                    </TableRow>
                  )}
                  {stock.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <span className="font-medium">{r.item_name ?? "—"}</span>
                        {r.part_number ? (
                          <span className="block text-[11px] text-muted-foreground">{r.part_number}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{r.location_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_on_hand}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_allocated}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_available}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Reorder thresholds</CardTitle>
                <CardDescription>Set alerts per stock row (requires existing balance row).</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs">Stock row</Label>
                  <Select value={thrStock} onValueChange={setThrStock}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose stocked line…" />
                    </SelectTrigger>
                    <SelectContent>
                      {stock.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {(s.item_name ?? s.part_number ?? s.catalog_item_id).slice(0, 42)} @ {s.location_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-28">
                  <Label className="text-xs">Reorder at</Label>
                  <Input value={thrPoint} onChange={(e) => setThrPoint(e.target.value)} placeholder="e.g. 5" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5 w-28">
                  <Label className="text-xs">Order qty</Label>
                  <Input value={thrQty} onChange={(e) => setThrQty(e.target.value)} placeholder="e.g. 10" className="h-9 text-xs" />
                </div>
                <Button type="button" size="sm" className="h-9" onClick={submitThresholds}>
                  Save
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="adjust" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Adjust on-hand</CardTitle>
              <CardDescription>Increase or decrease counts at a location (cycle counts, corrections).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Catalog item</Label>
                <Select value={adjCatalog} onValueChange={setAdjCatalog} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select part…" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogParts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.part_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Select value={adjLoc} onValueChange={setAdjLoc} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Location…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} ({l.location_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Direction</Label>
                <Select value={adjDir} onValueChange={(v) => setAdjDir(v as "in" | "out")} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Increase</SelectItem>
                    <SelectItem value="out">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="h-9 text-xs"
                  disabled={!canManage}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/adjust`, {
                        catalog_item_id: adjCatalog,
                        location_id: adjLoc,
                        direction: adjDir,
                        quantity: Number(adjQty),
                      })
                      toast({ title: "Stock adjusted" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Apply adjustment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Receive against PO (optional)</CardTitle>
              <CardDescription>Increases on-hand; links to purchase order when provided.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Catalog item</Label>
                <Select value={rcvCatalog} onValueChange={setRcvCatalog} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Part…" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogParts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Select value={rcvLoc} onValueChange={setRcvLoc} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Warehouse…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input value={rcvQty} onChange={(e) => setRcvQty(e.target.value)} className="h-9 text-xs" disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO id (optional)</Label>
                <Input value={rcvPo} onChange={(e) => setRcvPo(e.target.value)} className="h-9 text-xs font-mono" disabled={!canManage} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/receive`, {
                        catalog_item_id: rcvCatalog,
                        location_id: rcvLoc,
                        quantity: Number(rcvQty),
                        purchase_order_id: rcvPo.trim() || null,
                      })
                      toast({ title: "Receipt recorded" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Receive
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Transfer between locations</CardTitle>
              <CardDescription>Moves available quantity from warehouse to vehicle or between bins.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs">Catalog item</Label>
                <Select value={xfCatalog} onValueChange={setXfCatalog} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Part…" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogParts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Select value={xfFrom} onValueChange={setXfFrom} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Select value={xfTo} onValueChange={setXfTo} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Destination…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Qty</Label>
                <Input value={xfQty} onChange={(e) => setXfQty(e.target.value)} className="h-9 text-xs" disabled={!canManage} />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/transfer`, {
                        catalog_item_id: xfCatalog,
                        from_location_id: xfFrom,
                        to_location_id: xfTo,
                        quantity: Number(xfQty),
                      })
                      toast({ title: "Transfer completed" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Ledger</CardTitle>
              <CardDescription>
                Consumption rows reference work orders. Filter mentally by type &mdash; use{" "}
                <strong>consume</strong> for parts used on jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Δ on-hand</TableHead>
                    <TableHead className="text-right">Δ alloc</TableHead>
                    <TableHead>WO / PO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground py-8 text-center">
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{t.transaction_type}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{t.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{t.delta_on_hand}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{t.delta_allocated}</TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {t.work_order_id ? `WO ${t.work_order_id.slice(0, 8)}…` : ""}
                        {t.purchase_order_id ? ` PO ${t.purchase_order_id.slice(0, 8)}…` : ""}
                        {!t.work_order_id && !t.purchase_order_id ? "—" : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Consume on work order</CardTitle>
              <CardDescription>
                Pulls physical stock and releases allocation when applicable. Paste work order UUID from the work order URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Work order id</Label>
                <Input
                  value={conWo}
                  onChange={(e) => setConWo(e.target.value)}
                  className="h-9 text-xs font-mono"
                  placeholder="uuid"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Part</Label>
                <Select value={conCatalog} onValueChange={setConCatalog} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Catalog…" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogParts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Select value={conLoc} onValueChange={setConLoc} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="From…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input value={conQty} onChange={(e) => setConQty(e.target.value)} className="h-9 text-xs" disabled={!canManage} />
              </div>
              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/consume`, {
                        work_order_id: conWo.trim(),
                        catalog_item_id: conCatalog,
                        location_id: conLoc,
                        quantity: Number(conQty),
                      })
                      toast({ title: "Consumption recorded" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Record consumption
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vans" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" /> Technician vehicle bins
              </CardTitle>
              <CardDescription>
                Assign a technician to the inventory location that represents their van. Stock for that location appears in{" "}
                <strong>Overview</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Technician</Label>
                <Select value={vanTech} onValueChange={setVanTech} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle location</Label>
                <Select value={vanLoc} onValueChange={setVanLoc} disabled={!canManage}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Van location…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="h-9" disabled={!canManage} onClick={submitVanAssign}>
                Save assignment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Current assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Van location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleAssignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm text-muted-foreground py-6">
                        No van assignments yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {vehicleAssignments.map((a) => (
                    <TableRow key={a.technician_id}>
                      <TableCell className="text-sm">{a.technician_name ?? a.technician_id}</TableCell>
                      <TableCell className="text-sm">{a.location_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New inventory location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newLocName} onChange={(e) => setNewLocName(e.target.value)} placeholder="Main warehouse" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newLocType} onValueChange={setNewLocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="vehicle">Vehicle / van</SelectItem>
                  <SelectItem value="job_site">Job site</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setLocOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!baseUrl || !newLocName.trim()) return
                try {
                  await postJson(`${baseUrl}/inventory/locations`, {
                    name: newLocName.trim(),
                    location_type: newLocType,
                  })
                  toast({ title: "Location created" })
                  setLocOpen(false)
                  setNewLocName("")
                  void load()
                } catch (e) {
                  toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
