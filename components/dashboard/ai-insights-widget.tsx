"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  AlertTriangle,
  Repeat2,
  UserMinus,
  TrendingUp,
  Wrench,
  ChevronRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  X,
  Clock,
  DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceData, useTenant } from "@/lib/tenant-store"

import type { AiInsight, InsightCategory, InsightSeverity } from "@/lib/mock-data"

// ─── Types ─────────────────────────────────────────────────────────────────────

// Local alias — AiInsight already includes meta and value
type Insight = AiInsight & {
  actionLabel: string
  actionHref?: string
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const INSIGHTS: Insight[] = [
  // Overdue service
  {
    id: "od-1",
    category: "overdue_client",
    severity: "critical",
    title: "14 units are past their service due date",
    description: "Greenfield Industrial has 6 HVAC units averaging 47 days overdue. Continued deferral increases failure risk by ~3× and may void warranty coverage.",
    meta: "Last checked 4 min ago",
    value: "47 days avg overdue",
    actionLabel: "View overdue units",
    actionHref: "/service-schedule",
  },
  {
    id: "od-2",
    category: "overdue_client",
    severity: "high",
    title: "Summit Logistics: 3 compressors past due",
    description: "Refrigeration compressors at Summit Logistics' warehouse have missed their Q1 2026 service window. Schedule before summer peak load.",
    meta: "Due Q1 2026",
    value: "+23 days",
    actionLabel: "Schedule now",
    actionHref: "/work-orders",
  },

  // Repeat failures
  {
    id: "rf-1",
    category: "repeat_failure",
    severity: "critical",
    title: "Carrier 50XC unit failing repeatedly at Apex Corp",
    description: "Unit #EQ-1042 has had 5 work orders in 90 days — all for the same fault code (E04). Root cause has not been addressed. Consider replacing the condenser coil assembly.",
    meta: "5 repairs in 90 days",
    value: "5× in 90 days",
    actionLabel: "View unit history",
    actionHref: "/equipment",
  },
  {
    id: "rf-2",
    category: "repeat_failure",
    severity: "high",
    title: "Trane XR15 recurring electrical fault",
    description: "Unit #EQ-0887 (Valley Fresh Foods) has logged 3 identical capacitor failures. Component may be undersized for the site load.",
    meta: "3 repairs since Jan 2026",
    value: "3× this year",
    actionLabel: "Create diagnostic WO",
    actionHref: "/work-orders",
  },

  // Expiring warranties (replaces churn-risk)
  {
    id: "ew-1",
    category: "expiring_warranty",
    severity: "critical",
    title: "Harborview Restaurant Group: warranties expiring soon",
    description: "3 units expire within 14 days. No renewal quote has been sent. Proactive outreach at this stage converts at 3× the rate of post-expiry contact.",
    meta: "14 days remaining",
    value: "3 units at risk",
    actionLabel: "View customer",
    actionHref: "/customers",
  },
  {
    id: "ew-2",
    category: "expiring_warranty",
    severity: "high",
    title: "2 accounts with unpaid invoices over 45 days",
    description: "Riverside Auto Group ($4,200 overdue) and Oakdale Medical ($1,850 overdue) have not responded to payment reminders. Collections risk is elevated.",
    meta: "Avg $3,025 outstanding",
    value: "$6,050 at risk",
    actionLabel: "View invoices",
    actionHref: "/invoices",
  },

  // Revenue opportunities
  {
    id: "rev-1",
    category: "revenue_opportunity",
    severity: "medium",
    title: "$38,400 in upsell opportunities identified",
    description: "22 customers on time-and-material billing have equipment that qualifies for a maintenance contract. Converting 50% would add ~$19,200 ARR.",
    meta: "Based on last 6 months",
    value: "$38,400 opportunity",
    actionLabel: "View quotes",
    actionHref: "/quotes",
  },
  {
    id: "rev-2",
    category: "revenue_opportunity",
    severity: "medium",
    title: "8 expiring warranties represent $12K in service contracts",
    description: "Warranties expiring in the next 60 days across 8 accounts. Proactive outreach now converts at 3× the rate of outbound cold contact.",
    meta: "Expiring within 60 days",
    value: "~$12,000",
    actionLabel: "View opportunities",
    actionHref: "/service-schedule",
  },

  // Upsell & optimization (replaces technician)
  {
    id: "tech-1",
    category: "upsell",
    severity: "high",
    title: "Marcus Reyes is at 134% capacity this week",
    description: "9 work orders assigned against a 7-order weekly capacity. 3 of his jobs are in the same zone as Jordan Kim, who has 4 open slots.",
    meta: "Week of Apr 28",
    value: "134% utilization",
    actionLabel: "Rebalance schedule",
    actionHref: "/technicians",
  },
  {
    id: "tech-2",
    category: "upsell",
    severity: "low",
    title: "Route optimization could save 4.2 hrs/week",
    description: "Current technician routing has 6 cross-city conflicts. Reordering Tuesday stops for Aisha Patel and Devon Cross could cut drive time by 4.2 hours per week.",
    meta: "Est. $840/month savings",
    value: "4.2 hrs/week",
    actionLabel: "View technicians",
    actionHref: "/technicians",
  },
]

const AI_SUMMARY =
  "Your operation has 14 overdue service units, 2 repeat-failure alerts, and 2 accounts with high churn probability. " +
  "Addressing these now is estimated to protect $44,450 in at-risk revenue. " +
  "Additionally, $38,400 in upsell opportunities and 4.2 hours per week of technician efficiency gains are ready to action."

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  InsightCategory,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  "overdue_client": {
    label: "Overdue Service",
    icon: Clock,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-l-destructive",
  },
  "repeat_failure": {
    label: "Repeat Failures",
    icon: Repeat2,
    color: "text-[color:var(--status-warning)]",
    bg: "bg-[color:var(--status-warning)]/10",
    border: "border-l-[color:var(--status-warning)]",
  },
  "expiring_warranty": {
    label: "Expiring Warranties",
    icon: UserMinus,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-l-destructive",
  },
  "revenue_opportunity": {
    label: "Revenue Opportunities",
    icon: DollarSign,
    color: "text-[color:var(--status-success)]",
    bg: "bg-[color:var(--status-success)]/10",
    border: "border-l-[color:var(--status-success)]",
  },
  "upsell": {
    label: "Upsell & Optimization",
    icon: Wrench,
    color: "text-[color:var(--ds-info-subtle)]",
    bg: "bg-[color:var(--ds-info-bg)]",
    border: "border-l-[color:var(--ds-info-subtle)]",
  },
}

const SEVERITY_DOT: Record<InsightSeverity, string> = {
  critical: "bg-destructive",
  high: "bg-[color:var(--status-warning)]",
  medium: "bg-[color:var(--ds-info-subtle)]",
  low: "bg-muted-foreground",
}

const ALL_CATEGORIES: InsightCategory[] = [
  "overdue_client",
  "repeat_failure",
  "expiring_warranty",
  "revenue_opportunity",
  "upsell",
]

// ─── Component ────────────────────────────────────────────────────────────────

export function AIInsightsWidget() {
  const router = useRouter()
  const { workspace } = useTenant()
  const { aiInsights: INSIGHTS } = useWorkspaceData()
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [activeCategory, setActiveCategory] = useState<InsightCategory | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [summaryKey, setSummaryKey] = useState(0)

  // Reset local state whenever the workspace changes
  useEffect(() => {
    setDismissed(new Set())
    setActiveCategory(null)
    setRan(false)
    setShowSummary(false)
    setFeedback(null)
  }, [workspace.id])

  const handleRunSummary = useCallback(async () => {
    setRunning(true)
    setShowSummary(false)
    await new Promise((r) => setTimeout(r, 1800))
    setRunning(false)
    setRan(true)
    setShowSummary(true)
    setFeedback(null)
    setSummaryKey((k) => k + 1)
  }, [])

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }, [])

  const filtered = INSIGHTS.filter(
    (i) =>
      !dismissed.has(i.id) &&
      (activeCategory === null || i.category === activeCategory),
  )

  const counts = Object.fromEntries(
    ALL_CATEGORIES.map((cat) => [
      cat,
      INSIGHTS.filter((i) => !dismissed.has(i.id) && i.category === cat).length,
    ]),
  ) as Record<InsightCategory, number>

  const totalActive = INSIGHTS.filter((i) => !dismissed.has(i.id)).length

  return (
    <div className="bg-card rounded-xl border border-[color:var(--ds-info-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--ds-info-text)]">AI Insights</h2>
              {totalActive > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[color:var(--ds-info-subtle)] text-white tabular-nums">
                  {totalActive}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[color:var(--ds-info-text)] opacity-70 leading-snug mt-0.5">
              Overdue service, repeat failures, churn risks &amp; revenue opportunities
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push("/insights")}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors",
              "bg-white/60 border-[color:var(--ds-info-border)] text-[color:var(--ds-info-text)]",
              "hover:bg-white",
            )}
          >
            View Insights
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            type="button"
            onClick={handleRunSummary}
            disabled={running}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border-0 transition-colors",
              "bg-[color:var(--ds-info-subtle)] text-white",
              "hover:opacity-90 active:opacity-100 disabled:opacity-60 disabled:cursor-not-allowed",
            )}
            aria-busy={running}
          >
            {running ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {running ? "Running…" : "Run AI Summary"}
          </button>
        </div>
      </div>

      {/* ── AI Summary strip ── */}
      {showSummary && (
        <div
          key={summaryKey}
          className="px-5 py-3.5 border-b border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)] flex items-start gap-3"
        >
          <Sparkles className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1 text-xs leading-relaxed text-[color:var(--ds-info-text)]">
            {AI_SUMMARY}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setFeedback("up")}
              aria-pressed={feedback === "up"}
              aria-label="Mark summary as helpful"
              className={cn(
                "p-1 rounded transition-colors",
                feedback === "up"
                  ? "text-[color:var(--ds-info-subtle)]"
                  : "text-[color:var(--ds-info-text)] opacity-40 hover:opacity-80",
              )}
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setFeedback("down")}
              aria-pressed={feedback === "down"}
              aria-label="Mark summary as unhelpful"
              className={cn(
                "p-1 rounded transition-colors",
                feedback === "down"
                  ? "text-[color:var(--ds-info-subtle)]"
                  : "text-[color:var(--ds-info-text)] opacity-40 hover:opacity-80",
              )}
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Category filter tabs ── */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-border overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={cn(
            "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0",
            activeCategory === null
              ? "bg-[color:var(--ds-info-subtle)] text-white"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
          )}
        >
          All
          <span className="tabular-nums opacity-70">{totalActive}</span>
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          const count = counts[cat]
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0",
                activeCategory === cat
                  ? "bg-[color:var(--ds-info-subtle)] text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                count === 0 && "opacity-40",
              )}
              disabled={count === 0}
            >
              <Icon className="w-3 h-3" aria-hidden="true" />
              {meta.label}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Insight rows ── */}
      {!ran && !running && filtered.length > 0 && (
        <ul className="divide-y divide-border" role="list" aria-label="AI Insights">
          {filtered.map((insight) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              onDismiss={handleDismiss}
              onAction={(href) => href && router.push(href)}
            />
          ))}
        </ul>
      )}

      {running && (
        <ul className="divide-y divide-border" role="list" aria-label="Loading AI Insights">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="px-5 py-4 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 rounded bg-muted animate-pulse w-3/4" />
                <div className="h-2.5 rounded bg-muted animate-pulse w-full" />
                <div className="h-2.5 rounded bg-muted animate-pulse w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {ran && !running && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
          <div className="w-10 h-10 rounded-full bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[color:var(--ds-info-subtle)]" />
          </div>
          <p className="text-sm font-semibold text-foreground">All insights addressed</p>
          <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
            All recommendations in this category have been dismissed. Run a new summary to refresh.
          </p>
        </div>
      )}

      {!ran && !running && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
          <div className="w-10 h-10 rounded-full bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[color:var(--ds-info-subtle)]" />
          </div>
          <p className="text-sm font-semibold text-foreground">No insights in this category</p>
          <p className="text-xs text-muted-foreground">Try selecting a different category or run a fresh AI summary.</p>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-muted/30">
        <p className="text-[10px] text-muted-foreground">
          {ran
            ? "Last run just now · Powered by Equipify AI"
            : "Click \u201cRun AI Summary\u201d to generate fresh insights"}
        </p>
        <button
          type="button"
          onClick={() => router.push("/insights")}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline transition-colors"
        >
          Full AI Insights
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── InsightRow sub-component ─────────────────────────────────────────────────

function InsightRow({
  insight,
  onDismiss,
  onAction,
}: {
  insight: Insight
  onDismiss: (id: string) => void
  onAction: (href?: string) => void
}) {
  const meta = CATEGORY_META[insight.category]
  const Icon = meta.icon

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-5 py-4 border-l-2 transition-colors",
        meta.border,
      )}
      style={{ backgroundColor: "var(--card)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor =
          "color-mix(in oklch, var(--primary) 2.5%, var(--card))")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--card)")
      }
    >
      {/* Icon tile */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          meta.bg,
        )}
      >
        <Icon className={cn("w-4 h-4", meta.color)} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]",
                SEVERITY_DOT[insight.severity],
              )}
              aria-label={`${insight.severity} severity`}
            />
            <p className="text-sm font-semibold text-foreground leading-snug">
              {insight.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(insight.id)}
            aria-label={`Dismiss: ${insight.title}`}
            className="shrink-0 p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {insight.description}
        </p>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {insight.value && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-card text-foreground border-border tabular-nums">
              {insight.value}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
            {insight.meta}
          </span>
          <button
            type="button"
            onClick={() => onAction(insight.actionHref)}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline underline-offset-2 transition-all ml-auto"
          >
            {insight.actionLabel}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  )
}
