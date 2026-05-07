"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Download, Info, Lock, Search, ShieldCheck } from "lucide-react"

type Cert = {
  id: string
  createdAt: string
  workOrderId: string
  equipmentName: string | null
  equipmentLocationLabel: string | null
  templateName: string
  downloadPath: string | null
  unlocked: boolean
  reasonLabel: string
  reasonCode?: string
  effectiveMode: string
}

type Summary = {
  total: number
  unlocked: number
  locked: number
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalCertificatesPage() {
  const [items, setItems] = useState<Cert[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "available" | "locked">("all")

  useEffect(() => {
    fetch("/api/portal/certificates")
      .then((r) => r.json())
      .then((j: { items?: Cert[]; summary?: Summary }) => {
        setItems(j.items ?? [])
        setSummary(j.summary ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((c) => {
      if (filter === "available" && !c.unlocked) return false
      if (filter === "locked" && c.unlocked) return false
      if (!q) return true
      const blob = [c.templateName, c.equipmentName, c.equipmentLocationLabel, fmtDate(c.createdAt)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return blob.includes(q)
    })
  }, [items, query, filter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Compliance archive
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Calibration and compliance documents from your service history. Availability may depend on invoice payment or your
          service provider&apos;s release settings.
        </p>
      </div>

      {summary && summary.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Total on file", String(summary.total)],
              ["Available", String(summary.unlocked)],
              ["Pending release", String(summary.locked)],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="portal-card p-4 text-center">
              <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                {val}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {summary && summary.total > 0 && summary.locked > 0 ? (
        <div
          className="portal-card flex items-start gap-3 px-4 py-3"
          style={{
            borderColor: "var(--portal-border-light)",
            background: "var(--portal-accent-muted)",
          }}
        >
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: "var(--portal-accent)" }} />
          <div className="text-xs leading-snug" style={{ color: "var(--portal-foreground)" }}>
            Some certificates are still pending release. Download access depends on your service provider&apos;s policy and
            invoice payment status — paid invoices typically unlock related certificates immediately.
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input
            type="search"
            placeholder="Search by template, equipment, location, or date…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
            style={{
              borderColor: "var(--portal-border-light)",
              background: "var(--portal-surface)",
              color: "var(--portal-foreground)",
            }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "available", "locked"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="rounded-md px-3 py-1.5 text-xs font-medium border transition-colors"
              style={{
                borderColor: filter === k ? "var(--portal-accent)" : "var(--portal-border-light)",
                background: filter === k ? "var(--portal-accent-muted)" : "transparent",
                color: filter === k ? "var(--portal-accent-text)" : "var(--portal-nav-text)",
              }}
            >
              {k === "all" ? "All" : k === "available" ? "Available" : "Locked"}
            </button>
          ))}
        </div>
      </div>

      <div className="portal-card divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
        {loading && <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>
            {items.length === 0 ? "No certificates on file yet." : "No matches for your filters."}
          </p>
        )}
        {!loading &&
          filtered.map((c) => {
            const lockedReasonCode = c.reasonCode ?? ""
            const lockedByPayment = lockedReasonCode === "locked_payment"
            const lockedByManual = lockedReasonCode === "locked_manual"
            return (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                    style={{
                      background: c.unlocked ? "var(--portal-accent-muted)" : "var(--portal-surface)",
                      border: c.unlocked ? "none" : "1px solid var(--portal-border-light)",
                    }}
                  >
                    {c.unlocked ? (
                      <ShieldCheck size={16} style={{ color: "var(--portal-accent)" }} />
                    ) : lockedByPayment ? (
                      <Clock size={16} style={{ color: "var(--portal-nav-icon)" }} />
                    ) : (
                      <Lock size={16} style={{ color: "var(--portal-nav-icon)" }} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--portal-foreground)" }}
                      >
                        {c.templateName}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          borderColor: c.unlocked
                            ? "var(--portal-accent)"
                            : "var(--portal-border-light)",
                          color: c.unlocked
                            ? "var(--portal-accent-text)"
                            : "var(--portal-nav-text)",
                          background: c.unlocked
                            ? "var(--portal-accent-muted)"
                            : "transparent",
                        }}
                      >
                        {c.unlocked
                          ? "Available"
                          : lockedByPayment
                            ? "Awaiting payment"
                            : lockedByManual
                              ? "Awaiting release"
                              : "Locked"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {[c.equipmentName ?? "Equipment", c.equipmentLocationLabel]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · {fmtDate(c.createdAt)}
                    </p>
                    <p
                      className="text-[11px] mt-1 leading-snug"
                      style={{ color: "var(--portal-secondary)" }}
                    >
                      {c.reasonLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.downloadPath ? (
                    <a
                      href={c.downloadPath}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
                      style={{
                        borderColor: "var(--portal-border-light)",
                        color: "var(--portal-accent)",
                      }}
                    >
                      <Download size={12} />
                      Download
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
                      style={{
                        borderColor: "var(--portal-border-light)",
                        color: "var(--portal-nav-text)",
                        background: "var(--portal-surface)",
                      }}
                    >
                      <Lock size={12} />
                      Not yet available
                    </span>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Downloads open as an HTML certificate file — use your browser&apos;s print dialog to save as PDF if needed.
      </p>
    </div>
  )
}
