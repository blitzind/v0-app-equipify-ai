"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Folder,
  Info,
  Layers,
  Lock,
  Receipt,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react"

type DocumentKind =
  | "invoice"
  | "certificate"
  | "work_order_summary"
  | "certificate_attachment"
  | "attachment"

type Availability =
  | "available"
  | "awaiting_payment"
  | "awaiting_release"
  | "not_yet_available"

type DocItem = {
  key: string
  kind: DocumentKind
  title: string
  subtitle: string | null
  occurredAt: string
  equipmentLabel: string | null
  locationLabel: string | null
  availability: Availability
  availabilityReason: string
  blockedByInvoice: { number: string | null; statusLabel: string | null } | null
  viewPath: string | null
  downloadPath: string | null
  statusLabel: string
  /** Phase 2 chip — populated only for non-root accounts under rollup. */
  accountLabel: string | null
  meta: {
    invoiceNumber: string | null
    workOrderNumber: number | null
    workOrderDisplay: string | null
  }
}

type Payload = {
  items: DocItem[]
  equipmentOptions: Array<{ value: string; label: string }>
  accountOptions: Array<{ value: string; label: string }>
  countsByKind: Record<DocumentKind, number>
  countsByAvailability: Record<Availability, number>
  scope: {
    rollupEnabled: boolean
    rootAccountLabel: string | null
  }
}

type KindFilter = "all" | DocumentKind

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const KIND_LABEL: Record<DocumentKind, string> = {
  invoice: "Invoices",
  certificate: "Certificates",
  work_order_summary: "Service summaries",
  certificate_attachment: "Uploaded documents",
  attachment: "Attached files",
}

const KIND_ICON: Record<DocumentKind, React.ElementType> = {
  invoice: Receipt,
  certificate: ShieldCheck,
  work_order_summary: Wrench,
  certificate_attachment: FileText,
  attachment: FileText,
}

const KIND_FILTERS: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "All documents" },
  { id: "invoice", label: "Invoices" },
  { id: "certificate", label: "Certificates" },
  { id: "work_order_summary", label: "Service summaries" },
  { id: "certificate_attachment", label: "Uploaded documents" },
  { id: "attachment", label: "Attached files" },
]

function StatusPill({ avail, label }: { avail: Availability; label: string }) {
  const styles =
    avail === "available"
      ? {
          background: "var(--portal-accent-muted)",
          color: "var(--portal-accent-text)",
          borderColor: "var(--portal-accent)",
        }
      : avail === "awaiting_payment"
        ? {
            background: "var(--portal-warning-muted)",
            color: "var(--portal-warning)",
            borderColor: "#fed7aa",
          }
        : avail === "awaiting_release"
          ? {
              background: "var(--portal-warning-muted)",
              color: "var(--portal-warning)",
              borderColor: "#fed7aa",
            }
          : {
              background: "var(--portal-surface)",
              color: "var(--portal-nav-text)",
              borderColor: "var(--portal-border-light)",
            }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={styles}
    >
      {label}
    </span>
  )
}

function DocRow({ doc }: { doc: DocItem }) {
  const Icon = KIND_ICON[doc.kind]
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background:
              doc.availability === "available"
                ? "var(--portal-accent-muted)"
                : "var(--portal-surface)",
            border:
              doc.availability === "available"
                ? "none"
                : "1px solid var(--portal-border-light)",
          }}
        >
          <Icon
            size={16}
            style={{
              color:
                doc.availability === "available"
                  ? "var(--portal-accent)"
                  : "var(--portal-nav-icon)",
            }}
          />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--portal-foreground)" }}
              title={doc.title}
            >
              {doc.title}
            </p>
            <StatusPill avail={doc.availability} label={doc.statusLabel} />
            {doc.accountLabel ? (
              <span
                className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium"
                title={`Account: ${doc.accountLabel}`}
                style={{
                  borderColor: "var(--portal-border-light)",
                  background: "var(--portal-surface)",
                  color: "var(--portal-nav-text)",
                }}
              >
                <Building2 size={10} />
                <span className="truncate">{doc.accountLabel}</span>
              </span>
            ) : null}
          </div>
          {doc.subtitle ? (
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--portal-nav-text)" }}>
              {doc.subtitle}
            </p>
          ) : null}
          <p className="mt-1 text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
            {[
              doc.equipmentLabel ?? null,
              doc.locationLabel ?? null,
              fmtDate(doc.occurredAt),
              doc.meta.workOrderDisplay,
            ]
              .filter((x): x is string => Boolean(x))
              .join(" · ")}
          </p>
          {doc.availability !== "available" ? (
            <p
              className="mt-1 flex items-start gap-1 text-[11px] leading-snug"
              style={{ color: "var(--portal-secondary)" }}
            >
              {doc.availability === "awaiting_payment" ? (
                <Receipt size={10} className="mt-0.5 shrink-0" />
              ) : doc.availability === "awaiting_release" ? (
                <Lock size={10} className="mt-0.5 shrink-0" />
              ) : null}
              <span>{doc.availabilityReason}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {doc.downloadPath ? (
          <a
            href={doc.downloadPath}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: "var(--portal-border-light)",
              color: "var(--portal-accent)",
            }}
          >
            <Download size={12} /> Download
          </a>
        ) : null}
        {doc.viewPath ? (
          <Link
            href={doc.viewPath}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: "var(--portal-border-light)",
              color: "var(--portal-nav-text)",
            }}
          >
            View <ExternalLink size={12} />
          </Link>
        ) : null}
        {!doc.downloadPath && !doc.viewPath ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: "var(--portal-border-light)",
              color: "var(--portal-nav-text)",
              background: "var(--portal-surface)",
            }}
          >
            <Lock size={12} /> Not yet available
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function PortalDocumentsPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all")
  const [accountFilter, setAccountFilter] = useState<string>("all")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    fetch("/api/portal/documents")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load documents.")
        return r.json() as Promise<Payload>
      })
      .then(setData)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo<DocItem[]>(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null
    return data.items.filter((d) => {
      if (kindFilter !== "all" && d.kind !== kindFilter) return false
      if (availableOnly && d.availability !== "available") return false
      if (equipmentFilter !== "all" && d.equipmentLabel !== equipmentFilter) return false
      if (accountFilter !== "all" && (d.accountLabel ?? "__root__") !== accountFilter) {
        return false
      }
      const ts = new Date(d.occurredAt).getTime()
      if (fromTs && ts < fromTs) return false
      if (toTs && ts > toTs) return false
      if (q) {
        const blob = [
          d.title,
          d.subtitle ?? "",
          d.equipmentLabel ?? "",
          d.locationLabel ?? "",
          d.accountLabel ?? "",
          d.meta.invoiceNumber ?? "",
          d.meta.workOrderDisplay ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [
    data,
    query,
    kindFilter,
    availableOnly,
    equipmentFilter,
    accountFilter,
    dateFrom,
    dateTo,
  ])

  const grouped = useMemo(() => {
    const map: Partial<Record<DocumentKind, DocItem[]>> = {}
    for (const d of filtered) {
      if (!map[d.kind]) map[d.kind] = []
      map[d.kind]!.push(d)
    }
    return map
  }, [filtered])

  const totalCount = data?.items.length ?? 0
  const lockedCount =
    (data?.countsByAvailability.awaiting_payment ?? 0) +
    (data?.countsByAvailability.awaiting_release ?? 0) +
    (data?.countsByAvailability.not_yet_available ?? 0)

  const anyAdvancedActive =
    equipmentFilter !== "all" ||
    accountFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    availableOnly

  function clearFilters() {
    setKindFilter("all")
    setEquipmentFilter("all")
    setAccountFilter("all")
    setAvailableOnly(false)
    setDateFrom("")
    setDateTo("")
    setQuery("")
  }

  const rollupEnabled = data?.scope.rollupEnabled ?? false
  const rollupAccountCount = (data?.accountOptions.length ?? 0) + (rollupEnabled ? 1 : 0)

  const renderEmptyHint =
    totalCount === 0
      ? "No documents available yet — invoices, certificates, and service summaries will appear here as work is completed."
      : "No documents match your filters. Try clearing filters or expanding the date range."

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Folder size={18} style={{ color: "var(--portal-accent)" }} />
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--portal-foreground)" }}
          >
            Documents
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Invoices, certificates, service summaries, and uploaded files in one place.
          Some certificates may appear after invoice payment, depending on your service
          provider&apos;s release rules.
        </p>
      </div>

      {/* Summary cards */}
      {data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["Invoices", data.countsByKind.invoice ?? 0, Receipt],
              ["Certificates", data.countsByKind.certificate ?? 0, ShieldCheck],
              [
                "Service summaries",
                data.countsByKind.work_order_summary ?? 0,
                Wrench,
              ],
              [
                "Uploaded",
                (data.countsByKind.certificate_attachment ?? 0) + (data.countsByKind.attachment ?? 0),
                FileText,
              ],
            ] as const
          ).map(([label, count, Icon]) => (
            <div key={label} className="portal-card flex items-center gap-3 p-4">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--portal-accent-muted)" }}
              >
                <Icon size={16} style={{ color: "var(--portal-accent)" }} />
              </span>
              <div>
                <p
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "var(--portal-nav-text)" }}
                >
                  {label}
                </p>
                <p
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: "var(--portal-foreground)" }}
                >
                  {count}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Phase 2: parent-account rollup banner — only when explicitly enabled. */}
      {rollupEnabled ? (
        <div
          className="portal-card flex items-start gap-3 px-4 py-3"
          style={{
            borderColor: "var(--portal-accent)",
            background: "var(--portal-accent-muted)",
          }}
        >
          <Layers
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--portal-accent)" }}
          />
          <div
            className="text-xs leading-snug"
            style={{ color: "var(--portal-foreground)" }}
          >
            <p className="font-semibold">Consolidated view enabled</p>
            <p className="mt-0.5">
              You&apos;re viewing documents across{" "}
              {rollupAccountCount > 1
                ? `${rollupAccountCount} accounts`
                : "your account"}{" "}
              under{" "}
              <span className="font-medium">
                {data?.scope.rootAccountLabel ?? "your organization"}
              </span>
              . Each item shows the account it belongs to.
            </p>
          </div>
        </div>
      ) : null}

      {/* Helpful banner when there are locked items */}
      {data && lockedCount > 0 ? (
        <div
          className="portal-card flex items-start gap-3 px-4 py-3"
          style={{
            borderColor: "var(--portal-border-light)",
            background: "var(--portal-accent-muted)",
          }}
        >
          <Info
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--portal-accent)" }}
          />
          <div
            className="text-xs leading-snug"
            style={{ color: "var(--portal-foreground)" }}
          >
            Some documents aren&apos;t available yet. Certificates and uploaded
            attachments may unlock once the related invoice is paid or your
            service provider releases them.
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="portal-card flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--portal-nav-icon)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search by title, equipment, location, invoice or work order…"
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--portal-border-light)",
                background: "var(--portal-surface)",
                color: "var(--portal-foreground)",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: anyAdvancedActive
                ? "var(--portal-accent)"
                : "var(--portal-border-light)",
              background: anyAdvancedActive
                ? "var(--portal-accent-muted)"
                : "transparent",
              color: anyAdvancedActive
                ? "var(--portal-accent-text)"
                : "var(--portal-nav-text)",
            }}
          >
            <Filter size={12} />
            More filters
            <ChevronDown
              size={12}
              className={advancedOpen ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKindFilter(k.id)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor:
                  kindFilter === k.id
                    ? "var(--portal-accent)"
                    : "var(--portal-border-light)",
                background:
                  kindFilter === k.id
                    ? "var(--portal-accent-muted)"
                    : "transparent",
                color:
                  kindFilter === k.id
                    ? "var(--portal-accent-text)"
                    : "var(--portal-nav-text)",
              }}
            >
              {k.label}
              {k.id !== "all" && data
                ? ` · ${data.countsByKind[k.id as DocumentKind] ?? 0}`
                : ""}
            </button>
          ))}
        </div>

        {advancedOpen ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rollupEnabled ? (
              <label
                className="flex flex-col gap-1 text-xs"
                style={{ color: "var(--portal-nav-text)" }}
              >
                <span className="font-medium">Account</span>
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-xs"
                  style={{
                    borderColor: "var(--portal-border-light)",
                    background: "var(--portal-surface)",
                    color: "var(--portal-foreground)",
                  }}
                >
                  <option value="all">All accounts</option>
                  <option value="__root__">
                    {data?.scope.rootAccountLabel ?? "Your account"}
                  </option>
                  {data?.accountOptions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
              <span className="font-medium">Equipment</span>
              <select
                value={equipmentFilter}
                onChange={(e) => setEquipmentFilter(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--portal-border-light)",
                  background: "var(--portal-surface)",
                  color: "var(--portal-foreground)",
                }}
              >
                <option value="all">All equipment</option>
                {data?.equipmentOptions.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
              <span className="font-medium">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--portal-border-light)",
                  background: "var(--portal-surface)",
                  color: "var(--portal-foreground)",
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
              <span className="font-medium">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--portal-border-light)",
                  background: "var(--portal-surface)",
                  color: "var(--portal-foreground)",
                }}
              />
            </label>
            <label
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--portal-nav-text)" }}
            >
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-4 w-4 rounded border accent-[--portal-accent]"
                style={{ borderColor: "var(--portal-border-light)" }}
              />
              Show only documents I can download now
            </label>
          </div>
        ) : null}

        {anyAdvancedActive || query || kindFilter !== "all" ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex w-fit items-center gap-1 text-[11px] font-medium"
            style={{ color: "var(--portal-accent)" }}
          >
            <X size={11} /> Clear filters
          </button>
        ) : null}
      </div>

      {/* Loading + empty + grouped lists */}
      {loadError ? (
        <p
          className="portal-card p-6 text-sm"
          style={{ color: "var(--portal-danger)" }}
        >
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p
          className="portal-card p-6 text-sm"
          style={{ color: "var(--portal-nav-text)" }}
        >
          Loading documents…
        </p>
      ) : null}

      {!loading && !loadError && filtered.length === 0 ? (
        <div className="portal-card p-8 text-center">
          <Folder
            size={20}
            className="mx-auto"
            style={{ color: "var(--portal-nav-icon)" }}
          />
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--portal-foreground)" }}
          >
            {totalCount === 0 ? "No documents yet" : "No matches"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--portal-nav-text)" }}
          >
            {renderEmptyHint}
          </p>
          {totalCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: "var(--portal-accent)",
                color: "var(--portal-accent)",
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !loadError && filtered.length > 0 ? (
        <div className="space-y-6">
          {(["invoice", "certificate", "work_order_summary", "certificate_attachment", "attachment"] as DocumentKind[]).map(
            (kind) => {
              const list = grouped[kind]
              if (!list || list.length === 0) return null
              const Icon = KIND_ICON[kind]
              return (
                <section
                  key={kind}
                  className="portal-card divide-y overflow-hidden"
                  style={{ borderColor: "var(--portal-border-light)" }}
                >
                  <header
                    className="flex items-center gap-2 px-4 py-3"
                    style={{
                      borderBottom: "1px solid var(--portal-border-light)",
                      background: "var(--portal-surface-2)",
                    }}
                  >
                    <Icon size={14} style={{ color: "var(--portal-accent)" }} />
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: "var(--portal-foreground)" }}
                    >
                      {KIND_LABEL[kind]}
                    </h2>
                    <span
                      className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                      style={{
                        background: "var(--portal-surface)",
                        color: "var(--portal-nav-text)",
                      }}
                    >
                      {list.length}
                    </span>
                    {kind === "certificate" ? (
                      <Link
                        href="/portal/certificates"
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium"
                        style={{ color: "var(--portal-accent)" }}
                      >
                        Manage <ChevronRight size={11} />
                      </Link>
                    ) : null}
                    {kind === "invoice" ? (
                      <Link
                        href="/portal/invoices"
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium"
                        style={{ color: "var(--portal-accent)" }}
                      >
                        Invoice list <ChevronRight size={11} />
                      </Link>
                    ) : null}
                    {kind === "work_order_summary" ? (
                      <Link
                        href="/portal/work-orders"
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium"
                        style={{ color: "var(--portal-accent)" }}
                      >
                        Work orders <ChevronRight size={11} />
                      </Link>
                    ) : null}
                  </header>
                  <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
                    {list.map((d) => (
                      <DocRow key={d.key} doc={d} />
                    ))}
                  </div>
                </section>
              )
            },
          )}
        </div>
      ) : null}

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        <Clock size={10} className="inline -mt-0.5 mr-1" /> Document availability follows
        your service provider&apos;s release rules. Paid invoices typically unlock
        related certificates immediately.
      </p>
    </div>
  )
}
