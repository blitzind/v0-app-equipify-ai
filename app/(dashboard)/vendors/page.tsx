"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { VendorBulkArchiveDialog } from "@/components/vendors/vendor-bulk-archive-dialog"
import { bulkArchiveVendorsViaApi } from "@/lib/vendors/bulk-archive-vendors-client"
import {
  bulkVendorArchivePartialToast,
  bulkVendorArchiveSuccessToast,
  BULK_VENDOR_ARCHIVE_PARTIAL_DESCRIPTION,
} from "@/lib/vendors/bulk-archive-messages"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { useToast } from "@/hooks/use-toast"
import { DrawerToastStack, type ToastItem } from "@/components/detail-drawer"

let vendorPageToastId = 0

type VendorListRow = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  archived_at: string | null
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
  const { canArchiveRestore } = useOrgArchivePermissions()
  const { toast } = useToast()
  const [rows, setRows] = useState<VendorListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(() => new Set())
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const [bulkArchiveBusy, setBulkArchiveBusy] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const canBulkArchiveFromList = canArchiveRestore && statusFilter === "active"
  const selectedCount = selectedVendorIds.size

  const clearSelection = useCallback(() => {
    setSelectedVendorIds(new Set())
  }, [])

  useEffect(() => {
    clearSelection()
  }, [search, statusFilter, clearSelection])

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
        .select("id, name, contact_name, email, phone, archived_at")
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
    if (statusFilter === "active") list = list.filter((r) => !r.archived_at)
    if (statusFilter === "archived") list = list.filter((r) => Boolean(r.archived_at))
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

  const selectableFiltered = useMemo(
    () => filtered.filter((r) => !r.archived_at),
    [filtered],
  )

  const toggleAllVisibleSelection = useCallback(() => {
    const visibleIds = selectableFiltered.map((r) => r.id)
    if (visibleIds.length === 0) return
    setSelectedVendorIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(visibleIds)
    })
  }, [selectableFiltered])

  const allVisibleSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((r) => selectedVendorIds.has(r.id))
  const someVisibleSelected =
    selectableFiltered.some((r) => selectedVendorIds.has(r.id)) && !allVisibleSelected

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function confirmBulkArchive() {
    if (!organizationId || selectedVendorIds.size === 0) return
    setBulkArchiveBusy(true)
    const ids = [...selectedVendorIds]
    const res = await bulkArchiveVendorsViaApi({ organizationId, vendorIds: ids })
    setBulkArchiveBusy(false)
    if (!res.ok) {
      toast({ variant: "destructive", title: res.message })
      return
    }
    setBulkArchiveOpen(false)
    if (res.succeededCount === 0) {
      toast({ variant: "destructive", title: "Could not archive selected vendors." })
      return
    }
    if (selectedVendorIds.has(selectedId ?? "")) {
      setSelectedId(null)
    }
    refresh()
    if (res.failedCount === 0) {
      clearSelection()
      toast({ title: bulkVendorArchiveSuccessToast(res.succeededCount) })
      return
    }
    setSelectedVendorIds(new Set(res.failedIds))
    toast({
      variant: "destructive",
      title: bulkVendorArchivePartialToast(res.succeededCount, res.failedCount),
      description: BULK_VENDOR_ARCHIVE_PARTIAL_DESCRIPTION,
    })
  }

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

      {canBulkArchiveFromList && selectedCount > 0 ? (
        <div className="hidden md:flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} vendor{selectedCount === 1 ? "" : "s"} selected
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8"
            onClick={() => setBulkArchiveOpen(true)}
          >
            Archive selected
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border ds-table-header-row">
                {canBulkArchiveFromList ? (
                  <th className="hidden md:table-cell w-10 px-4 py-3">
                    <Checkbox
                      aria-label="Select all visible vendors"
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      disabled={selectableFiltered.length === 0 || loading}
                      onCheckedChange={toggleAllVisibleSelection}
                    />
                  </th>
                ) : null}
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
                  <td
                    colSpan={canBulkArchiveFromList ? 7 : 6}
                    className="text-center py-16 text-muted-foreground text-sm"
                  >
                    No vendors match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="ds-hover-list-row cursor-pointer group"
                    onClick={() => setSelectedId(r.id)}
                  >
                    {canBulkArchiveFromList ? (
                      <td
                        className="hidden md:table-cell w-10 px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          aria-label={`Select ${r.name}`}
                          checked={selectedVendorIds.has(r.id)}
                          disabled={Boolean(r.archived_at)}
                          onCheckedChange={() => toggleRowSelection(r.id)}
                        />
                      </td>
                    ) : null}
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
                      <StatusBadge archived={Boolean(r.archived_at)} />
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

      <VendorBulkArchiveDialog
        open={bulkArchiveOpen}
        onOpenChange={(open) => {
          if (!open && !bulkArchiveBusy) setBulkArchiveOpen(false)
        }}
        selectedCount={selectedCount}
        busy={bulkArchiveBusy}
        onConfirm={() => void confirmBulkArchive()}
      />
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
