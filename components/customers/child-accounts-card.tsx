"use client"

/**
 * Customer Hierarchy — Phase 2
 *
 * Child accounts table mounted on the parent customer's detail page. Lists
 * direct sub-accounts with quick stats (locations, equipment, open WOs).
 * Clicking a row opens that customer's full detail.
 *
 * Strict rules:
 *   - never expose raw UUIDs in rendered text
 *   - non-throwing: shows a soft empty state when the call fails
 *   - dark-mode + mobile responsive
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { missingCustomerHierarchyColumns } from "@/lib/customers/postgrest-fallback"

type ChildRow = {
  id: string
  companyName: string
  status: "active" | "inactive"
  locationCount: number
  equipmentCount: number
  openWorkOrderCount: number
  recentInvoiceCount: number
}

type Props = {
  organizationId: string
  parentCustomerId: string
  parentCompanyName: string
  className?: string
}

const OPEN_WO_STATUSES = ["open", "scheduled", "in_progress"] as const

export function ChildAccountsCard({
  organizationId,
  parentCustomerId,
  parentCompanyName,
  className,
}: Props) {
  const [rows, setRows] = useState<ChildRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()

      const childRes = await supabase
        .from("customers")
        .select("id, company_name, status, archived_at")
        .eq("organization_id", organizationId)
        .eq("parent_customer_id", parentCustomerId)
        .is("archived_at", null)
        .order("company_name", { ascending: true })
        .limit(100)

      if (cancelled) return

      if (childRes.error && missingCustomerHierarchyColumns(childRes.error)) {
        setSchemaMissing(true)
        setRows([])
        setLoading(false)
        return
      }
      if (childRes.error || !childRes.data) {
        setRows([])
        setLoading(false)
        return
      }

      const children = childRes.data as Array<{
        id: string
        company_name: string
        status: "active" | "inactive"
        archived_at: string | null
      }>
      const childIds = children.map((c) => c.id)

      if (childIds.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      // Bulk-fetch counts in parallel. Each query is RLS-safe.
      const since = new Date()
      since.setMonth(since.getMonth() - 12)
      const [locRes, eqRes, woRes, invRes] = await Promise.all([
        supabase
          .from("customer_locations")
          .select("customer_id")
          .eq("organization_id", organizationId)
          .in("customer_id", childIds)
          .is("archived_at", null),
        supabase
          .from("equipment")
          .select("customer_id")
          .eq("organization_id", organizationId)
          .in("customer_id", childIds)
          .is("archived_at", null),
        supabase
          .from("work_orders")
          .select("customer_id, status")
          .eq("organization_id", organizationId)
          .in("customer_id", childIds)
          .is("archived_at", null)
          .in("status", OPEN_WO_STATUSES as unknown as string[]),
        supabase
          .from("org_invoices")
          .select("customer_id")
          .eq("organization_id", organizationId)
          .in("customer_id", childIds)
          .gte("issued_at", since.toISOString().slice(0, 10)),
      ])

      if (cancelled) return

      const locMap = new Map<string, number>()
      const eqMap = new Map<string, number>()
      const woMap = new Map<string, number>()
      const invMap = new Map<string, number>()

      for (const r of (locRes.data ?? []) as Array<{ customer_id: string }>) {
        locMap.set(r.customer_id, (locMap.get(r.customer_id) ?? 0) + 1)
      }
      for (const r of (eqRes.data ?? []) as Array<{ customer_id: string }>) {
        eqMap.set(r.customer_id, (eqMap.get(r.customer_id) ?? 0) + 1)
      }
      for (const r of (woRes.data ?? []) as Array<{ customer_id: string; status: string }>) {
        woMap.set(r.customer_id, (woMap.get(r.customer_id) ?? 0) + 1)
      }
      for (const r of (invRes.data ?? []) as Array<{ customer_id: string }>) {
        invMap.set(r.customer_id, (invMap.get(r.customer_id) ?? 0) + 1)
      }

      const mapped: ChildRow[] = children.map((c) => ({
        id: c.id,
        companyName: c.company_name,
        status: c.status,
        locationCount: locMap.get(c.id) ?? 0,
        equipmentCount: eqMap.get(c.id) ?? 0,
        openWorkOrderCount: woMap.get(c.id) ?? 0,
        recentInvoiceCount: invMap.get(c.id) ?? 0,
      }))

      setRows(mapped)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, parentCustomerId])

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            Sub-accounts
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customers rolled up under{" "}
            <span className="font-medium text-foreground">{parentCompanyName}</span>.
          </p>
        </div>
        <Link
          href={`/customers?action=new-customer&parent=${encodeURIComponent(parentCustomerId)}`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add sub-account
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {schemaMissing ? (
          <div className="p-4 text-xs text-muted-foreground">
            Hierarchy is not yet available on this database. Run the latest
            migration to enable sub-accounts.
          </div>
        ) : loading ? (
          <p className="p-4 text-xs text-muted-foreground">Loading sub-accounts…</p>
        ) : !rows || rows.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No sub-accounts linked yet. Use <span className="font-medium text-foreground">Manage</span> on
            the Hierarchy card of any customer to link them as a sub-account.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/customers/${row.id}`}
                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary shrink-0">
                  {row.companyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {row.companyName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.locationCount} location{row.locationCount === 1 ? "" : "s"}
                    {" · "}
                    {row.equipmentCount} equipment
                    {" · "}
                    <span
                      className={cn(
                        row.openWorkOrderCount > 0
                          ? "font-medium text-[color:var(--status-warning)]"
                          : "",
                      )}
                    >
                      {row.openWorkOrderCount} open WO{row.openWorkOrderCount === 1 ? "" : "s"}
                    </span>
                    {" · "}
                    {row.recentInvoiceCount} recent invoice{row.recentInvoiceCount === 1 ? "" : "s"}
                  </p>
                </div>
                {row.status === "inactive" ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Inactive
                  </span>
                ) : null}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
