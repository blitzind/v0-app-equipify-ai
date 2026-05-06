import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CommunicationSuggestion } from "@/lib/communications/types"

export type { CommunicationSuggestion } from "@/lib/communications/types"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const x = new Date(iso + "T12:00:00")
  x.setUTCDate(x.getUTCDate() + days)
  return x.toISOString().slice(0, 10)
}

/** Operational AI-style recommendations from live org data (no LLM). */
export async function computeCommunicationSuggestions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CommunicationSuggestion[]> {
  const today = isoDate(new Date())
  const fiveDaysAgo = addDays(today, -5)
  const weekEnd = addDays(today, 7)

  const [quotesRes, invRes, mpRes, failedRes] = await Promise.all([
    supabase
      .from("org_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["sent", "pending_approval"])
      .not("sent_at", "is", null)
      .lt("sent_at", fiveDaysAgo),
    supabase
      .from("org_invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["unpaid", "overdue"]),
    supabase
      .from("maintenance_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .not("next_due_date", "is", null)
      .gte("next_due_date", today)
      .lte("next_due_date", weekEnd),
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("delivery_status", ["failed", "bounced"]),
  ])

  const staleQuotes = quotesRes.count ?? 0
  const overdueInvoices = invRes.count ?? 0
  const maintWeek = mpRes.count ?? 0
  const failed = failedRes.count ?? 0

  const out: CommunicationSuggestion[] = []

  if (staleQuotes > 0) {
    out.push({
      id: "quotes_stale",
      severity: staleQuotes >= 8 ? "high" : "medium",
      title: `${staleQuotes} quote${staleQuotes === 1 ? "" : "s"} need follow-up`,
      detail: "Quotes have been outstanding for more than 5 days since being sent.",
      metric: staleQuotes,
      href: "/quotes",
    })
  }

  if (overdueInvoices > 0) {
    out.push({
      id: "invoice_remind",
      severity: overdueInvoices >= 5 ? "high" : "medium",
      title: `${overdueInvoices} unpaid invoice${overdueInvoices === 1 ? "" : "s"} should receive reminders`,
      detail: "Send reminders or verify payment status for open balances.",
      metric: overdueInvoices,
      href: "/invoices",
    })
  }

  if (maintWeek > 0) {
    out.push({
      id: "maint_week",
      severity: "low",
      title: `${maintWeek} maintenance plan${maintWeek === 1 ? "" : "s"} due this week`,
      detail: "Confirm scheduling and customer notifications before service dates.",
      metric: maintWeek,
      href: "/maintenance-plans",
    })
  }

  if (failed > 0) {
    out.push({
      id: "failed_delivery",
      severity: "high",
      title: `${failed} failed or bounced deliver${failed === 1 ? "y" : "ies"}`,
      detail: "Review the Failed Deliveries tab and retry after fixing recipient issues.",
      metric: failed,
      href: "/communications",
    })
  }

  if (out.length === 0) {
    out.push({
      id: "all_clear",
      severity: "low",
      title: "No urgent communication gaps detected",
      detail: "Keep syncing reminders from the Activity tab after quotes, invoices, and visits.",
    })
  }

  return out
}
