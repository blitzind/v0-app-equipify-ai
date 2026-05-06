"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal, Package, Upload } from "lucide-react"
import { getCatalogAiStatusLabel } from "@/lib/catalog/catalog-ai-status"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

const CATALOG_MANAGER_ROLES = new Set(["owner", "admin", "manager"])

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
  ai_generated: boolean | null
  ai_confidence: number | null
  human_verified_at: string | null
  source_file_name: string | null
  created_at: string
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

export default function CatalogPage() {
  const { toast } = useToast()
  const { organizationId, status } = useActiveOrganization()
  const [items, setItems] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canManageCatalog, setCanManageCatalog] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!organizationId || status !== "ready") {
      setCanManageCatalog(false)
      return
    }
    let cancelled = false
    ;(async () => {
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
  }, [organizationId, status])

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
                <TableHead className="whitespace-nowrap">Review</TableHead>
                <TableHead>Source</TableHead>
                {canManageCatalog ? <TableHead className="w-[44px] pr-2" /> : null}
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
                  <TableCell className="align-middle">
                    <CatalogAiIndicator row={r} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {r.source_file_name ?? "—"}
                  </TableCell>
                  {canManageCatalog ? (
                    <TableCell className="pr-2 text-right align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            disabled={verifyingId === r.id}
                            aria-label="Row actions"
                          >
                            {verifyingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
