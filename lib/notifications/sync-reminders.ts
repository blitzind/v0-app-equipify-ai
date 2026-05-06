import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { dispatchWorkflowTriggers } from "@/lib/workflows/dispatch"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

/** Generates/upgrades reminder rows for WOs, maintenance, quotes, and invoices (idempotent keys). */
export async function syncCommunicationReminders(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ upserted: number }> {
  const now = new Date()
  const today = isoDate(now)
  const weekOut = isoDate(addDays(now, 7))
  const horizon = isoDate(addDays(now, 14))
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let upserted = 0

  const { data: wos, error: woErr } = await supabase
    .from("work_orders")
    .select("id, title, scheduled_on, customer_id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("status", ["open", "scheduled", "in_progress"])
    .not("scheduled_on", "is", null)
    .gte("scheduled_on", today)
    .lte("scheduled_on", weekOut)

  if (woErr || !wos?.length) {
    /* continue */
  } else {
    const customerIds = [...new Set(wos.map((w) => w.customer_id as string))]
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", customerIds)
    const custName = new Map((custRows as { id: string; company_name: string }[] | null)?.map((c) => [c.id, c.company_name]) ?? [])

    for (const wo of wos as { id: string; title: string; scheduled_on: string; customer_id: string }[]) {
      const cn = custName.get(wo.customer_id) ?? "Customer"
      const summary = `Scheduled ${wo.scheduled_on} · ${cn}`
      const key = `wo_reminder:${wo.id}`
      const { error } = await supabase.from("communication_events").upsert(
        {
          organization_id: organizationId,
          channel: "in_app",
          direction: "outbound",
          event_type: "work_order_reminder",
          title: `Work order: ${wo.title?.trim() || "Scheduled visit"}`,
          summary,
          audience: "organization",
          counts_toward_unread: true,
          delivery_status: "sent",
          recipient_kind: "none",
          related_entity_type: "work_order",
          related_entity_id: wo.id,
          provider: "internal",
          metadata: { generated: true, scheduled_on: wo.scheduled_on },
          scheduled_reminder_key: key,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scheduled_reminder_key" },
      )
      if (!error) upserted += 1
    }
  }

  const { data: plans, error: mpErr } = await supabase
    .from("maintenance_plans")
    .select("id, name, next_due_date, customer_id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .eq("status", "active")
    .not("next_due_date", "is", null)
    .gte("next_due_date", today)
    .lte("next_due_date", horizon)

  if (!mpErr && plans?.length) {
    const ids = [...new Set(plans.map((p) => p.customer_id as string))]
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", ids)
    const custName = new Map((custRows as { id: string; company_name: string }[] | null)?.map((c) => [c.id, c.company_name]) ?? [])

    for (const p of plans as { id: string; name: string; next_due_date: string; customer_id: string }[]) {
      const cn = custName.get(p.customer_id) ?? "Customer"
      const summary = `Next service ${p.next_due_date} · ${cn}`
      const key = `mp_reminder:${p.id}`
      const { error } = await supabase.from("communication_events").upsert(
        {
          organization_id: organizationId,
          channel: "in_app",
          direction: "outbound",
          event_type: "maintenance_reminder",
          title: `Maintenance: ${p.name}`,
          summary,
          audience: "organization",
          counts_toward_unread: true,
          delivery_status: "sent",
          recipient_kind: "none",
          related_entity_type: "maintenance_plan",
          related_entity_id: p.id,
          recipient_customer_id: p.customer_id,
          provider: "internal",
          metadata: { generated: true, next_due_date: p.next_due_date },
          scheduled_reminder_key: key,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scheduled_reminder_key" },
      )
      if (!error) upserted += 1
    }
  }

  const { data: quotes, error: qErr } = await supabase
    .from("org_quotes")
    .select("id, title, quote_number, customer_id, sent_at, status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("status", ["sent", "pending_approval"])
    .not("sent_at", "is", null)
    .lt("sent_at", sevenDaysAgo)

  if (!qErr && quotes?.length) {
    const ids = [...new Set(quotes.map((q) => q.customer_id as string))]
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", ids)
    const custName = new Map((custRows as { id: string; company_name: string }[] | null)?.map((c) => [c.id, c.company_name]) ?? [])

    for (const q of quotes as {
      id: string
      title: string
      quote_number: string
      customer_id: string
      sent_at: string
      status: string
    }) {
      const cn = custName.get(q.customer_id) ?? "Customer"
      const summary = `${q.quote_number} · ${cn} · Status ${q.status}`
      const key = `quote_followup:${q.id}`
      const { error } = await supabase.from("communication_events").upsert(
        {
          organization_id: organizationId,
          channel: "in_app",
          direction: "outbound",
          event_type: "quote_follow_up",
          title: `Quote follow-up: ${q.title?.trim() || q.quote_number}`,
          summary,
          audience: "organization",
          counts_toward_unread: true,
          delivery_status: "sent",
          recipient_kind: "customer",
          recipient_customer_id: q.customer_id,
          related_entity_type: "quote",
          related_entity_id: q.id,
          provider: "internal",
          metadata: { generated: true, quote_number: q.quote_number },
          scheduled_reminder_key: key,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scheduled_reminder_key" },
      )
      if (!error) upserted += 1
    }
  }

  const { data: invs, error: invErr } = await supabase
    .from("org_invoices")
    .select("id, title, invoice_number, customer_id, due_date, status, amount_cents")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("status", ["sent", "unpaid", "overdue"])
    .not("due_date", "is", null)
    .lt("due_date", today)

  if (!invErr && invs?.length) {
    const ids = [...new Set(invs.map((i) => i.customer_id as string))]
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", ids)
    const custName = new Map((custRows as { id: string; company_name: string }[] | null)?.map((c) => [c.id, c.company_name]) ?? [])

    for (const inv of invs as {
      id: string
      title: string
      invoice_number: string
      customer_id: string
      due_date: string
      status: string
      amount_cents?: number
    }) {
      const cn = custName.get(inv.customer_id) ?? "Customer"
      const summary = `${inv.invoice_number} was due ${inv.due_date} · ${cn}`
      const key = `invoice_reminder:${inv.id}`
      const { error } = await supabase.from("communication_events").upsert(
        {
          organization_id: organizationId,
          channel: "in_app",
          direction: "outbound",
          event_type: "invoice_reminder",
          title: `Invoice reminder: ${inv.title?.trim() || inv.invoice_number}`,
          summary,
          audience: "organization",
          counts_toward_unread: true,
          delivery_status: "sent",
          recipient_kind: "customer",
          recipient_customer_id: inv.customer_id,
          related_entity_type: "invoice",
          related_entity_id: inv.id,
          provider: "internal",
          metadata: { generated: true, due_date: inv.due_date },
          scheduled_reminder_key: key,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,scheduled_reminder_key" },
      )
      if (!error) upserted += 1
    }

    const admin = createServiceRoleClient()
    if (admin && invs.length > 0) {
      const slice = (
        invs as Array<{
          id: string
          title: string
          invoice_number: string
          customer_id: string
          due_date: string
          status: string
          amount_cents?: number
        }>
      ).slice(0, 20)
      for (const inv of slice) {
        void dispatchWorkflowTriggers({
          supabase: admin,
          organizationId,
          triggerType: "invoice_overdue",
          ctx: {
            organization_id: organizationId,
            trigger_type: "invoice_overdue",
            invoice: inv as unknown as Record<string, unknown>,
            today,
          },
          sourceType: "invoice",
          sourceId: inv.id,
        }).catch(() => {})
      }
    }
  }

  return { upserted }
}
