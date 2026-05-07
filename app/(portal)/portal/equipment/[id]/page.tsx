"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  MapPin,
  CalendarClock,
  Shield,
  Hash,
  Wrench,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  Download,
} from "lucide-react"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function daysUntil(d: string | null | undefined) {
  if (!d) return null
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

type DetailPayload = {
  equipment: {
    id: string
    name: string
    equipmentCode: string | null
    manufacturer: string | null
    category: string | null
    serialNumber: string | null
    statusLabel: string
    installDate: string | null
    warrantyExpiresAt: string | null
    lastServiceAt: string | null
    nextDueAt: string | null
    nextCalibrationDueAt: string | null
    locationLabel: string | null
    notes: string | null
  }
  serviceHistory: Array<{
    id: string
    display: string
    title: string
    statusLabel: string
    typeLabel: string
    scheduledOn: string | null
    completedAt: string | null
    totalCents: number
  }>
  certificates: Array<{
    id: string
    templateName: string
    createdAt: string
    unlocked: boolean
    reasonLabel: string
    downloadPath: string | null
  }>
  invoices: Array<{
    id: string
    invoiceNumber: string
    title: string
    amountCents: number
    statusLabel: string
    issuedAt: string
    dueDate: string | null
  }>
}

export default function PortalEquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<DetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/portal/equipment/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json() as Promise<DetailPayload>
      })
      .then(setData)
      .catch(() => setError("Equipment not found."))
  }, [id])

  if (error) {
    return (
      <div className="portal-card py-20 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
          {error}
        </p>
        <Link href="/portal/equipment" className="text-sm mt-2 inline-flex items-center gap-1" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back to equipment
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="portal-card py-20 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
        Loading equipment…
      </div>
    )
  }

  const eq = data.equipment
  const days = daysUntil(eq.nextDueAt)
  const calDays = daysUntil(eq.nextCalibrationDueAt)
  const warrantyDays = daysUntil(eq.warrantyExpiresAt)
  const totalSpend = data.serviceHistory.reduce((s, h) => s + h.totalCents, 0)
  const lastService = data.serviceHistory.find((h) => h.completedAt)?.completedAt ?? eq.lastServiceAt

  const primary = getEquipmentDisplayPrimary({
    id: eq.id,
    name: eq.name,
    equipment_code: eq.equipmentCode,
    serial_number: eq.serialNumber,
    category: eq.category,
  })
  const secondary = getEquipmentSecondaryLine(
    {
      id: eq.id,
      name: eq.name,
      equipment_code: eq.equipmentCode,
      serial_number: eq.serialNumber,
      category: eq.category,
    },
    "",
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/equipment" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Equipment
        </Link>
        <span style={{ color: "var(--portal-nav-icon)" }}>/</span>
        <span style={{ color: "var(--portal-nav-text)" }}>{primary}</span>
      </div>

      <div className="portal-card overflow-hidden">
        <div
          className="h-1.5"
          style={{
            background:
              eq.statusLabel === "Active" ? "var(--portal-success)"
              : eq.statusLabel === "Needs Service" ? "var(--portal-warning)"
              : "var(--portal-danger)",
          }}
        />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                style={{
                  background: eq.statusLabel === "Active" ? "#f0fdf4" : eq.statusLabel === "Needs Service" ? "#fffbeb" : "#fef2f2",
                  color: eq.statusLabel === "Active" ? "#15803d" : eq.statusLabel === "Needs Service" ? "#d97706" : "#dc2626",
                }}
              >
                {eq.statusLabel}
              </span>
              <h1 className="text-xl font-semibold text-balance" style={{ color: "var(--portal-foreground)" }}>
                {primary}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                {secondary}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                {[eq.manufacturer, eq.category].filter(Boolean).join(" • ")}
              </p>
            </div>
            <Link href={`/portal/request-repair?equipment=${eq.id}`} className="portal-btn-primary shrink-0">
              <Wrench size={14} /> Request Repair
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(
              [
                { icon: Hash, label: "Serial No.", value: eq.serialNumber ?? "—", warn: false },
                { icon: MapPin, label: "Location", value: eq.locationLabel ?? "—", warn: false },
                { icon: CalendarClock, label: "Installed", value: fmtDate(eq.installDate), warn: false },
                {
                  icon: Shield,
                  label: "Warranty",
                  value: warrantyDays != null && warrantyDays < 0 ? "Expired" : `Exp. ${fmtDate(eq.warrantyExpiresAt)}`,
                  warn: warrantyDays != null && (warrantyDays < 0 || warrantyDays <= 30),
                },
              ] as const
            ).map(({ icon: Icon, label, value, warn }) => (
              <div key={label}>
                <p className="text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>
                  <Icon size={11} className="inline mr-1" />
                  {label}
                </p>
                <p className="text-sm font-medium" style={{ color: warn ? "var(--portal-warning)" : "var(--portal-secondary)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {eq.nextDueAt && days != null && (
            <div
              className="mt-5 p-3 rounded-lg flex items-center justify-between"
              style={{
                background: days < 0 ? "var(--portal-danger-muted)" : days <= 14 ? "var(--portal-warning-muted)" : "var(--portal-accent-muted)",
                border: `1px solid ${days < 0 ? "#fecaca" : days <= 14 ? "#fed7aa" : "#bfdbfe"}`,
              }}
            >
              <div className="flex items-center gap-2">
                {days < 0 ?
                  <AlertTriangle size={14} style={{ color: "var(--portal-danger)" }} />
                : days <= 14 ?
                  <Clock size={14} style={{ color: "var(--portal-warning)" }} />
                : <CalendarClock size={14} style={{ color: "var(--portal-accent)" }} />}
                <span
                  className="text-sm font-medium"
                  style={{
                    color: days < 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent-text)",
                  }}
                >
                  {days < 0 ?
                    `Service overdue by ${Math.abs(days)} days`
                  : `Next service due in ${days} days — ${fmtDate(eq.nextDueAt)}`}
                </span>
              </div>
              <Link
                href={`/portal/book-maintenance?equipment=${eq.id}`}
                className="text-xs font-medium flex items-center gap-1"
                style={{
                  color: days < 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent)",
                }}
              >
                Book service <ArrowUpRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {(eq.nextCalibrationDueAt || data.certificates.length > 0) && (
        <div className="portal-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} style={{ color: "var(--portal-accent)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Compliance & calibration
            </h3>
          </div>
          {eq.nextCalibrationDueAt ? (
            <p className="text-sm" style={{ color: calDays != null && calDays < 0 ? "var(--portal-danger)" : "var(--portal-secondary)" }}>
              Next calibration due: {fmtDate(eq.nextCalibrationDueAt)}
              {calDays != null ? ` (${calDays < 0 ? `${Math.abs(calDays)}d overdue` : `${calDays}d`})` : ""}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
              No calibration due date on file.
            </p>
          )}
          {data.certificates.length > 0 ? (
            <div className="mt-4 divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
              {data.certificates.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--portal-foreground)" }}>
                      {c.templateName}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--portal-nav-text)" }}>
                      {fmtDate(c.createdAt)} · {c.reasonLabel}
                    </p>
                  </div>
                  {c.downloadPath ?
                    <a
                      href={c.downloadPath}
                      className="text-[11px] shrink-0 flex items-center gap-1 font-medium"
                      style={{ color: "var(--portal-accent)" }}
                    >
                      <Download size={11} /> PDF/HTML
                    </a>
                  : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs mt-3" style={{ color: "var(--portal-nav-text)" }}>
              Certificates appear here after service visits with saved calibration records.
            </p>
          )}
          <Link href="/portal/certificates" className="text-xs font-medium mt-3 inline-block" style={{ color: "var(--portal-accent)" }}>
            Open compliance archive →
          </Link>
        </div>
      )}

      {data.invoices.length > 0 && (
        <div className="portal-card">
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
            <Receipt size={15} style={{ color: "var(--portal-accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Invoices for this equipment
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/portal/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-[--portal-surface-2] transition-colors"
              >
                <div>
                  <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                    {fmtDate(inv.issuedAt)}
                    {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums">{fmtCurrency(inv.amountCents)}</p>
                  <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                    {inv.statusLabel}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Visits", value: String(data.serviceHistory.length) },
          { label: "Total spend", value: fmtCurrency(totalSpend) },
          { label: "Last service", value: fmtDate(lastService) },
        ].map(({ label, value }) => (
          <div key={label} className="portal-card p-4 text-center">
            <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
              {value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="portal-card">
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--portal-border-light)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Service history
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
          {data.serviceHistory.length === 0 && (
            <p className="p-5 text-sm" style={{ color: "var(--portal-nav-text)" }}>
              No completed visits yet.
            </p>
          )}
          {data.serviceHistory.map((h) => (
            <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono" style={{ color: "var(--portal-nav-text)" }}>
                  {h.display}
                </p>
                <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                  {h.title}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                  {h.typeLabel} • {fmtDate(h.scheduledOn)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{fmtCurrency(h.totalCents)}</p>
                <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  {h.statusLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {eq.notes && (
        <div className="portal-card p-5">
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Notes
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--portal-secondary)" }}>
            {eq.notes}
          </p>
        </div>
      )}
    </div>
  )
}
