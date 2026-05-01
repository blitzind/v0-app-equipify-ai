"use client"

import { useState } from "react"
import { useCertificates } from "@/lib/certificate-store"
import { ShieldCheck, Download, Search, FileText, AlertTriangle, Calendar } from "lucide-react"
import type { CalibrationCertificate } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function expiryStatus(expiryDate: string): "none" | "ok" | "soon" | "expired" {
  if (!expiryDate) return "none"
  const diff = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000
  if (diff < 0) return "expired"
  if (diff <= 60) return "soon"
  return "ok"
}

function CertCard({ cert }: { cert: CalibrationCertificate }) {
  const status = expiryStatus(cert.expiryDate)

  const statusConfig = {
    ok:      { label: `Expires ${fmtDate(cert.expiryDate)}`, color: "var(--portal-success)", bg: "rgba(22,163,74,0.08)" },
    soon:    { label: `Expires ${fmtDate(cert.expiryDate)}`, color: "var(--portal-warning)", bg: "rgba(217,119,6,0.08)" },
    expired: { label: `Expired ${fmtDate(cert.expiryDate)}`, color: "var(--portal-danger)",  bg: "rgba(220,38,38,0.08)" },
    none:    { label: "No expiry date",                       color: "var(--portal-nav-text)", bg: "transparent" },
  }[status]

  function handleDownload() {
    const a = document.createElement("a")
    a.href = cert.dataUrl
    a.download = cert.fileName
    a.click()
  }

  return (
    <div className="portal-card p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--portal-hover)", border: "1px solid var(--portal-border-light)" }}>
          <FileText size={18} style={{ color: "var(--portal-accent)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
            {cert.fileName}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--portal-nav-text)" }}>
            {cert.equipmentName}
          </p>
        </div>
      </div>

      {/* Expiry badge */}
      <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
        style={{ background: statusConfig.bg, border: `1px solid ${statusConfig.color}22` }}>
        {status === "expired" || status === "soon"
          ? <AlertTriangle size={12} style={{ color: statusConfig.color }} />
          : <ShieldCheck size={12} style={{ color: statusConfig.color }} />
        }
        <span className="text-xs font-medium" style={{ color: statusConfig.color }}>
          {statusConfig.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--portal-nav-text)" }}>
        <div className="flex items-center gap-1">
          <Calendar size={11} />
          <span>Uploaded {fmtDate(cert.uploadedAt)}</span>
        </div>
        <span>{fmtBytes(cert.fileSize)}</span>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="portal-btn-primary w-full justify-center mt-1"
        style={{ fontSize: "13px" }}
      >
        <Download size={14} />
        Download Certificate
      </button>
    </div>
  )
}

export default function PortalCertificatesPage() {
  const { getCertsByCustomer } = useCertificates()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "valid" | "expiring" | "expired">("all")

  const certs = getCertsByCustomer(CUSTOMER_ID)

  const filtered = certs.filter((c) => {
    const matchSearch = [c.fileName, c.equipmentName, c.notes]
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
    if (!matchSearch) return false
    if (filter === "valid")    return expiryStatus(c.expiryDate) === "ok" || expiryStatus(c.expiryDate) === "none"
    if (filter === "expiring") return expiryStatus(c.expiryDate) === "soon"
    if (filter === "expired")  return expiryStatus(c.expiryDate) === "expired"
    return true
  })

  const counts = {
    all:      certs.length,
    valid:    certs.filter(c => expiryStatus(c.expiryDate) === "ok" || expiryStatus(c.expiryDate) === "none").length,
    expiring: certs.filter(c => expiryStatus(c.expiryDate) === "soon").length,
    expired:  certs.filter(c => expiryStatus(c.expiryDate) === "expired").length,
  }

  const filterLabels: { key: typeof filter; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "valid",    label: "Valid" },
    { key: "expiring", label: "Expiring" },
    { key: "expired",  label: "Expired" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Calibration Certificates
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Download equipment calibration and compliance certificates for your records.
        </p>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: "var(--portal-hover)", border: "1px solid var(--portal-border-light)" }}>
          {filterLabels.map(({ key, label }) => (
            <button key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: filter === key ? "var(--portal-surface)" : "transparent",
                color: filter === key ? "var(--portal-foreground)" : "var(--portal-nav-text)",
                boxShadow: filter === key ? "var(--portal-shadow-sm)" : "none",
              }}>
              {label}
              {counts[key] > 0 && (
                <span className="ml-1 text-[10px]" style={{ color: filter === key ? "var(--portal-accent)" : "var(--portal-nav-icon)" }}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input
            className="portal-input pl-8 w-56"
            placeholder="Search certificates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {certs.length === 0 ? (
        <div className="portal-card py-16 text-center">
          <ShieldCheck size={36} className="mx-auto mb-3" style={{ color: "var(--portal-nav-icon)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            No certificates available yet
          </p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--portal-nav-text)" }}>
            Calibration certificates uploaded by your service provider will appear here for download.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="portal-card py-10 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>No certificates match your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cert) => (
            <CertCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  )
}
