/**
 * Equipify AI Insights Engine
 * Computes derived metrics from raw data for the AI Insights dashboard.
 * All functions are pure — no side effects, no state.
 */

import {
  aiInsights,
  aiSummaryReport,
  customers,
  equipment,
  workOrders,
  maintenancePlans,
  portalInvoices,
  portalQuotes,
  type AiInsight,
  type InsightCategory,
  type InsightSeverity,
} from "./mock-data"

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { aiInsights, aiSummaryReport }
export type { AiInsight, InsightCategory, InsightSeverity }

// ─── Severity helpers ─────────────────────────────────────────────────────────

export const SEVERITY_ORDER: InsightSeverity[] = ["critical", "high", "medium", "low"]

export const SEVERITY_COLORS: Record<InsightSeverity, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5", dot: "#ef4444" },
  high:     { bg: "#fff7ed", text: "#c2410c", border: "#fdba74", dot: "#f97316" },
  medium:   { bg: "#fefce8", text: "#a16207", border: "#fde047", dot: "#eab308" },
  low:      { bg: "#f0fdf4", text: "#15803d", border: "#86efac", dot: "#22c55e" },
}

export const CATEGORY_META: Record<InsightCategory, { label: string; icon: string; accentHex: string }> = {
  overdue_client:      { label: "Overdue Clients",       icon: "AlertCircle",   accentHex: "#ef4444" },
  repeat_failure:      { label: "Repeat Failures",       icon: "RefreshCcw",    accentHex: "#f97316" },
  upsell:              { label: "Upsell Opportunities",  icon: "TrendingUp",    accentHex: "#10b981" },
  expiring_warranty:   { label: "Expiring Warranties",   icon: "ShieldAlert",   accentHex: "#eab308" },
  revenue_opportunity: { label: "Revenue Opportunities", icon: "DollarSign",    accentHex: "#3b82f6" },
}

// ─── Aggregate KPIs ───────────────────────────────────────────────────────────

export interface InsightKpis {
  totalInsights: number
  criticalCount: number
  highCount: number
  totalOpportunity: number          // sum of estimatedValue across all insights
  pendingQuoteValue: number         // quotes awaiting approval
  overdueInvoiceValue: number       // invoices overdue
  repeatFailureEquipmentCount: number
  expiringWarrantyCount: number
  upsellOpportunityValue: number
  avgConfidence: number
}

export function computeKpis(): InsightKpis {
  const insights = aiInsights

  const totalOpportunity = insights.reduce((s, i) => s + (i.estimatedValue ?? 0), 0)
  const pendingQuoteValue = portalQuotes
    .filter((q) => q.status === "Pending Approval")
    .reduce((s, q) => s + q.amount, 0)
  const overdueInvoiceValue = portalInvoices
    .filter((i) => i.status === "Overdue")
    .reduce((s, i) => s + i.amount, 0)
  const repeatFailureEq = new Set(
    insights.filter((i) => i.category === "repeat_failure" && i.equipmentId).map((i) => i.equipmentId!)
  ).size
  const expiringW = insights.filter((i) => i.category === "expiring_warranty").length
  const upsellVal = insights
    .filter((i) => i.category === "upsell")
    .reduce((s, i) => s + (i.estimatedValue ?? 0), 0)
  const avgConf = Math.round(insights.reduce((s, i) => s + i.confidence, 0) / insights.length)

  return {
    totalInsights: insights.length,
    criticalCount: insights.filter((i) => i.severity === "critical").length,
    highCount: insights.filter((i) => i.severity === "high").length,
    totalOpportunity,
    pendingQuoteValue,
    overdueInvoiceValue,
    repeatFailureEquipmentCount: repeatFailureEq,
    expiringWarrantyCount: expiringW,
    upsellOpportunityValue: upsellVal,
    avgConfidence: avgConf,
  }
}

// ─── Category breakdown ───────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: InsightCategory
  label: string
  count: number
  totalValue: number
  critical: number
  high: number
  accentHex: string
}

export function computeCategoryBreakdown(): CategoryBreakdown[] {
  return (Object.keys(CATEGORY_META) as InsightCategory[]).map((cat) => {
    const items = aiInsights.filter((i) => i.category === cat)
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
}

// ─── Sorted + filtered insights ───────────────────────────────────────────────

export function getInsightsByCategory(cat: InsightCategory): AiInsight[] {
  return aiInsights
    .filter((i) => i.category === cat)
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}

export function getInsightsBySeverity(sev: InsightSeverity): AiInsight[] {
  return aiInsights.filter((i) => i.severity === sev)
}

export function getAllInsightsSorted(): AiInsight[] {
  return [...aiInsights].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  )
}

// ─── Revenue opportunity trend (last 6 months simulated) ─────────────────────

export interface RevenueTrendPoint {
  month: string
  captured: number
  opportunity: number
}

export const revenueTrend: RevenueTrendPoint[] = [
  { month: "Nov", captured: 142000, opportunity: 28000 },
  { month: "Dec", captured: 158000, opportunity: 34000 },
  { month: "Jan", captured: 135000, opportunity: 41000 },
  { month: "Feb", captured: 161000, opportunity: 37000 },
  { month: "Mar", captured: 172000, opportunity: 44000 },
  { month: "Apr", captured: 184250, opportunity: 108450 },
]

// ─── Customer risk scores ─────────────────────────────────────────────────────

export interface CustomerRiskScore {
  customerId: string
  customerName: string
  company: string
  riskScore: number     // 0–100
  riskLabel: "Critical" | "High" | "Medium" | "Low"
  openWOs: number
  overdueInvoice: boolean
  repeatFailures: number
  expiringWarranties: number
  insightCount: number
  totalOpportunity: number
}

export function computeCustomerRiskScores(): CustomerRiskScore[] {
  return customers.map((c) => {
    const cInsights = aiInsights.filter((i) => i.customerId === c.id)
    const overdueInv = portalInvoices.some((i) => i.customerId === c.id && i.status === "Overdue")
    const repeatFails = cInsights.filter((i) => i.category === "repeat_failure").length
    const expiringW = cInsights.filter((i) => i.category === "expiring_warranty").length
    const critCount = cInsights.filter((i) => i.severity === "critical").length
    const highCount = cInsights.filter((i) => i.severity === "high").length
    const totalOpp = cInsights.reduce((s, i) => s + (i.estimatedValue ?? 0), 0)

    // Weighted risk formula
    const score = Math.min(
      100,
      critCount * 30 +
        highCount * 18 +
        (overdueInv ? 15 : 0) +
        repeatFails * 12 +
        expiringW * 8 +
        c.openWorkOrders * 2
    )

    const riskLabel: CustomerRiskScore["riskLabel"] =
      score >= 70 ? "Critical" : score >= 45 ? "High" : score >= 20 ? "Medium" : "Low"

    return {
      customerId: c.id,
      customerName: c.name,
      company: c.company,
      riskScore: score,
      riskLabel,
      openWOs: c.openWorkOrders,
      overdueInvoice: overdueInv,
      repeatFailures: repeatFails,
      expiringWarranties: expiringW,
      insightCount: cInsights.length,
      totalOpportunity: totalOpp,
    }
  }).sort((a, b) => b.riskScore - a.riskScore)
}
