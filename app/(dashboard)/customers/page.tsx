"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import { AddCustomerModal } from "@/components/customers/add-customer-modal"
import { applyArchivedAtScope } from "@/lib/archive-scope"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { useCustomers } from "@/lib/customer-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Card, CardContent } from "@/components/ui/card"
import { ViewToggle } from "@/components/ui/view-toggle"
import {
  Search,
  Plus,
  ArrowUpDown,
  Building2,
  MapPin,
  Wrench,
  ClipboardList,
  ChevronRight,
} from "lucide-react"
import { CustomerDrawer } from "@/components/drawers/customer-drawer"
import { AidenOperationalInsightsCard } from "@/components/aiden/aiden-operational-insights-card"
import { ContactActions, type ContactActionsProps } from "@/components/contact-actions"
import type { RecordArchiveVisibility } from "@/lib/org-quotes-invoices/repository"
import { loadHierarchySummariesForList } from "@/lib/customers/hierarchy"

type SortKey = "company" | "equipmentCount" | "openWorkOrders" | "joinedDate"
type SortDir = "asc" | "desc"
type ViewMode = "table" | "card"
type HierarchyScope = "all" | "parents" | "children" | "standalone"

type CustomerStatus = "Active" | "Inactive"

type Customer = {
  id: string
  company: string
  name: string
  status: CustomerStatus
  locations: Array<{
    id: string
    address: string
    city: string
    state: string
    zip: string
  }>
  contacts: Array<{
    email: string
    phone: string
    /** Primary contact display name from `customer_contacts.full_name` */
    name: string
  }>
  contracts: Array<{ id: string }>
  equipmentCount: number
  openWorkOrders: number
  joinedDate: string
  isArchived?: boolean
  /** Phase 1 hierarchy: number of direct active sub-accounts. */
  childCount: number
  /** Phase 1 hierarchy: parent customer (when this row is itself a sub-account). */
  parent?: { id: string; companyName: string } | null
}

type DbCustomerRow = {
  id: string
  company_name: string
  status: "active" | "inactive"
  joined_at: string | null
  archived_at: string | null
}

type DbContactRow = {
  customer_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  is_primary: boolean | null
}

type DbLocationRow = {
  customer_id: string
  id: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  is_default: boolean | null
}

/** Non-empty address string for maps when any location field is present. */
function formatLocationForMaps(loc: Customer["locations"][number]): string | undefined {
  const street = (loc.address ?? "").trim()
  const city = (loc.city ?? "").trim()
  const state = (loc.state ?? "").trim()
  const zip = (loc.zip ?? "").trim()
  const parts: string[] = []
  if (street) parts.push(street)
  const cityState = [city, state].filter(Boolean).join(", ")
  if (cityState) parts.push(cityState)
  else if (city || state) parts.push([city, state].filter(Boolean).join(", "))
  if (zip) parts.push(zip)
  const s = parts.join(", ").trim()
  return s || undefined
}

function buildCustomerContactActionProps(c: Customer): Pick<ContactActionsProps, "address" | "email" | "phone"> {
  const primaryLoc = c.locations[0]
  const address = primaryLoc ? formatLocationForMaps(primaryLoc) : undefined
  const emailAddr = c.contacts.map((ct) => ct.email).find((e) => e?.trim())
  const phone = c.contacts.map((ct) => ct.phone).find((p) => p?.trim())
  return {
    address,
    email: emailAddr ? { customerName: c.company, customerEmail: emailAddr.trim() } : undefined,
    phone: phone?.trim(),
  }
}

function StatusBadge({ status }: { status: Customer["status"] }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-medium",
        status === "Active"
          ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  )
}

function CustomerCard({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-semibold text-sm shrink-0">
                {customer.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                  {customer.company}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{customer.name}</p>
                {customer.parent ? (
                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-[color:var(--status-info)]">
                    Sub-account of <span className="font-semibold">{customer.parent.companyName}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 justify-end">
              <StatusBadge status={customer.status} />
              {customer.childCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] border border-primary/30 bg-primary/10 text-primary font-semibold"
                  title={`${customer.childCount} sub-account${customer.childCount === 1 ? "" : "s"}`}
                >
                  Parent · {customer.childCount}
                </Badge>
              ) : null}
              {customer.isArchived ? (
                <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                  Archived
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.locations.length} location{customer.locations.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.equipmentCount} equipment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span className={cn(customer.openWorkOrders > 0 ? "text-[color:var(--status-warning)] font-medium" : "")}>
                {customer.openWorkOrders} open WOs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.contracts.length} contract{customer.contracts.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Quick contact actions */}
          <div className="mt-4 pt-3 border-t border-border">
            <ContactActions {...buildCustomerContactActionProps(customer)} />
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Since {new Date(customer.joinedDate).getFullYear()}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
  )
}

function CustomersPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { standardCreateEligibility } = useBillingAccess()
  const assignedOnlyView = isAssignedWorkOnly(permissions)
  const [customers, setCustomers] = useState<Customer[]>([])
  const { customers: drawerCustomers, addCustomer } = useCustomers()
  const [refreshToken, setRefreshToken] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  function openNewCustomerModal() {
    if (assignedOnlyView) return
    if (blockCreateIfNotEligible(standardCreateEligibility)) return
    setShowAddModal(true)
  }
  useQuickAdd("new-customer", () => openNewCustomerModal())
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all")
  const [archiveScope, setArchiveScope] = useState<RecordArchiveVisibility>("active")
  const [sortKey, setSortKey] = useState<SortKey>("company")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadCustomers() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) setCustomers([])
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (active) setCustomers([])
        return
      }

      const orgId = activeOrgId
      const assignedScope = assignedOnlyView
        ? await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
        : null
      const scopedCustomerIds = assignedScope?.customerIds ?? []

      if (assignedOnlyView && scopedCustomerIds.length === 0) {
        if (active) setCustomers([])
        return
      }

      let custQuery = supabase
        .from("customers")
        .select("id, company_name, status, joined_at, archived_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })

      if (assignedOnlyView) custQuery = custQuery.in("id", scopedCustomerIds).is("archived_at", null)
      else custQuery = applyArchivedAtScope(custQuery, archiveScope)

      const { data, error } = await custQuery

      if (error || !data) {
        if (active) setCustomers([])
        return
      }

      const customerRows = data as DbCustomerRow[]
      const customerIds = customerRows.map((row) => row.id)

      const contactsByCustomer = new Map<string, DbContactRow[]>()
      const locationsByCustomer = new Map<string, DbLocationRow[]>()
      const hierarchyByCustomer = await loadHierarchySummariesForList(supabase, {
        organizationId: orgId,
        customerIds,
      })

      // Build a name lookup so we can render "Child of <Parent>" without a
      // raw UUID. Parent ids may reference customers that are not in the
      // current page (e.g. when filtering by status).
      const parentCompanyById = new Map<string, string>()
      const parentIdsToFetch = new Set<string>()
      for (const summary of hierarchyByCustomer.values()) {
        if (summary.parent_customer_id && !parentCompanyById.has(summary.parent_customer_id)) {
          parentIdsToFetch.add(summary.parent_customer_id)
        }
      }
      // Pre-fill from already-loaded rows.
      for (const row of customerRows) {
        if (parentIdsToFetch.has(row.id)) {
          parentCompanyById.set(row.id, row.company_name)
          parentIdsToFetch.delete(row.id)
        }
      }
      if (parentIdsToFetch.size > 0) {
        const { data: parentRows } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .in("id", Array.from(parentIdsToFetch))
        for (const r of (parentRows ?? []) as Array<{ id: string; company_name: string }>) {
          parentCompanyById.set(r.id, r.company_name)
        }
      }

      if (customerIds.length > 0) {
        const [{ data: contactRows }, { data: locationRows }] = await Promise.all([
          supabase
            .from("customer_contacts")
            .select("customer_id, full_name, email, phone, is_primary")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .in("customer_id", customerIds)
            .order("is_primary", { ascending: false }),
          supabase
            .from("customer_locations")
            .select("customer_id, id, address_line1, city, state, postal_code, is_default")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .in("customer_id", customerIds)
            .order("is_default", { ascending: false }),
        ])

        ;(contactRows as DbContactRow[] | null)?.forEach((r) => {
          const list = contactsByCustomer.get(r.customer_id) ?? []
          list.push(r)
          contactsByCustomer.set(r.customer_id, list)
        })

        ;(locationRows as DbLocationRow[] | null)?.forEach((r) => {
          const list = locationsByCustomer.get(r.customer_id) ?? []
          list.push(r)
          locationsByCustomer.set(r.customer_id, list)
        })
      }

      const mapped = customerRows.map((row) => {
        const rawContacts = contactsByCustomer.get(row.id) ?? []
        const sortedContacts = [...rawContacts].sort(
          (a, b) => Number(!!b.is_primary) - Number(!!a.is_primary),
        )
        const primaryRow = sortedContacts[0]
        const displayName =
          primaryRow?.full_name?.trim() ? primaryRow.full_name.trim() : row.company_name

        const rawLocs = locationsByCustomer.get(row.id) ?? []
        const sortedLocs = [...rawLocs].sort(
          (a, b) => Number(!!b.is_default) - Number(!!a.is_default),
        )
        const locations = sortedLocs.map((loc) => ({
          id: loc.id,
          address: loc.address_line1 ?? "",
          city: loc.city ?? "",
          state: loc.state ?? "",
          zip: loc.postal_code ?? "",
        }))

        const contacts = sortedContacts.map((c) => ({
          email: c.email ?? "",
          phone: c.phone ?? "",
          name: (c.full_name ?? "").trim() || displayName,
        }))

        const hierarchy = hierarchyByCustomer.get(row.id) ?? null
        const parentCompany = hierarchy?.parent_customer_id
          ? parentCompanyById.get(hierarchy.parent_customer_id) ?? null
          : null

        return {
          id: row.id,
          company: row.company_name,
          name: displayName,
          status: row.status === "inactive" ? "Inactive" : "Active",
          locations,
          contacts,
          contracts: [],
          equipmentCount: 0,
          openWorkOrders: 0,
          joinedDate: row.joined_at ?? new Date().toISOString().slice(0, 10),
          isArchived: Boolean(row.archived_at),
          childCount: hierarchy?.child_count ?? 0,
          parent: parentCompany && hierarchy?.parent_customer_id
            ? { id: hierarchy.parent_customer_id, companyName: parentCompany }
            : null,
        }
      })

      if (active) setCustomers(mapped)
    }

    void loadCustomers()

    return () => {
      active = false
    }
  }, [refreshToken, orgStatus, activeOrgId, archiveScope, assignedOnlyView])

  // Phase 1: optional ?parent=<id> filter to scope the list to a parent's
  // sub-accounts (deep-linked from the customer hierarchy card). The id is a
  // valid customer id known to the user via RLS — never displayed raw.
  const [parentFilterId, setParentFilterId] = useState<string | null>(null)
  // Phase 2: hierarchy-scope filter (all/parents/children/standalone).
  const [hierarchyScope, setHierarchyScope] = useState<HierarchyScope>("all")

  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      if (!assignedOnlyView) {
        setSelectedCustomerId(openId)
        setArchiveScope("all")
      }
      router.replace("/customers", { scroll: false })
    }
    const parentId = searchParams.get("parent")
    if (parentId) {
      setParentFilterId(parentId)
    }
  }, [searchParams, router, assignedOnlyView])

  const parentFilterCompany = useMemo(() => {
    if (!parentFilterId) return null
    const match = customers.find((c) => c.id === parentFilterId)
    return match?.company ?? null
  }, [customers, parentFilterId])

  const filtered = useMemo(() => {
    let list = [...customers]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.locations.some((l) => l.city.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter)
    }

    if (parentFilterId) {
      list = list.filter((c) => c.parent?.id === parentFilterId)
    }

    if (hierarchyScope !== "all") {
      list = list.filter((c) => {
        const isParent = c.childCount > 0
        const isChild = Boolean(c.parent)
        if (hierarchyScope === "parents") return isParent
        if (hierarchyScope === "children") return isChild
        if (hierarchyScope === "standalone") return !isParent && !isChild
        return true
      })
    }

    list.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number
      let bv: string | number = b[sortKey] as string | number
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase()
        bv = bv.toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return list
  }, [customers, search, statusFilter, sortKey, sortDir, parentFilterId, hierarchyScope])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground/50 inline" />
    return (
      <ArrowUpDown
        className={cn(
          "w-3.5 h-3.5 ml-1 inline",
          sortDir === "asc" ? "text-primary" : "text-primary rotate-180"
        )}
      />
    )
  }

  function openCustomerDrawer(customer: Customer) {
    const existsInDrawerStore = drawerCustomers.some((c) => c.id === customer.id)
    if (!existsInDrawerStore) {
      addCustomer({
        id: customer.id,
        name: customer.name,
        company: customer.company,
        status: customer.status,
        locations: customer.locations.map((loc) => ({
          id: loc.id,
          name: "Location",
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
          isPrimary: false,
        })),
        contacts: customer.contacts.map((contact, idx) => ({
          id: `${customer.id}-contact-${idx}`,
          name: contact.name,
          firstName: contact.name.split(" ")[0] ?? "",
          lastName: contact.name.split(" ").slice(1).join(" ") ?? "",
          role: "Contact",
          email: contact.email,
          phone: contact.phone,
          isPrimary: idx === 0,
        })),
        notes: "",
        contracts: [],
        equipmentCount: customer.equipmentCount,
        openWorkOrders: customer.openWorkOrders,
        joinedDate: customer.joinedDate,
      })
    }

    setSelectedCustomerId(customer.id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      {assignedOnlyView ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Technician customer view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing customers tied to your assigned active work orders. Customer creation, archived records, and account hierarchy management stay available to admins and managers.
          </p>
        </div>
      ) : null}
      {orgStatus === "ready" && activeOrgId ?
        <AidenOperationalInsightsCard organizationId={activeOrgId} moduleContext="customers" />
      : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-11 items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-32 sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {!assignedOnlyView ? (
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

        {/* Phase 2: hierarchy scope filter. */}
        {!assignedOnlyView ? (
        <Select
          value={hierarchyScope}
          onValueChange={(v) => setHierarchyScope(v as HierarchyScope)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Hierarchy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="parents">Parent accounts</SelectItem>
            <SelectItem value="children">Sub-accounts</SelectItem>
            <SelectItem value="standalone">Stand-alone</SelectItem>
          </SelectContent>
        </Select>
        ) : null}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          {!assignedOnlyView ? (
          <Button size="sm" className="gap-2 cursor-pointer" onClick={() => openNewCustomerModal()}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">Add</span>
          </Button>
          ) : null}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground -mt-2">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{customers.length}</span> customers
      </p>

      {/* Parent-filter chip (Phase 1 hierarchy deep-link) */}
      {parentFilterId ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <Building2 className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span className="text-foreground">
            Showing sub-accounts of{" "}
            <span className="font-semibold">
              {parentFilterCompany ?? "selected parent account"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setParentFilterId(null)
              router.replace("/customers", { scroll: false })
            }}
            className="ml-auto text-[11px] font-medium text-primary hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : null}

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="ds-table-header-row">
                <TableHead>
                  <button
                    onClick={() => toggleSort("company")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Company <SortIcon col="company" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locations</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("equipmentCount")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Equipment <SortIcon col="equipmentCount" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("openWorkOrders")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Open WOs <SortIcon col="openWorkOrders" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contracts</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("joinedDate")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Joined <SortIcon col="joinedDate" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No customers match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="group cursor-pointer ds-hover-list-row" onClick={() => openCustomerDrawer(c)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-semibold text-xs shrink-0">
                          {c.company.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors truncate">
                            {c.company}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                          {c.parent ? (
                            <p
                              className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-[color:var(--status-info)]"
                              title={`Sub-account of ${c.parent.companyName}`}
                            >
                              Sub-account of {c.parent.companyName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={c.status} />
                        {c.childCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] border border-primary/30 bg-primary/10 text-primary font-semibold"
                            title={`${c.childCount} sub-account${c.childCount === 1 ? "" : "s"}`}
                          >
                            Parent · {c.childCount}
                          </Badge>
                        ) : null}
                        {c.isArchived ? (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                            Archived
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.locations.length}</TableCell>
                    <TableCell className="text-sm text-foreground font-medium">{c.equipmentCount}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-sm font-medium",
                        c.openWorkOrders > 0 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
                      )}>
                        {c.openWorkOrders}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.contracts.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="w-[200px] whitespace-nowrap">
                      <div className="flex justify-end">
                        <ContactActions {...buildCustomerContactActionProps(c)} />
                      </div>
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
            <p className="text-sm text-muted-foreground text-center py-12">No customers match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <CustomerCard key={c.id} customer={c} onOpen={() => openCustomerDrawer(c)} />
              ))}
            </div>
          )}
        </>
      )}

      <CustomerDrawer
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />

      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => setRefreshToken((v) => v + 1)}
      />

      <QuickAddParamBridge action="new-customer" onTrigger={() => openNewCustomerModal()} />
    </div>
  )
}

export default function CustomersPage() {
  return <Suspense fallback={null}><CustomersPageInner /></Suspense>
}
