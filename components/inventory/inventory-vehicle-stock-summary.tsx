"use client"

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Vehicle-first summary card: groups stock rows by vehicle location, shows
 * the assigned technician, total SKUs carried, and a low-stock count so
 * dispatchers can see at a glance which vans need restock before the day
 * starts.
 *
 * Pure presentational component — receives the same `stock`, `locations`,
 * and `vehicleAssignments` arrays the parent page already loads.
 */

import { Truck } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { isLowStock } from "@/lib/inventory/format"

type StockRow = {
  id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
}

type LocationRow = {
  id: string
  name: string
  location_type: string
  is_active: boolean
}

type VehicleAssignment = {
  technician_id: string
  technician_name: string | null
  inventory_location_id: string
  location_name: string | null
}

export type InventoryVehicleStockSummaryProps = {
  stock: StockRow[]
  locations: LocationRow[]
  vehicleAssignments: VehicleAssignment[]
  className?: string
}

export function InventoryVehicleStockSummary({
  stock,
  locations,
  vehicleAssignments,
  className,
}: InventoryVehicleStockSummaryProps) {
  const vehicles = locations.filter((l) => l.is_active && l.location_type === "vehicle")
  if (vehicles.length === 0) return null

  // Map technician name by location id (the assignment table maps a vehicle
  // location → primary technician). When a vehicle has no assignment we
  // surface "Unassigned" so the row still appears in the summary.
  const techByLocation = new Map<string, string | null>()
  for (const a of vehicleAssignments) {
    techByLocation.set(a.inventory_location_id, a.technician_name ?? null)
  }

  const summarized = vehicles.map((v) => {
    const rows = stock.filter((s) => s.location_id === v.id)
    const skus = rows.length
    const onHand = rows.reduce((sum, r) => sum + Number(r.quantity_on_hand || 0), 0)
    const lowCount = rows.filter((r) =>
      isLowStock({
        quantity_available: Number(r.quantity_available),
        reorder_point: r.reorder_point,
      }),
    ).length
    return {
      id: v.id,
      name: v.name,
      tech: techByLocation.get(v.id) ?? null,
      skus,
      onHand,
      lowCount,
    }
  })

  // Sort vehicles that need restock first so dispatchers see the action
  // items before well-stocked vans.
  summarized.sort((a, b) => {
    if (a.lowCount === b.lowCount) return a.name.localeCompare(b.name)
    return b.lowCount - a.lowCount
  })

  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="w-4 h-4" /> Vehicle stock
        </CardTitle>
        <CardDescription className="text-xs">
          Quick scan of every active van bin and the technician assigned to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead className="text-right">SKUs</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Low stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summarized.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground py-6 text-center">
                  No vehicles tracked yet.
                </TableCell>
              </TableRow>
            )}
            {summarized.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="text-sm font-medium">{v.name}</TableCell>
                <TableCell className="text-sm">
                  {v.tech ?? <span className="text-muted-foreground">Unassigned</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{v.skus}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{v.onHand}</TableCell>
                <TableCell className="text-right">
                  {v.lowCount > 0 ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
                      {v.lowCount}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
