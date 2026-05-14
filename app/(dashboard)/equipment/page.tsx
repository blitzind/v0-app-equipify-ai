"use client"

import { Component, useState, useMemo, useEffect, useRef, Suspense, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal"
import { AIScanModal } from "@/components/equipment/ai-scan-modal"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewToggle } from "@/components/ui/view-toggle"
import { AidenOperationalInsightsCard } from "@/components/aiden/aiden-operational-insights-card"
import {
  Search,
  Plus,
  ArrowUpDown,
  ChevronRight,
  Wrench,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Download,
  Tag,
  Sparkles,
} from "lucide-react"
import { EquipmentDrawer } from "@/components/drawers/equipment-drawer"
import { equipmentMatchesSearch, getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import {
  EQUIPMENT_PAGE_SELECT_FULL,
  EQUIPMENT_PAGE_SELECT_LEGACY,
  isEquipmentListSchemaMismatchError,
  logEquipmentListQueryFailure,
} from "@/lib/equipment/equipment-detail-queries"
import {
  loadEquipmentSignalsByIds,
  type EquipmentSignals,
} from "@/lib/equipment/intelligence-rollup"
import { EquipmentSignalsRow } from "@/components/equipment/equipment-signals-row"
import { applyArchivedAtScope } from "@/lib/archive-scope"
import type { RecordArchiveVisibility } from "@/lib/org-quotes-invoices/repository"

type SortKey = "model" | "customerName" | "nextDueDate" | "lastServiceDate" | "category"
type SortDir = "asc" | "desc"
type ViewMode = "table" | "card"

type EquipmentStatus = "Active" | "Needs Service" | "Out of Service" | "In Repair"

type Equipment = {
  id: string
  customerId: string
  customerName: string
  equipmentCode: string
  model: string
  manufacturer: string
  category: string
  subcategory: string
  serialNumber: string
  lastServiceDate: string
  nextDueDate: string
  nextCalibrationDue: string
  warrantyExpiresAt: string
  status: EquipmentStatus
  location: string
  isArchived?: boolean
}

type DbEquipmentRow = {
  id: string
  customer_id: string
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  /** Absent when DB predates equipment intelligence migration. */
  subcategory?: string | null
  serial_number: string | null
  status: "active" | "needs_service" | "out_of_service" | "in_repair"
  last_service_at: string | null
  next_due_at: string | null
  next_calibration_due_at?: string | null
  warranty_expires_at: string | null
  location_label: string | null
  archived_at: string | null
}

function userVisibleEquipmentQueryError(err: { message?: string } | null): string {
  if (process.env.NODE_ENV !== "production") {
    return err?.message?.trim() || "Equipment query failed."
  }
  return "Could not load equipment. Try refreshing the page. If the problem continues, contact support."
}

function warnNonProduction(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message)
  }
}

function equipmentPageRuntimeLog(stage: string, details?: Record<string, unknown>): void {
  console.warn("[equipify:equipment-page-runtime]", stage, details ?? {})
}

function equipmentSelectionLog(stage: string, details?: Record<string, unknown>): void {
  console.warn("[equipify:equipment-selection]", stage, details ?? {})
}

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function safeDatePrefix(value: unknown, fallback: string): string {
  const s = safeText(value)
  return s ? s.slice(0, 10) : fallback
}

class PassiveEquipmentBoundary extends Component<
  { label: string; children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    equipmentPageRuntimeLog("widget_failed", {
      label: this.props.label,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
            {this.props.label} is temporarily unavailable.
          </p>
        )
      )
    }
    return this.props.children
  }
}

const statusColors: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

const allStatuses = ["Active", "Needs Service", "In Repair", "Out of Service"] as const
// allCategories computed inside component from store

/** Format an ISO date string (YYYY-MM-DD) using UTC so server and client agree. */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

function daysToDue(nextDueDate: string) {
  // Compare UTC midnight of the due date against UTC midnight of today.
  const due   = new Date(nextDueDate + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

function DueBadge({ nextDueDate }: { nextDueDate: string }) {
  const days = daysToDue(nextDueDate)
  if (days < 0) return <span className="text-xs font-medium text-destructive">Overdue</span>
  if (days <= 7) return <span className="text-xs font-medium text-[color:var(--status-warning)]">Due in {days}d</span>
  if (days <= 30) return <span className="text-xs font-medium text-[color:var(--status-info)]">Due in {days}d</span>
  return <span className="text-xs text-muted-foreground">{fmtDate(nextDueDate)}</span>
}

function EquipmentCard({ eq, signals, selected, onSelect, onOpen }: {
  eq: Equipment
  signals?: EquipmentSignals
  selected: boolean
  onSelect: () => void
  onOpen: (id: string) => void
}) {
  const days = daysToDue(eq.nextDueDate)
  const urgent = days < 0 || days <= 7

  return (
    <Card className={cn("relative hover:border-primary/40 hover:shadow-sm transition-all group", selected && "border-primary/60 ring-1 ring-primary/20")}>
      <CardContent className="p-5">
        {/* Checkbox */}
        <div className="absolute top-4 left-4">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className="pl-7">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                {getEquipmentDisplayPrimary({
                  id: eq.id,
                  name: eq.model,
                  equipment_code: eq.equipmentCode,
                  serial_number: eq.serialNumber,
                  category: [eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ") || eq.category,
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getEquipmentSecondaryLine(
                  {
                    id: eq.id,
                    name: eq.model,
                    equipment_code: eq.equipmentCode,
                    serial_number: eq.serialNumber,
                    category: [eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ") || eq.category,
                    manufacturer: eq.manufacturer,
                  },
                  eq.customerName,
                )}
                {eq.manufacturer ? ` · ${eq.manufacturer}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1 justify-end shrink-0">
              <Badge variant="secondary" className={cn("text-xs shrink-0", statusColors[eq.status])}>
                {eq.status}
              </Badge>
              {eq.isArchived ? (
                <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                  Archived
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 col-span-2">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <Link href={`/customers/${eq.customerId}`} className="hover:text-primary transition-colors truncate" onClick={(e) => e.stopPropagation()}>
                {eq.customerName}
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {[eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{eq.location}</span>
            </div>
          </div>

          <div className={cn(
            "flex items-center justify-between mt-4 pt-3 border-t border-border text-xs",
            urgent ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
          )}>
            <div className="flex items-center gap-1.5">
              {urgent && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              <Calendar className={cn("w-3.5 h-3.5 shrink-0", urgent && "hidden")} />
              <DueBadge nextDueDate={eq.nextDueDate} />
            </div>
            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-xs" onClick={(e) => { e.stopPropagation(); onOpen(eq.id) }}>
              View <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <PassiveEquipmentBoundary label="Equipment signals" fallback={null}>
            <EquipmentSignalsRow signals={signals} className="mt-2" />
          </PassiveEquipmentBoundary>

        </div>
      </CardContent>
    </Card>
  )
}

function EquipmentPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { equipmentCreateEligibility } = useBillingAccess()
  const assignedOnlyView = isAssignedWorkOnly(permissions)
  const canManageEquipmentRecords = !assignedOnlyView
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [signalsMap, setSignalsMap] = useState<Map<string, EquipmentSignals>>(() => new Map())
  const [refreshToken, setRefreshToken] = useState(0)
  const allCategories = useMemo(() => [...new Set(equipment.map((e) => e.category))].sort(), [equipment])
  const searchParams = useSearchParams()
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [complianceFilter, setComplianceFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("nextDueDate")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [archiveScope, setArchiveScope] = useState<RecordArchiveVisibility>("active")
  const [queryWarning, setQueryWarning] = useState<string | null>(null)
  const previousSelectedCountRef = useRef(0)

  // Auto-open drawer from ?open= query param
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      if (!assignedOnlyView) {
        setSelectedEquipmentId(openId)
        setArchiveScope("all")
      }
      router.replace("/equipment", { scroll: false })
    }
  }, [searchParams, router, assignedOnlyView])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addEquipmentPrefillCustomerId, setAddEquipmentPrefillCustomerId] = useState<string | null>(null)
  const [scanModalOpen, setScanModalOpen] = useState(false)

  function openAddEquipmentModal(prefillCustomerId: string | null) {
    if (!canManageEquipmentRecords) return
    if (blockCreateIfNotEligible(equipmentCreateEligibility)) return
    setAddEquipmentPrefillCustomerId(prefillCustomerId)
    setAddModalOpen(true)
  }

  function openScanModal() {
    if (!canManageEquipmentRecords) return
    if (blockCreateIfNotEligible(equipmentCreateEligibility)) return
    setScanModalOpen(true)
  }

  useQuickAdd("new-equipment", () => {
    openAddEquipmentModal(null)
  })

  useEffect(() => {
    const action = searchParams.get("action")
    const cid = searchParams.get("customerId")
    if (action === "new-equipment") {
      if (blockCreateIfNotEligible(equipmentCreateEligibility)) {
        router.replace("/equipment", { scroll: false })
        return
      }
      setAddEquipmentPrefillCustomerId(cid)
      setAddModalOpen(true)
      router.replace("/equipment", { scroll: false })
    }
  }, [searchParams, router, equipmentCreateEligibility])

  useEffect(() => {
    let active = true

    async function loadEquipment() {
      equipmentPageRuntimeLog("refresh_start", { refreshToken, orgStatus, hasOrg: Boolean(activeOrgId) })
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (active) {
            setEquipment([])
            setQueryWarning(null)
          }
          return
        }

        if (!activeOrgId) {
          if (active) {
            setEquipment([])
            setQueryWarning(null)
          }
          return
        }

        if (orgStatus !== "ready") {
          return
        }

        const orgId = activeOrgId
        if (active) setQueryWarning(null)
        let assignedScope: Awaited<ReturnType<typeof loadAssignedWorkScope>> | null = null
        try {
          assignedScope = assignedOnlyView
            ? await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
            : null
        } catch (e) {
          equipmentPageRuntimeLog("refresh_failed_assigned_scope", {
            message: e instanceof Error ? e.message : String(e),
          })
          if (active) setQueryWarning("Equipment assignment scope could not refresh. Showing available equipment data.")
          assignedScope = null
        }
        const scopedEquipmentIds = assignedScope?.equipmentIds ?? []

        if (assignedOnlyView && scopedEquipmentIds.length === 0) {
          if (active) {
            setEquipment([])
            setQueryWarning(null)
          }
          return
        }

        let eqQuery = supabase
          .from("equipment")
          .select(EQUIPMENT_PAGE_SELECT_FULL)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })

        if (assignedOnlyView) eqQuery = eqQuery.in("id", scopedEquipmentIds).is("archived_at", null)
        else eqQuery = applyArchivedAtScope(eqQuery, archiveScope)

        const firstRes = await eqQuery
        let equipmentError = firstRes.error
        let equipmentRows = (firstRes.data as DbEquipmentRow[] | null) ?? null
        let schemaFallback = false

        if (equipmentError && isEquipmentListSchemaMismatchError(equipmentError)) {
          logEquipmentListQueryFailure("initial_schema_fallback", equipmentError, { organizationId: orgId })

          let legacyQ = supabase
            .from("equipment")
            .select(EQUIPMENT_PAGE_SELECT_LEGACY)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
          if (assignedOnlyView) legacyQ = legacyQ.in("id", scopedEquipmentIds).is("archived_at", null)
          else legacyQ = applyArchivedAtScope(legacyQ, archiveScope)
          const legacyRes = await legacyQ
          equipmentError = legacyRes.error
          equipmentRows = (legacyRes.data as DbEquipmentRow[] | null) ?? null
          schemaFallback = true
          if (!equipmentError && schemaFallback) {
            warnNonProduction(
              "[equipment] Loaded with LEGACY column set. Apply migration 20260720120000_equipment_intelligence_phase1 for full fields.",
            )
          }
        }

        if (equipmentError) {
          logEquipmentListQueryFailure(schemaFallback ? "legacy_fallback_failed" : "fatal", equipmentError, {
            organizationId: orgId,
          })
          if (active) {
            setQueryWarning(userVisibleEquipmentQueryError(equipmentError))
            equipmentPageRuntimeLog("refresh_failed_equipment_query", {
              message: equipmentError.message,
              schemaFallback,
            })
          }
          return
        }

        if (!equipmentRows) {
          if (active) {
            setQueryWarning(userVisibleEquipmentQueryError({ message: "No data returned." }))
            equipmentPageRuntimeLog("refresh_failed_no_rows")
          }
          return
        }

        const rows = Array.isArray(equipmentRows) ? equipmentRows : []
        const customerIds = [...new Set(rows.map((row) => safeText(row?.customer_id)).filter(Boolean))]
        let customerMap = new Map<string, string>()

        if (customerIds.length > 0) {
          try {
            const { data: customerRows, error: customerError } = await supabase
              .from("customers")
              .select("id, company_name")
              .eq("organization_id", orgId)
              .in("id", customerIds)

            if (customerError) {
              equipmentPageRuntimeLog("refresh_failed_customer_lookup", { message: customerError.message })
            }
            ;((customerRows as Array<{ id?: string | null; company_name?: string | null }> | null) ?? []).forEach((row) => {
              const id = safeText(row.id)
              if (id) customerMap.set(id, safeText(row.company_name, "Unknown Customer"))
            })
          } catch (e) {
            equipmentPageRuntimeLog("refresh_threw_customer_lookup", {
              message: e instanceof Error ? e.message : String(e),
            })
          }
        }

        const statusMap: Record<DbEquipmentRow["status"], EquipmentStatus> = {
          active: "Active",
          needs_service: "Needs Service",
          out_of_service: "Out of Service",
          in_repair: "In Repair",
        }

        let mapped: Equipment[] = []
        try {
          mapped = rows
            .filter((row) => row && safeText(row.id))
            .map((row) => {
              const customerId = safeText(row.customer_id)
              return {
                id: safeText(row.id),
                customerId,
                customerName: customerMap.get(customerId) ?? "Unknown Customer",
                equipmentCode: safeText(row.equipment_code),
                model: safeText(row.name, "Untitled equipment"),
                manufacturer: safeText(row.manufacturer),
                category: safeText(row.category, "General"),
                subcategory: safeText(row.subcategory).trim() ? safeText(row.subcategory) : "",
                serialNumber: safeText(row.serial_number),
                lastServiceDate: safeDatePrefix(row.last_service_at, "1970-01-01"),
                nextDueDate: safeDatePrefix(row.next_due_at, "2099-12-31"),
                nextCalibrationDue: safeDatePrefix(row.next_calibration_due_at, ""),
                warrantyExpiresAt: safeDatePrefix(row.warranty_expires_at, ""),
                status: statusMap[row.status] ?? "Active",
                location: safeText(row.location_label, "—"),
                isArchived: Boolean(row.archived_at),
              }
            })
        } catch (e) {
          warnNonProduction(`[equipment] Row mapping failed: ${e instanceof Error ? e.message : String(e)}`)
          if (active) {
            setQueryWarning(userVisibleEquipmentQueryError(e instanceof Error ? e : null))
            equipmentPageRuntimeLog("refresh_failed_mapping", {
              message: e instanceof Error ? e.message : String(e),
            })
          }
          return
        }

        if (active) {
          setEquipment(mapped)
          setQueryWarning(null)
          equipmentPageRuntimeLog("refresh_success", { count: mapped.length, refreshToken })
        }
      } catch (e) {
        warnNonProduction(`[equipment] loadEquipment failed: ${e instanceof Error ? e.message : String(e)}`)
        if (active) {
          setQueryWarning(userVisibleEquipmentQueryError(e instanceof Error ? e : null))
          equipmentPageRuntimeLog("refresh_failed_unexpected", {
            message: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }

    void loadEquipment()

    return () => {
      active = false
    }
  }, [refreshToken, orgStatus, activeOrgId, archiveScope, assignedOnlyView])

  useEffect(() => {
    let active = true
    if (orgStatus !== "ready" || !activeOrgId || equipment.length === 0) {
      setSignalsMap(new Map())
      return () => {
        active = false
      }
    }
    const ids = equipment.slice(0, 250).map((e) => e.id)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      try {
        equipmentPageRuntimeLog("signals_refresh_start", { count: ids.length })
        const map = await loadEquipmentSignalsByIds(supabase, {
          organizationId: activeOrgId,
          equipmentIds: ids,
        })
        if (active) {
          setSignalsMap(map instanceof Map ? map : new Map())
          equipmentPageRuntimeLog("signals_refresh_success", { count: map instanceof Map ? map.size : 0 })
        }
      } catch (e) {
        warnNonProduction(`[equipment] Signals load failed: ${e instanceof Error ? e.message : String(e)}`)
        equipmentPageRuntimeLog("signals_refresh_failed", {
          message: e instanceof Error ? e.message : String(e),
        })
        if (active) setSignalsMap(new Map())
      }
    })()
    return () => {
      active = false
    }
  }, [equipment, orgStatus, activeOrgId])

  const filtered = useMemo(() => {
    let list = [...equipment]

    if (search.trim()) {
      list = list.filter((e) =>
        equipmentMatchesSearch(
          search,
          {
            id: e.id,
            name: e.model,
            equipment_code: e.equipmentCode,
            serial_number: e.serialNumber,
            category: e.category,
            subcategory: e.subcategory,
            manufacturer: e.manufacturer,
          },
          e.customerName,
        ),
      )
    }

    if (statusFilter !== "all") {
      list = list.filter((e) => e.status === statusFilter)
    }

    if (categoryFilter !== "all") {
      list = list.filter((e) => e.category === categoryFilter)
    }

    const today = new Date().toISOString().slice(0, 10)
    if (complianceFilter === "maintenance_overdue") {
      list = list.filter(
        (e) => e.nextDueDate !== "2099-12-31" && e.nextDueDate < today,
      )
    } else if (complianceFilter === "calibration_overdue") {
      list = list.filter((e) => e.nextCalibrationDue.trim() && e.nextCalibrationDue < today)
    } else if (complianceFilter === "warranty_expiring") {
      list = list.filter((e) => {
        if (!e.warrantyExpiresAt.trim()) return false
        const d = daysToDue(e.warrantyExpiresAt)
        return d >= 0 && d <= 90
      })
    }

    list.sort((a, b) => {
      const av = a[sortKey] as string
      const bv = b[sortKey] as string
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    return list
  }, [equipment, search, statusFilter, categoryFilter, complianceFilter, sortKey, sortDir])

  useEffect(() => {
    equipmentSelectionLog("equipment_table_rerender", {
      equipmentCount: equipment.length,
      filteredCount: filtered.length,
      selectedCount: selected.size,
      refreshToken,
    })
  })

  useEffect(() => {
    const previous = previousSelectedCountRef.current
    if (previous > 0 && selected.size === 0) {
      equipmentSelectionLog("row_selection_reset", { previous, refreshToken })
    }
    previousSelectedCountRef.current = selected.size
    equipmentSelectionLog("selected_row_count", { count: selected.size, refreshToken })
  }, [selected.size, refreshToken])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function setRowSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      equipmentSelectionLog("row_selection_updated", {
        idHint: id.slice(-8),
        checked,
        previousCount: prev.size,
        nextCount: next.size,
      })
      return next
    })
  }

  function toggleSelect(id: string) {
    setRowSelected(id, !selected.has(id))
  }

  function setAllVisibleSelected(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const eq of filtered) {
        if (checked) next.add(eq.id)
        else next.delete(eq.id)
      }
      equipmentSelectionLog("row_selection_updated", {
        scope: "visible",
        checked,
        visibleCount: filtered.length,
        previousCount: prev.size,
        nextCount: next.size,
      })
      return next
    })
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground/50 inline" />
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline text-primary" />
  }

  return (
    <div className="flex flex-col gap-6">
      {queryWarning ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground"
        >
          {queryWarning}
          {process.env.NODE_ENV !== "production" ? (
            <span className="block text-xs mt-1 text-muted-foreground font-mono">
              Check the browser console for <code className="font-mono">[equipify:equipment-page-runtime]</code> details.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Toolbar */}
      {assignedOnlyView ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Technician equipment view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing equipment tied to your assigned active work orders. Equipment creation, archived records, bulk assignment, and removal are restricted to admins and managers.
          </p>
        </div>
      ) : null}
      {orgStatus === "ready" && activeOrgId ?
        <PassiveEquipmentBoundary label="Operational insights" fallback={null}>
          <AidenOperationalInsightsCard organizationId={activeOrgId} moduleContext="equipment" />
        </PassiveEquipmentBoundary>
      : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-11 items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {allStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Compliance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All compliance</SelectItem>
              <SelectItem value="maintenance_overdue">Maintenance overdue</SelectItem>
              <SelectItem value="calibration_overdue">Calibration overdue</SelectItem>
              <SelectItem value="warranty_expiring">Warranty expiring (90d)</SelectItem>
            </SelectContent>
          </Select>

          {canManageEquipmentRecords ? (
          <Select value={archiveScope} onValueChange={(v) => setArchiveScope(v as RecordArchiveVisibility)}>
            <SelectTrigger className="w-[132px]">
              <SelectValue placeholder="Records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          ) : null}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          {canManageEquipmentRecords ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 shrink-0 cursor-pointer">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Equipment</span>
                <span className="sm:hidden">Add</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="gap-2.5 cursor-pointer py-2.5"
                onClick={() => {
                  openAddEquipmentModal(null)
                }}
              >
                <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Manual Entry</p>
                  <p className="text-xs text-muted-foreground">Fill in details by hand</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2.5 cursor-pointer py-2.5"
                onClick={() => openScanModal()}
              >
                <Sparkles className="w-4 h-4 text-[color:var(--ds-info-subtle)] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[color:var(--ds-info-text)]">Scan with AI</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a photo, PDF certificate, or spec sheet to auto-fill
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {canManageEquipmentRecords && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Tag className="w-3.5 h-3.5" /> Assign Plan
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => {
                equipmentSelectionLog("row_selection_reset", { reason: "clear_button", previous: selected.size })
                setSelected(new Set())
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-sm text-muted-foreground -mt-2">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{equipment.length}</span> equipment
      </p>

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="ds-table-header-row h-12">
                {canManageEquipmentRecords ? (
                <TableHead className="w-12 min-w-12 px-0">
                  <div className="flex h-full w-full items-center justify-center">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        equipmentSelectionLog("row_checkbox_clicked", { scope: "all_visible" })
                      }}
                      onCheckedChange={(checked) => setAllVisibleSelected(checked === true)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
                ) : null}
                <TableHead>
                  <button onClick={() => toggleSort("model")} className="ds-btn-sort">
                    Model <SortIcon col="model" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("customerName")} className="ds-btn-sort">
                    Customer <SortIcon col="customerName" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("category")} className="ds-btn-sort">
                    Category <SortIcon col="category" />
                  </button>
                </TableHead>
                <TableHead className="ds-btn-sort pointer-events-none">Status</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("lastServiceDate")} className="ds-btn-sort">
                    Last Service <SortIcon col="lastServiceDate" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("nextDueDate")} className="ds-btn-sort">
                    Next Due <SortIcon col="nextDueDate" />
                  </button>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageEquipmentRecords ? 8 : 7} className="text-center py-12 text-muted-foreground text-sm">
                    No equipment matches your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((eq) => (
                  <TableRow
                    key={eq.id}
                    className={cn(
                      "group cursor-pointer ds-hover-list-row h-14",
                      selected.has(eq.id) && "bg-primary/5",
                    )}
                    onClick={() => setSelectedEquipmentId(eq.id)}
                  >
                    {canManageEquipmentRecords ? (
                    <TableCell
                      className="w-12 min-w-12 px-0 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex h-full w-full items-center justify-center">
                        <Checkbox
                          checked={selected.has(eq.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            equipmentSelectionLog("row_checkbox_clicked", {
                              idHint: eq.id.slice(-8),
                              checked: selected.has(eq.id),
                            })
                          }}
                          onCheckedChange={(checked) => setRowSelected(eq.id, checked === true)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          aria-label={`Select ${eq.model}`}
                        />
                      </div>
                    </TableCell>
                    ) : null}
                    <TableCell className="pl-4">
                      <div className="flex flex-col justify-center gap-1">
                        <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {getEquipmentDisplayPrimary({
                            id: eq.id,
                            name: eq.model,
                            equipment_code: eq.equipmentCode,
                            serial_number: eq.serialNumber,
                            category: [eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ") || eq.category,
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getEquipmentSecondaryLine(
                            {
                              id: eq.id,
                              name: eq.model,
                              equipment_code: eq.equipmentCode,
                              serial_number: eq.serialNumber,
                              category: [eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ") || eq.category,
                              manufacturer: eq.manufacturer,
                            },
                            eq.customerName,
                          )}
                        </span>
                        <PassiveEquipmentBoundary label="Equipment signals" fallback={null}>
                          <EquipmentSignalsRow signals={signalsMap.get(eq.id)} className="mt-0.5" />
                        </PassiveEquipmentBoundary>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${eq.customerId}`} className="text-sm text-foreground hover:text-primary transition-colors">
                        {eq.customerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[eq.category, eq.subcategory].filter((x) => x?.trim()).join(" › ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className={cn("text-xs", statusColors[eq.status])}>
                          {eq.status}
                        </Badge>
                        {eq.isArchived ? (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                            Archived
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(eq.lastServiceDate)}
                    </TableCell>
                    <TableCell>
                      <DueBadge nextDueDate={eq.nextDueDate} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedEquipmentId(eq.id)}
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No equipment matches your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((eq) => (
                <EquipmentCard
                  key={eq.id}
                  eq={eq}
                  signals={signalsMap.get(eq.id)}
                  selected={selected.has(eq.id)}
                  onSelect={() => toggleSelect(eq.id)}
                  onOpen={(id) => setSelectedEquipmentId(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <PassiveEquipmentBoundary label="Equipment drawer" fallback={null}>
        <EquipmentDrawer
          equipmentId={selectedEquipmentId}
          onClose={() => setSelectedEquipmentId(null)}
          onUpdated={() => {
            equipmentPageRuntimeLog("drawer_refresh_requested")
            setRefreshToken((v) => v + 1)
          }}
        />
      </PassiveEquipmentBoundary>

      <AddEquipmentModal
        open={addModalOpen}
        prefilledCustomerId={addEquipmentPrefillCustomerId}
        onClose={() => {
          setAddModalOpen(false)
          setAddEquipmentPrefillCustomerId(null)
        }}
        onSuccess={() => {
          equipmentPageRuntimeLog("save_succeeded_refresh_requested")
          setRefreshToken((v) => v + 1)
        }}
        onCreateMaintenancePlan={({ customerId, equipmentId }) => {
          const q = new URLSearchParams({
            new: "1",
            customerId,
            equipmentId,
          })
          router.push(`/maintenance-plans?${q.toString()}`)
        }}
      />

      <AIScanModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        organizationId={activeOrgId}
        orgReady={orgStatus === "ready"}
        equipmentCreateEligibility={equipmentCreateEligibility}
        onSaved={() => {
          equipmentPageRuntimeLog("ai_scan_save_refresh_requested")
          setRefreshToken((v) => v + 1)
        }}
      />

      <QuickAddParamBridge
        action="new-equipment"
        onTrigger={() => {
          openAddEquipmentModal(null)
        }}
      />
    </div>
  )
}

export default function EquipmentPage() {
  return <Suspense fallback={null}><EquipmentPageInner /></Suspense>
}
