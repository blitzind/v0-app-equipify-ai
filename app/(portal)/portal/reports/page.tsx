"use client"

import { useState } from "react"
import { FileText, FileDown, BarChart3, Activity, CheckSquare, DollarSign, ChevronRight } from "lucide-react"
import { portalReports } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
// Show all reports so demo is richer; in production filter by CUSTOMER_ID
const allReports = portalReports

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

const TYPE_META: Record<string, { icon: React.ElementType; bg: string; text: string; desc: string }> = {
  "Service Summary":   { icon: FileText,    bg: "var(--portal-accent-muted)",  text: "var(--portal-accent-text)", desc: "Complete log of all service work performed during the period" },
  "Equipment Health":  { icon: Activity,    bg: "#fff7ed",                       text: "#c2410c",                   desc: "Health scores, diagnostics, and wear metrics per asset" },
  "PM Compliance":     { icon: CheckSquare, bg: "#f0fdf4",                       text: "#15803d",                   desc: "Planned vs. completed PM services and compliance rate" },
  "Cost Analysis":     { icon: DollarSign,  bg: "#f5f3ff",                       text: "#6d28d9",                   desc: "Spend breakdown by asset, category, and time period" },
}

function ReportCard({ report, onDownload }: {
  report: typeof allReports[number]
  onDownload: (id: string) => void
}) {
  const meta = TYPE_META[report.type] ?? TYPE_META["Service Summary"]
  const Icon = meta.icon

  return (
    <div className="portal-card p-5 flex items-start gap-4 group hover:shadow-md transition-shadow">
      <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
        style={{ background: meta.bg }}>
        <Icon size={20} style={{ color: meta.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-pretty" style={{ color: "var(--portal-foreground)" }}>{report.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: meta.bg, color: meta.text }}>{report.type}</span>
              <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>Period: {report.period}</span>
            </div>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>{meta.desc}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
            Generated {fmtDate(report.generatedDate)} &bull;{" "}
            <span className="font-medium">{(report.sizeKb / 1024).toFixed(2)} MB</span>
          </div>
          <button
            onClick={() => onDownload(report.id)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-md border transition-all"
            style={{
              borderColor: "var(--portal-border)",
              color: "var(--portal-secondary)",
              background: "var(--portal-surface)",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.background = "var(--portal-accent-muted)"
              el.style.borderColor = "var(--portal-accent)"
              el.style.color = "var(--portal-accent-text)"
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = "var(--portal-surface)"
              el.style.borderColor = "var(--portal-border)"
              el.style.color = "var(--portal-secondary)"
            }}>
            <FileDown size={13} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PortalReportsPage() {
  const [filter, setFilter] = useState("All")
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())

  const types = ["All", ...Object.keys(TYPE_META)]
  const filtered = allReports.filter((r) => filter === "All" || r.type === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Download service summaries, health reports, and cost analyses
          </p>
        </div>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon
          const count = allReports.filter(r => r.type === type).length
          return (
            <button key={type}
              onClick={() => setFilter(filter === type ? "All" : type)}
              className="portal-card p-4 text-left transition-all hover:shadow-md"
              style={{
                borderColor: filter === type ? "var(--portal-accent)" : undefined,
                boxShadow: filter === type ? "0 0 0 2px #2563eb22" : undefined,
              }}>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg mb-3"
                style={{ background: meta.bg }}>
                <Icon size={16} style={{ color: meta.text }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{type}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{count} available</p>
            </button>
          )
        })}
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit"
        style={{ background: "var(--portal-hover)", border: "1px solid var(--portal-border-light)" }}>
        {types.map((t) => (
          <button key={t}
            onClick={() => setFilter(t)}
            className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={{
              background: filter === t ? "var(--portal-surface)" : "transparent",
              color: filter === t ? "var(--portal-foreground)" : "var(--portal-nav-text)",
              boxShadow: filter === t ? "var(--portal-shadow-sm)" : "none",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Report cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="portal-card py-16 text-center">
            <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--portal-nav-icon)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>No reports available</p>
          </div>
        ) : (
          filtered.map((r) => (
            <ReportCard key={r.id} report={r}
              onDownload={(id) => setDownloaded((prev) => new Set([...prev, id]))} />
          ))
        )}
      </div>

      {/* Request report */}
      <div className="portal-card p-5 flex items-center justify-between"
        style={{ background: "var(--portal-accent-muted)", borderColor: "#bfdbfe" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--portal-accent-text)" }}>
            Need a custom report?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--portal-accent)" }}>
            Contact your account manager to request a tailored analysis.
          </p>
        </div>
        <button className="portal-btn-primary shrink-0">
          Request Report <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
