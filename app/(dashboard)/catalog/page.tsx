"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Package, Upload, Loader2 } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CatalogRow = {
  id: string
  manufacturer_name: string | null
  category: string
  item_type: string
  part_number: string
  name: string
  list_price: number | null
  cost: number | null
  unit: string
  status: string
  confidence_score: number | null
  source_file_name: string | null
  created_at: string
}

export default function CatalogPage() {
  const { organizationId, status } = useActiveOrganization()
  const [items, setItems] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/catalog-items`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { items?: CatalogRow[]; message?: string; error?: string }
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Could not load catalog.")
        setItems([])
        return
      }
      setItems(body.items ?? [])
    } catch {
      setError("Network error.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, status])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Catalog</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Reusable items imported from manufacturer price lists (quotes, invoices, work orders, and PO line linkage coming next).
          </p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link href="/catalog/import">
            <Upload className="h-4 w-4" />
            Import price list
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading catalog…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No catalog items yet.{" "}
          <Link href="/catalog/import" className="text-primary underline font-medium">
            Import a price list PDF
          </Link>
          .
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="ds-table-header-row-subtle">
                <TableHead>Manufacturer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">List</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground max-w-[120px] truncate">
                    {r.manufacturer_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{r.item_type}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{r.category || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.part_number || "—"}</TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="line-clamp-2">{r.name}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.list_price != null ? `$${Number(r.list_price).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.cost != null ? `$${Number(r.cost).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{r.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {r.source_file_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
