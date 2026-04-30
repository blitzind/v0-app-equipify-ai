"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  AlertCircle, RefreshCcw, TrendingUp, ShieldAlert, DollarSign,
  ChevronRight, Sparkles, Download, X, CheckCircle2,
  AlertTriangle, Clock, ArrowUpRight, BarChart3, Users,
  Zap, FileText,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts"
import {
  computeKpis,
  computeCategoryBreakdown,
  computeCustomerRiskScores,
  getAllInsightsSorted,
  getInsightsByCategory,
  revenueTrend,
  SEVERITY_COLORS,
  CATEGORY_META,
  aiSummaryReport,
  type InsightCategory,
  type InsightSeverity,
  type AiInsight,
} from "@/lib/insights-engine"

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: InsightCategory[] = [
  "overdue_client", "repeat_failure", "upsell", "expiring_warranty", "revenue_opportunity",
]

const CATEGORY_ICONS: Record<InsightCategory, React.ElementType> = {
  overdue_client: AlertCircle,
  repeat_failure: RefreshCcw,
  upsell: TrendingUp,
  expiring_warranty: ShieldAlert,
  revenue_opportunity: DollarSign,
}

function fmt$(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
}

function fmtFull$(n: number) {
  return `$${n.toLocaleString()}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const c = SEVERITY_COLORS[severity]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 90 ? "#22c55e" : value >= 75 ? "#3b82f6" : "#f59e0b"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-medium" style={{ color }}>{value}%</span>
    </div>
  )
}

function InsightCard({ insight, onDismiss }: { insight: AiInsight; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const c = SEVERITY_COLORS[insight.severity]
  const CatIcon = CATEGORY_ICONS[insight.category]

  return (
    <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeft: `3px solid ${c.dot}` }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: c.bg }}>
              <CatIcon size={14} style={{ color: c.dot }} />
            </div>
            <p className="text-sm font-semibold text-zinc-900 leading-tight text-balance">{insight.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeverityBadge severity={insight.severity} />
            <button onClick={() => onDismiss(insight.id)}
              className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Dismiss insight">
              <X size={13} />
            </button>
          </div>
        </div>

        <p className={`text-sm text-zinc-500 leading-relaxed mb-3 ${!expanded ? "line-clamp-2" : ""}`}>
          {insight.description}
        </p>

        {/* Data points */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {insight.dataPoints.map((dp) => (
            <div key={dp.label} className="bg-zinc-50 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-0.5">{dp.label}</p>
              <p className="text-xs font-semibold text-zinc-800">{dp.value}</p>
            </div>
          ))}
        </div>

        {/* Confidence */}
        <div className="mb-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">AI Confidence</p>
          <ConfidenceMeter value={insight.confidence} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {insight.estimatedValue && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <ArrowUpRight size={11} />
                {fmtFull$(insight.estimatedValue)} opportunity
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              {expanded ? "Show less" : "Show more"}
            </button>
            <Link href={insight.actionHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              {insight.actionLabel} <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, sub, icon: Icon, accent, pulse,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; accent: string; pulse?: boolean
}) {
  return (
    <div className="relative rounded-xl p-4 flex flex-col gap-2 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + "33" }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{sub}</p>}
      {pulse && (
        <span className="absolute top-3 right-3 w-2 h-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: accent }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
        </span>
      )}
    </div>
  )
}

// ─── Summary Report Modal ─────────────────────────────────────────────────────

function SummaryReportModal({ onClose }: { onClose: () => void }) {
  const report = aiSummaryReport
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">AI Executive Summary</h2>
              <p className="text-xs text-zinc-400">Generated {report.period} &bull; {report.totalInsights} insights analyzed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> Export PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Snapshot metrics */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Critical Insights", value: report.criticalCount, color: "#ef4444", bg: "#fef2f2" },
              { label: "High Insights",     value: report.highCount,     color: "#f97316", bg: "#fff7ed" },
              { label: "Total Opportunity", value: fmtFull$(report.totalEstimatedOpportunity), color: "#10b981", bg: "#f0fdf4" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg }}>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Top risks */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Top Risks</h3>
            <div className="space-y-2">
              {report.topRisks.map((r, i) => (
                <div key={i} className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-700 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top opportunities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Top Opportunities</h3>
            <div className="space-y-2">
              {report.topOpportunities.map((o, i) => (
                <div key={i} className="flex gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-700 leading-relaxed">{o}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended actions */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Recommended Actions</h3>
            <div className="space-y-2">
              {report.recommendedActions.map((a) => (
                <div key={a.priority} className="flex gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {a.priority}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{a.action}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{a.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const kpis = useMemo(computeKpis, [])
  const breakdown = useMemo(computeCategoryBreakdown, [])
  const riskScores = useMemo(computeCustomerRiskScores, [])
  const allInsights = useMemo(getAllInsightsSorted, [])

  const [activeCategory, setActiveCategory] = useState<InsightCategory | "all">("all")
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showReport, setShowReport] = useState(false)

  const visibleInsights = useMemo(() => {
    const base = activeCategory === "all" ? allInsights : getInsightsByCategory(activeCategory)
    return base.filter((i) => !dismissed.has(i.id))
  }, [activeCategory, dismissed, allInsights])

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]))
  }

  const RISK_COLORS: Record<string, string> = {
    Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e",
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* ── Executive hero header ─────────────────────────────────────────── */}
      <div className="shrink-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #162032 100%)" }}>
        <div className="px-6 pt-6 pb-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#3b82f6" }}>
                  Equipify AI
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Intelligence Hub</h1>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                AI-generated predictions &bull; Updated April 30, 2026 at 08:00
              </p>
            </div>
            <button onClick={() => setShowReport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 shrink-0"
              style={{ background: "#2563eb", boxShadow: "0 0 20px rgba(37,99,235,0.35)" }}>
              <FileText size={14} />
              Executive Summary
            </button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <KpiCard label="Total Insights" value={String(kpis.totalInsights)}
              sub={`${kpis.criticalCount} critical, ${kpis.highCount} high`}
              icon={Zap} accent="#3b82f6" pulse />
            <KpiCard label="Revenue Opportunity" value={fmt$(kpis.totalOpportunity)}
              sub="across all insight types"
              icon={DollarSign} accent="#10b981" />
            <KpiCard label="Repeat Failures" value={String(kpis.repeatFailureEquipmentCount)}
              sub="units with recurring issues"
              icon={RefreshCcw} accent="#f97316" />
            <KpiCard label="Pending Quotes" value={fmt$(kpis.pendingQuoteValue)}
              sub="awaiting approval"
              icon={BarChart3} accent="#eab308" />
            <KpiCard label="Avg Confidence" value={`${kpis.avgConfidence}%`}
              sub="AI prediction accuracy"
              icon={CheckCircle2} accent="#a78bfa" />
          </div>

          {/* Category nav tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0" style={{ scrollbarWidth: "none" }}>
            {([["all", "All Insights", allInsights.length - dismissed.size]] as const).concat(
              breakdown.map((b) => [b.category, b.label, b.count] as const)
            ).map(([key, label, count]) => {
              const active = activeCategory === key
              const accentHex = key === "all" ? "#3b82f6" : CATEGORY_META[key as InsightCategory].accentHex
              return (
                <button key={key}
                  onClick={() => setActiveCategory(key as InsightCategory | "all")}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all"
                  style={active
                    ? { background: "#ffffff", color: "#111827", borderTop: `2px solid ${accentHex}` }
                    : { color: "rgba(255,255,255,0.55)", background: "transparent" }}>
                  {key !== "all" && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: active ? accentHex : "rgba(255,255,255,0.3)" }} />
                  )}
                  {label}
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={active
                      ? { background: accentHex + "22", color: accentHex }
                      : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 bg-zinc-50 p-6 space-y-6">

        {/* Insight cards */}
        <section>
          {visibleInsights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-zinc-700">All clear in this category</h3>
              <p className="text-sm text-zinc-400 mt-1">No active insights to review.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {visibleInsights.map((ins) => (
                <InsightCard key={ins.id} insight={ins} onDismiss={dismiss} />
              ))}
            </div>
          )}
        </section>

        {/* Bottom row: revenue chart + customer risk table */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Revenue opportunity chart */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-zinc-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Revenue vs. Opportunity Gap</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Captured revenue compared to identified AI opportunities (6 months)</p>
              </div>
              <ArrowUpRight size={16} className="text-zinc-300" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-opp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => [fmtFull$(v), name === "captured" ? "Captured Revenue" : "AI Opportunity"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="captured" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#grad-rev)" name="captured" />
                <Area type="monotone" dataKey="opportunity" stroke="#10b981" strokeWidth={2}
                  fill="url(#grad-opp)" name="opportunity" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3">
              {[["#3b82f6", "Captured Revenue"], ["#10b981", "AI Opportunity"]].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full" style={{ background: c }} />
                  <span className="text-xs text-zinc-400">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer risk table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Customer Risk Scores</h3>
                <p className="text-xs text-zinc-400 mt-0.5">AI-weighted account health</p>
              </div>
              <Users size={15} className="text-zinc-300" />
            </div>
            <div className="space-y-2">
              {riskScores.map((r) => (
                <Link key={r.customerId} href={`/customers/${r.customerId}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 transition-colors group">
                  {/* Score bar */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: RISK_COLORS[r.riskLabel] }}>
                    {r.riskScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{r.company}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: RISK_COLORS[r.riskLabel] + "20", color: RISK_COLORS[r.riskLabel] }}>
                        {r.riskLabel}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-zinc-100">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${r.riskScore}%`, background: RISK_COLORS[r.riskLabel] }} />
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-zinc-400">{r.insightCount} insights</span>
                      {r.openWOs > 0 && <span className="text-[10px] text-zinc-400">{r.openWOs} open WOs</span>}
                      {r.totalOpportunity > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {fmt$(r.totalOpportunity)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Category breakdown bar chart */}
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Insight Distribution by Category</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Count of insights and estimated revenue opportunity per category</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {breakdown.map((b) => {
              const CatIcon = CATEGORY_ICONS[b.category]
              return (
                <button key={b.category}
                  onClick={() => setActiveCategory(b.category)}
                  className="flex flex-col gap-2 p-3 rounded-xl border transition-all hover:shadow-sm text-left"
                  style={activeCategory === b.category
                    ? { borderColor: b.accentHex, background: b.accentHex + "08" }
                    : { borderColor: "#e4e4e7", background: "#fafafa" }}>
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: b.accentHex + "18" }}>
                      <CatIcon size={14} style={{ color: b.accentHex }} />
                    </div>
                    <span className="text-lg font-bold text-zinc-900">{b.count}</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-700 leading-tight">{b.label}</p>
                  {b.totalValue > 0 && (
                    <p className="text-[10px] font-medium" style={{ color: b.accentHex }}>
                      {fmt$(b.totalValue)} opportunity
                    </p>
                  )}
                  <div className="h-1 rounded-full bg-zinc-100">
                    <div className="h-full rounded-full" style={{ width: `${(b.count / aiSummaryReport.totalInsights) * 100}%`, background: b.accentHex }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Summary report modal */}
      {showReport && <SummaryReportModal onClose={() => setShowReport(false)} />}
    </div>
  )
}
