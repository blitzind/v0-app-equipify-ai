"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  AlertCircle, RefreshCcw, TrendingUp, Shield, DollarSign,
  ChevronRight, Sparkles, Download, X, CheckCircle2,
  AlertTriangle, Clock, ArrowUpRight, BarChart3, Users,
  Zap, FileText, Loader2, Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  SEVERITY_COLORS,
  CATEGORY_META,
  type InsightCategory,
  type InsightSeverity,
  type AiInsight,
} from "@/lib/insights-engine"
import { useSupabaseDashboard } from "@/lib/dashboard/use-supabase-dashboard"
import type { AiGeneratedInsightItem } from "@/lib/insights/openai-generate-insights"
import { AiInsightActions } from "@/components/insights/ai-insight-actions"
import { Toaster } from "@/components/ui/toaster"
import { useBillingAccess } from "@/lib/billing-access-context"
import { aiFeatureUpgradeMessage } from "@/lib/billing/feature-access"

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<InsightCategory, React.ElementType> = {
  overdue_client: AlertCircle,
  repeat_failure: RefreshCcw,
  upsell: TrendingUp,
  expiring_warranty: Shield,
  revenue_opportunity: DollarSign,
}

function fmt$(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
}

function fmtFull$(n: number) {
  return `$${n.toLocaleString()}`
}

const AI_CATEGORY_LABEL: Record<AiGeneratedInsightItem["category"], string> = {
  revenue: "Revenue",
  operations: "Operations",
  maintenance: "Maintenance",
  warranty: "Warranty",
  customer: "Customer",
  technician: "Technician",
}

const AI_SEVERITY_DOT: Record<AiGeneratedInsightItem["severity"], string> = {
  high: "#ef4444",
  medium: "#eab308",
  low: "#22c55e",
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

function AiInsightCard({
  item,
  organizationId,
  insightIndex,
}: {
  item: AiGeneratedInsightItem
  organizationId: string | null
  insightIndex: number
}) {
  const dot = AI_SEVERITY_DOT[item.severity]
  return (
    <div
      className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden"
      style={{ borderLeft: `3px solid ${dot}` }}
    >
      <div className="p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900 leading-tight text-balance">{item.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600"
            >
              {AI_CATEGORY_LABEL[item.category]}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ color: dot, background: `${dot}18` }}
            >
              {item.severity}
            </span>
          </div>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed">{item.insight}</p>
        <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">Recommended</p>
          <p className="text-xs text-zinc-800 leading-relaxed">{item.recommendedAction}</p>
        </div>
        {item.relatedMetric ? (
          <p className="text-[11px] text-zinc-400 font-mono">{item.relatedMetric}</p>
        ) : null}
        <AiInsightActions organizationId={organizationId} insightIndex={insightIndex} item={item} />
      </div>
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
            <Button variant="ghost" size="icon-sm" onClick={() => onDismiss(insight.id)} className="size-6 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100" aria-label="Dismiss insight">
              <X size={13} />
            </Button>
          </div>
        </div>

        <p className={`text-sm text-zinc-500 leading-relaxed mb-3 ${!expanded ? "line-clamp-2" : ""}`}>
          {insight.description}
        </p>

        {/* Data points */}
        {insight.dataPoints && insight.dataPoints.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {insight.dataPoints.map((dp) => (
              <div key={dp.label} className="bg-zinc-50 rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-0.5">{dp.label}</p>
                <p className="text-xs font-semibold text-zinc-800">{dp.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Confidence */}
        {insight.confidence != null && (
          <div className="mb-3">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">AI Confidence</p>
            <ConfidenceMeter value={insight.confidence} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {insight.estimatedValue && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold ds-badge-success border px-2 py-0.5 rounded-full">
                <ArrowUpRight size={11} />
                {fmtFull$(insight.estimatedValue)} opportunity
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs text-zinc-400 hover:text-zinc-600 h-7">
              {expanded ? "Show less" : "Show more"}
            </Button>
            <Link href={insight.actionHref}
              className="inline-flex items-center gap-1 text-xs font-medium ds-text-info hover:opacity-80 bg-[var(--ds-info-bg)] hover:bg-[var(--ds-info-border)] px-3 py-1.5 rounded-lg transition-colors">
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

// ─── Summary Report Modal ────────────────────────────────────────────────────�����

type ExecutiveSummaryReport = {
  period: string
  totalInsights: number
  criticalCount: number
  highCount: number
  totalEstimatedOpportunity: number
  topRisks: string[]
  topOpportunities: string[]
  recommendedActions: { priority: number; action: string; impact: string }[]
}

function SummaryReportModal({ onClose, report }: { onClose: () => void; report: ExecutiveSummaryReport }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles size={15} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Executive summary</h2>
              <p className="text-xs text-zinc-400">Generated {report.period} &bull; {report.totalInsights} insights analyzed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled title="Coming soon" className="text-zinc-500 cursor-not-allowed opacity-60">
              <Download size={12} /> Export PDF
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
              <X size={16} />
            </Button>
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
                <div key={i} className="flex gap-3 p-3 ds-alert-danger border rounded-xl">
                  <AlertTriangle size={14} className="ds-icon-danger shrink-0 mt-0.5" />
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
                <div key={i} className="flex gap-3 p-3 ds-alert-success border rounded-xl">
                  <TrendingUp size={14} className="ds-icon-success shrink-0 mt-0.5" />
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
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
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
  const dash = useSupabaseDashboard()
  const { insightsAllowed } = useBillingAccess()
  const liveInsights = dash.operationalInsights

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPayload, setAiPayload] = useState<{
    summary: string
    insights: AiGeneratedInsightItem[]
    generatedAt: string
  } | null>(null)

  const generateAiInsights = useCallback(async () => {
    if (!dash.organizationId) {
      setAiError("Select an organization to generate AI insights.")
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: dash.organizationId }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        summary?: string
        insights?: AiGeneratedInsightItem[]
        generatedAt?: string
      }
      if (!res.ok) {
        setAiPayload(null)
        setAiError(
          data.message ?? (data.error === "not_configured" ? "AI is not configured on the server." : data.error) ?? "Could not generate insights.",
        )
        return
      }
      if (data.ok && data.generatedAt) {
        setAiError(null)
        setAiPayload({
          summary: data.summary ?? "",
          insights: data.insights ?? [],
          generatedAt: data.generatedAt,
        })
      }
    } catch (e) {
      setAiPayload(null)
      setAiError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setAiLoading(false)
    }
  }, [dash.organizationId])

  const breakdown = useMemo(() => {
    return (Object.keys(CATEGORY_META) as InsightCategory[]).map((cat) => {
      const items = liveInsights.filter((i) => i.category === cat)
      return {
        category: cat,
        label: CATEGORY_META[cat].label,
        count: items.length,
        totalValue: items.reduce((s, i) => s + (i.estimatedValue ?? 0), 0),
        critical: items.filter((i) => i.severity === "critical").length,
        high: items.filter((i) => i.severity === "high").length,
        accentHex: CATEGORY_META[cat].accentHex,
      }
    })
  }, [liveInsights])

  const kpis = useMemo(() => {
    const s = dash.stats
    const dollars = Math.round(s.monthlyRevenueCents / 100)
    return {
      totalInsights: liveInsights.length,
      criticalCount: liveInsights.filter((i) => i.severity === "critical").length,
      highCount: liveInsights.filter((i) => i.severity === "high").length,
      totalOpportunity: dollars,
      pendingQuoteValue: s.openWorkOrders,
      repeatFailureEquipmentCount: s.repeatRepairAlertsCount,
      expiringWarrantyCount: s.expiringWarrantiesCount,
      avgConfidence: liveInsights.length === 0 ? 0 : 100,
    }
  }, [dash.stats, liveInsights])

  const revenueChartRows = useMemo(
    () =>
      dash.revenueByMonth.map((p) => ({
        month: p.month,
        captured: p.revenue,
        opportunity: 0,
      })),
    [dash.revenueByMonth],
  )

  const executiveSummary = useMemo((): ExecutiveSummaryReport => {
    const critical = liveInsights.filter((i) => i.severity === "critical")
    const high = liveInsights.filter((i) => i.severity === "high")
    return {
      period: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
      totalInsights: liveInsights.length,
      criticalCount: critical.length,
      highCount: high.length,
      totalEstimatedOpportunity: Math.round(dash.stats.monthlyRevenueCents / 100),
      topRisks: [...critical, ...high].slice(0, 5).map((i) => i.title),
      topOpportunities: liveInsights
        .filter((i) => i.category === "revenue_opportunity")
        .slice(0, 5)
        .map((i) => i.title),
      recommendedActions: liveInsights.slice(0, 6).map((i, idx) => ({
        priority: idx + 1,
        action: i.title,
        impact: i.description.slice(0, 160),
      })),
    }
  }, [liveInsights, dash.stats.monthlyRevenueCents])

  const [activeCategory, setActiveCategory] = useState<InsightCategory | "all">("all")
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showReport, setShowReport] = useState(false)

  const visibleInsights = useMemo(() => {
    const base =
      activeCategory === "all" ? liveInsights : liveInsights.filter((i) => i.category === activeCategory)
    return base.filter((i) => !dismissed.has(i.id))
  }, [activeCategory, dismissed, liveInsights])

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]))
  }

  return (
    <div className="min-h-full flex flex-col">
      {!insightsAllowed && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              {aiFeatureUpgradeMessage()}{" "}
              <Link href="/settings/billing" className="font-semibold underline-offset-2 hover:underline">
                View billing
              </Link>
            </p>
          </div>
        </div>
      )}
      {/* ── Executive hero header ─────────────────────────────────────────── */}
      <div className="shrink-0 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #162032 100%)" }}>
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
                Rule-based operational signals from your live data &bull; {new Date().toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => void generateAiInsights()}
                disabled={aiLoading || dash.loading || !dash.organizationId || !insightsAllowed}
                title={!insightsAllowed ? aiFeatureUpgradeMessage() : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: "#7c3aed", boxShadow: "0 0 18px rgba(124,58,237,0.35)" }}
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                Generate AI Insights
              </button>
              <button onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 shrink-0"
                style={{ background: "#2563eb", boxShadow: "0 0 20px rgba(37,99,235,0.35)" }}>
                <FileText size={14} />
                Executive Summary
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <KpiCard label="Operational insights" value={String(kpis.totalInsights)}
              sub={`${kpis.criticalCount} critical · ${kpis.highCount} high`}
              icon={Zap} accent="#3b82f6" pulse />
            <KpiCard label="Closed revenue (MTD)" value={fmt$(kpis.totalOpportunity)}
              sub="Completed / invoiced work this month"
              icon={DollarSign} accent="#10b981" />
            <KpiCard label="Repeat repair alerts" value={String(kpis.repeatFailureEquipmentCount)}
              sub="90-day equipment signals"
              icon={RefreshCcw} accent="#f97316" />
            <KpiCard label="Open work orders" value={String(kpis.pendingQuoteValue)}
              sub="Open, scheduled, in progress"
              icon={BarChart3} accent="#eab308" />
            <KpiCard label="Warranties (30d)" value={String(kpis.expiringWarrantyCount)}
              sub="Expiring coverage windows"
              icon={CheckCircle2} accent="#a78bfa" />
          </div>

          {/* Category nav tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0" style={{ scrollbarWidth: "none" }}>
            {(([["all", "All Insights", liveInsights.length - dismissed.size]] as [string, string, number][]).concat(
              breakdown.map((b) => [b.category, b.label, b.count] as [string, string, number])
            )).map(([key, label, count]) => {
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

        {/* AI-generated (on-demand) */}
        <section className="space-y-4">
          {aiError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {aiError}
            </div>
          ) : null}
          {aiLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating insights from your live data…
            </div>
          ) : null}
          {aiPayload ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    AI-generated operational insights
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Generated on{" "}
                    {new Date(aiPayload.generatedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
              {aiPayload.summary ? (
                <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-zinc-800 leading-relaxed">
                  {aiPayload.summary}
                </div>
              ) : null}
              {aiPayload.insights.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {aiPayload.insights.map((item, idx) => (
                    <AiInsightCard
                      key={`${item.title}-${idx}`}
                      item={item}
                      organizationId={dash.organizationId}
                      insightIndex={idx}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No structured insights returned — try again later.</p>
              )}
            </div>
          ) : null}
        </section>

        <div className="border-t border-zinc-200 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            Rule-based operational signals
          </h2>
        </div>

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
                <h3 className="text-sm font-bold text-zinc-900">Revenue trend</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Completed / invoiced work revenue by month (live org)</p>
              </div>
              <ArrowUpRight size={16} className="text-zinc-300" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartRows} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded-full" style={{ background: "#3b82f6" }} />
                <span className="text-xs text-zinc-400">Revenue (USD)</span>
              </div>
            </div>
          </div>

          {/* Customer risk table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Repeat work (90 days)</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Live equipment with multiple work orders</p>
              </div>
              <Users size={15} className="text-zinc-300" />
            </div>
            <div className="space-y-2">
              {dash.repeatRepairs.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">No repeat-repair patterns detected in the last 90 days.</p>
              ) : (
                dash.repeatRepairs.slice(0, 8).map((r) => (
                  <Link
                    key={r.equipmentId}
                    href={`/equipment?open=${encodeURIComponent(r.equipmentId)}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-orange-500">
                      {r.repairs}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{r.equipmentName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{r.customerName}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{r.issue}</p>
                    </div>
                    <ChevronRight size={13} className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
                  </Link>
                ))
              )}
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
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.count / Math.max(1, liveInsights.length)) * 100}%`,
                        background: b.accentHex,
                      }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Summary report modal */}
      {showReport && (
        <SummaryReportModal onClose={() => setShowReport(false)} report={executiveSummary} />
      )}
      <Toaster />
    </div>
  )
}
