"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { Search, Plus, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { VendorDrawer } from "@/components/drawers/vendor-drawer"
import { AddVendorModal } from "@/components/vendors/add-vendor-modal"
import { DrawerToastStack, type ToastItem } from "@/components/detail-drawer"

let vendorPageToastId = 0

type VendorListRow = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  is_archived: boolean
}

type StatusFilter = "all" | "active" | "archived"

function StatusBadge({ archived }: { archived: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold",
        archived
          ? "bg-muted text-muted-foreground border-border"
          : "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
      )}
    >
      {archived ? "Archived" : "Active"}
    </Badge>
  )
}

function VendorsPageInner() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()
  const [rows, setRows] = useState<VendorListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const searchParams = useSearchParams()
  const router = useRouter()

  const refresh = () => setRefreshToken((n) => n + 1)

  function pushToast(message: string) {
    const id = ++vendorPageToastId
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedId(openId)
      router.replace("/vendors", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data, error } = await supabase
        .from("org_vendors")
        .select("id, name, contact_name, email, phone, is_archived")
        .eq("organization_id", organizationId)
        .order("name")
      if (cancelled) return
      setLoading(false)
      if (error) {
        setLoadError(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as VendorListRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId, refreshToken])

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter === "active") list = list.filter((r) => !r.is_archived)
    if (statusFilter === "archived") list = list.filter((r) => r.is_archived)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.contact_name?.toLowerCase().includes(q) ?? false) ||
          (r.email?.toLowerCase().includes(q) ?? false) ||
          (r.phone?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [rows, search, statusFilter])

  return (
    <div className="flex flex-col gap-6">
      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading vendors…
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search name, contact, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-40 text-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Button
            size="sm"
            className="gap-2 cursor-pointer"
            onClick={() => {
              if (blockCreateIfNotEligible(standardCreateEligibility)) return
              setAddOpen(true)
            }}
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                  Phone
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    No vendors match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell max-w-[160px] truncate">
                      {r.contact_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                      {r.email?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {r.phone?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge archived={r.is_archived} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <VendorDrawer
        vendorId={selectedId}
        onClose={() => setSelectedId(null)}
        onVendorChanged={refresh}
      />

      <AddVendorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          refresh()
          pushToast("Vendor created")
        }}
      />

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  )
}

export default function VendorsPage() {
  return (
    <Suspense fallback={null}>
      <VendorsPageInner />
    </Suspense>
  )
}
