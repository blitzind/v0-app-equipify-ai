import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { insertOrgQuote } from "@/lib/org-quotes-invoices/repository"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { prospectHasResolvableAddress } from "@/lib/prospects/prospect-address"
import { optionalString } from "@/lib/prospects/server-helpers"
import { recordProspectStatusChange } from "@/lib/prospects/status-events"
import {
  PROSPECT_CONVERSION_TARGETS,
  type ProspectConversionTarget,
  type ProspectStatus,
} from "@/lib/prospects/types"

export function parseConversionTarget(raw: unknown): ProspectConversionTarget | "invalid" {
  if (raw === undefined || raw === null || raw === "") return "customer"
  if (typeof raw !== "string") return "invalid"
  const v = raw.trim().toLowerCase().replace(/-/g, "_")
  return PROSPECT_CONVERSION_TARGETS.includes(v as ProspectConversionTarget)
    ? (v as ProspectConversionTarget)
    : "invalid"
}

type ProspectRow = {
  id: string
  status: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  estimated_value_cents: number | null
  notes: string | null
  converted_customer_id: string | null
}

type Overrides = {
  company_name?: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

type LocationPayload = {
  name?: string
  address_line1?: string
  address_line2?: string | null
  city?: string
  state?: string
  postal_code?: string
  phone?: string | null
  contact_person?: string | null
  notes?: string | null
  is_default?: boolean
}

/** Prefer linking an existing customer (same contact email, or exact company name) before inserting a duplicate. */
async function findMatchingCustomerForProspect(args: {
  supabase: SupabaseClient
  organizationId: string
  prospect: ProspectRow
}): Promise<{ id: string; company_name: string } | null> {
  const { supabase, organizationId, prospect } = args
  const email = optionalString(prospect.contact_email, 200)?.toLowerCase().trim()
  if (email) {
    const { data: contacts } = await supabase
      .from("customer_contacts")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("email", email)
      .limit(40)
    const ids = [...new Set((contacts ?? []).map((c) => (c as { customer_id: string }).customer_id))]
    if (ids.length === 1) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .eq("id", ids[0])
        .is("archived_at", null)
        .maybeSingle()
      if (cust?.id) return cust as { id: string; company_name: string }
    }
  }

  const rawName = prospect.company_name.trim()
  if (!rawName) return null
  const norm = rawName.toLowerCase()
  const { data: custs } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .ilike("company_name", rawName)
    .limit(40)

  const exact = (custs ?? []).filter(
    (c) => (c as { company_name: string }).company_name.trim().toLowerCase() === norm,
  )
  if (exact.length === 1) return exact[0] as { id: string; company_name: string }
  return null
}

async function ensureCustomerForProspect(args: {
  supabase: SupabaseClient
  userId: string
  organizationId: string
  prospect: ProspectRow
  overrides: Overrides
}): Promise<
  | { ok: true; customerId: string; customerName: string; createdNew: boolean }
  | { ok: false; message: string; httpStatus: number; code: string }
> {
  const { supabase, userId, organizationId, prospect, overrides } = args

  if (prospect.converted_customer_id) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", prospect.converted_customer_id)
      .maybeSingle()
    if (existing?.id) {
      return {
        ok: true,
        customerId: existing.id as string,
        customerName: (existing as { company_name: string }).company_name,
        createdNew: false,
      }
    }
  }

  const matched = await findMatchingCustomerForProspect({ supabase, organizationId, prospect })
  if (matched) {
    return {
      ok: true,
      customerId: matched.id,
      customerName: matched.company_name,
      createdNew: false,
    }
  }

  const gate = await requireCanCreateRecord(supabase, userId, organizationId, "customer")
  if (!gate.ok) {
    return { ok: false, message: gate.message, httpStatus: gate.httpStatus, code: gate.code }
  }

  const company = optionalString(overrides.company_name, 200) ?? (prospect.company_name as string)
  const contactName = optionalString(overrides.contact_name, 200) ?? optionalString(prospect.contact_name, 200)
  const contactEmail = optionalString(overrides.contact_email, 200) ?? optionalString(prospect.contact_email, 200)
  const contactPhone = optionalString(overrides.contact_phone, 100) ?? optionalString(prospect.contact_phone, 100)

  const { data: customer, error: insertError } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      company_name: company,
      status: "active",
      created_by: userId,
    })
    .select("id, company_name")
    .single()

  if (insertError || !customer?.id) {
    return {
      ok: false,
      message: insertError?.message ?? "Could not create customer.",
      httpStatus: 500,
      code: "insert_failed",
    }
  }

  if (contactName || contactEmail || contactPhone) {
    const fullName = contactName ?? company
    const parts = fullName.split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? null
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null

    const { error: contactError } = await supabase.from("customer_contacts").insert({
      organization_id: organizationId,
      customer_id: customer.id,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      role: "Primary",
      email: contactEmail,
      phone: contactPhone,
      is_primary: true,
    })

    if (contactError) {
      await supabase.from("customers").delete().eq("id", customer.id).eq("organization_id", organizationId)
      return { ok: false, message: contactError.message, httpStatus: 500, code: "insert_failed" }
    }
  }

  return {
    ok: true,
    customerId: customer.id as string,
    customerName: (customer as { company_name: string }).company_name,
    createdNew: true,
  }
}

async function maybeCreateCustomerLocationFromProspect(args: {
  supabase: SupabaseClient
  organizationId: string
  customerId: string
  prospect: ProspectRow
  companyName: string
  userId: string
}): Promise<void> {
  const { supabase, organizationId, customerId, prospect, companyName, userId } = args
  if (!prospectHasResolvableAddress(prospect)) return

  const { count } = await supabase
    .from("customer_locations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)

  if ((count ?? 0) > 0) return

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return
  }

  const name = `${companyName.trim()} — Site`.slice(0, 200)
  const address = optionalString(prospect.address_line1, 400)
  const city = optionalString(prospect.city, 120)
  const state = optionalString(prospect.state, 80)
  const zip = optionalString(prospect.postal_code, 32)
  if (!address || !city || !state || !zip) return

  const row = {
    organization_id: organizationId,
    customer_id: customerId,
    name,
    address_line1: address,
    address_line2: optionalString(prospect.address_line2, 400),
    city,
    state,
    postal_code: zip,
    phone: optionalString(prospect.contact_phone, 64),
    contact_person: optionalString(prospect.contact_name, 200),
    notes: optionalString(prospect.notes, 4000),
    is_default: true,
    archived_at: null as string | null,
  }

  const { data: inserted, error } = await svc.from("customer_locations").insert(row).select("id").maybeSingle()
  if (error || !inserted?.id) return

  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "system",
    direction: "outbound",
    eventType: "prospect_location_added",
    title: `Service location added · ${name}`,
    summary: `Created a default customer location from prospect address for ${companyName}.`,
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "none",
    relatedEntityType: "customer",
    relatedEntityId: customerId,
    provider: "manual",
    metadata: { customer_location_id: inserted.id, customer_id: customerId, source: "prospect_convert" },
    sentAt: new Date().toISOString(),
    createdBy: userId,
  })
}

export async function runProspectConversion(args: {
  supabase: SupabaseClient
  userId: string
  organizationId: string
  prospectId: string
  target: ProspectConversionTarget
  overrides: Overrides
  location?: LocationPayload
}): Promise<
  | {
      ok: true
      customer_id: string
      customer_name: string
      converted_at?: string
      quote_id?: string
      work_order_id?: string
      equipment_id?: string
      location_id?: string
      org_task_id?: string
    }
  | { ok: false; message: string; httpStatus: number; code: string }
> {
  const { supabase, userId, organizationId, prospectId, target, overrides } = args

  const { data: prospect, error: lookupError } = await supabase
    .from("prospects")
    .select(
      "id, status, company_name, contact_name, contact_email, contact_phone, address_line1, address_line2, city, state, postal_code, country, estimated_value_cents, notes, converted_customer_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message, httpStatus: 500, code: "query_failed" }
  if (!prospect) return { ok: false, message: "Prospect not found.", httpStatus: 404, code: "not_found" }

  const p = prospect as ProspectRow

  if (target === "customer") {
    if (p.converted_customer_id) {
      return { ok: false, message: "Prospect has already been converted.", httpStatus: 409, code: "already_converted" }
    }
  }

  const company = optionalString(overrides.company_name, 200) ?? p.company_name

  // ─── Customer-only (won) — preserves Phase 1 semantics ───────────────────
  if (target === "customer") {
    const gate = await requireCanCreateRecord(supabase, userId, organizationId, "customer")
    if (!gate.ok) {
      return { ok: false, message: gate.message, httpStatus: gate.httpStatus, code: gate.code }
    }

    const ensured = await ensureCustomerForProspect({ supabase, userId, organizationId, prospect: p, overrides })
    if (!ensured.ok) return ensured

    const convertedAt = new Date().toISOString()
    const { error: stampError } = await supabase
      .from("prospects")
      .update({
        converted_customer_id: ensured.customerId,
        converted_at: convertedAt,
        status: "won",
      })
      .eq("organization_id", organizationId)
      .eq("id", prospectId)

    if (stampError) {
      return { ok: false, message: stampError.message, httpStatus: 500, code: "update_failed" }
    }

    await maybeCreateCustomerLocationFromProspect({
      supabase,
      organizationId,
      customerId: ensured.customerId,
      prospect: p,
      companyName: company,
      userId,
    })

    if (p.status !== "won") {
      await recordProspectStatusChange({
        supabase,
        organizationId,
        prospectId,
        companyName: company,
        previousStatus: p.status as ProspectStatus,
        nextStatus: "won",
        reason: "converted_to_customer",
        actorUserId: userId,
        extraMetadata: { converted_customer_id: ensured.customerId },
      })
    }

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_converted",
      title: `Prospect converted to customer · ${company}`,
      summary: `Prospect "${p.company_name}" was converted to a customer.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "customer",
      relatedEntityId: ensured.customerId,
      provider: "manual",
      metadata: { prospect_id: prospectId, converted_at: convertedAt },
      sentAt: convertedAt,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      converted_at: convertedAt,
    }
  }

  // ─── All other targets require a linked customer record ──────────────────
  const ensured = await ensureCustomerForProspect({ supabase, userId, organizationId, prospect: p, overrides })
  if (!ensured.ok) return ensured

  const stampLinkage: Record<string, unknown> = {
    converted_customer_id: ensured.customerId,
  }

  const nowIso = new Date().toISOString()

  if (target === "opportunity") {
    const taskGate = await requireCanCreateRecord(supabase, userId, organizationId, "org_task")
    if (!taskGate.ok) {
      return { ok: false, message: taskGate.message, httpStatus: taskGate.httpStatus, code: taskGate.code }
    }

    const { data: task, error: taskErr } = await supabase
      .from("org_tasks")
      .insert({
        organization_id: organizationId,
        title: `Sales opportunity · ${company}`,
        description: optionalString(p.notes, 4000) ?? `Tracked from prospect pipeline for ${company}.`,
        source_type: "prospect",
        source_id: prospectId,
        status: "open",
      })
      .select("id")
      .maybeSingle()

    if (taskErr || !task?.id) {
      return { ok: false, message: taskErr?.message ?? "Could not create task.", httpStatus: 500, code: "insert_failed" }
    }

    const prevStatus = p.status as ProspectStatus
    if (prevStatus !== "qualified") {
      await supabase
        .from("prospects")
        .update({ ...stampLinkage, status: "qualified" })
        .eq("organization_id", organizationId)
        .eq("id", prospectId)

      await recordProspectStatusChange({
        supabase,
        organizationId,
        prospectId,
        companyName: company,
        previousStatus: prevStatus,
        nextStatus: "qualified",
        reason: "conversion_opportunity",
        actorUserId: userId,
        extraMetadata: { org_task_id: task.id },
      })
    } else {
      await supabase.from("prospects").update({ ...stampLinkage }).eq("organization_id", organizationId).eq("id", prospectId)
    }

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_opportunity_tracked",
      title: `Opportunity tracked · ${company}`,
      summary: `Created an internal follow-up task from this prospect.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { org_task_id: task.id, customer_id: ensured.customerId },
      sentAt: nowIso,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      org_task_id: task.id as string,
    }
  }

  if (target === "customer_location") {
    const loc = args.location ?? {}
    const name = typeof loc.name === "string" ? loc.name.trim() : ""
    const address = typeof loc.address_line1 === "string" ? loc.address_line1.trim() : ""
    const city = typeof loc.city === "string" ? loc.city.trim() : ""
    const state = typeof loc.state === "string" ? loc.state.trim() : ""
    const zip = typeof loc.postal_code === "string" ? loc.postal_code.trim() : ""
    if (!name || !address || !city || !state || !zip) {
      return {
        ok: false,
        message: "Location requires name, street address, city, state, and postal code.",
        httpStatus: 400,
        code: "bad_request",
      }
    }

    let svc
    try {
      svc = createServiceRoleSupabaseClient()
    } catch {
      return { ok: false, message: "Server configuration error.", httpStatus: 503, code: "service_unavailable" }
    }

    const isDefault = Boolean(loc.is_default)
    const row = {
      organization_id: organizationId,
      customer_id: ensured.customerId,
      name,
      address_line1: address,
      address_line2:
        typeof loc.address_line2 === "string" && loc.address_line2.trim() ? loc.address_line2.trim() : null,
      city,
      state,
      postal_code: zip,
      phone:
        typeof loc.phone === "string" && loc.phone.trim() ? loc.phone.trim().slice(0, 64) : null,
      contact_person:
        typeof loc.contact_person === "string" && loc.contact_person.trim()
          ? loc.contact_person.trim().slice(0, 200)
          : null,
      notes:
        typeof loc.notes === "string" && loc.notes.trim() ? loc.notes.trim() : null,
      is_default: isDefault,
      archived_at: null as string | null,
    }

    const { data: inserted, error: insErr } = await svc.from("customer_locations").insert(row).select("id").maybeSingle()

    if (insErr || !inserted?.id) {
      return { ok: false, message: insErr?.message ?? "Could not create location.", httpStatus: 500, code: "insert_failed" }
    }

    const prevStatus = p.status as ProspectStatus
    await supabase
      .from("prospects")
      .update({ ...stampLinkage, status: prevStatus === "won" ? prevStatus : "contacted" })
      .eq("organization_id", organizationId)
      .eq("id", prospectId)

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_location_added",
      title: `Service location added · ${name}`,
      summary: `Created a customer location from prospect ${company}.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { customer_location_id: inserted.id, customer_id: ensured.customerId },
      sentAt: nowIso,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      location_id: inserted.id as string,
    }
  }

  if (target === "equipment") {
    const eqGate = await requireCanCreateRecord(supabase, userId, organizationId, "equipment")
    if (!eqGate.ok) {
      return { ok: false, message: eqGate.message, httpStatus: eqGate.httpStatus, code: eqGate.code }
    }

    const { data: eq, error: eqErr } = await supabase
      .from("equipment")
      .insert({
        organization_id: organizationId,
        customer_id: ensured.customerId,
        name: `${company} — Equipment`,
        category: "General",
        notes: optionalString(p.notes, 4000),
        created_by: userId,
      })
      .select("id")
      .maybeSingle()

    if (eqErr || !eq?.id) {
      return { ok: false, message: eqErr?.message ?? "Could not create equipment.", httpStatus: 500, code: "insert_failed" }
    }

    const prevStatus = p.status as ProspectStatus
    const nextStatus: ProspectStatus = prevStatus === "won" ? "won" : "qualified"
    await supabase
      .from("prospects")
      .update({ ...stampLinkage, status: nextStatus })
      .eq("organization_id", organizationId)
      .eq("id", prospectId)

    if (prevStatus !== nextStatus) {
      await recordProspectStatusChange({
        supabase,
        organizationId,
        prospectId,
        companyName: company,
        previousStatus: prevStatus,
        nextStatus,
        reason: "conversion_equipment",
        actorUserId: userId,
        extraMetadata: { equipment_id: eq.id },
      })
    }

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_equipment_created",
      title: `Equipment record started · ${company}`,
      summary: `Created an equipment asset under the linked customer.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { equipment_id: eq.id, customer_id: ensured.customerId },
      sentAt: nowIso,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      equipment_id: eq.id as string,
    }
  }

  if (target === "quote") {
    const qGate = await requireCanCreateRecord(supabase, userId, organizationId, "quote")
    if (!qGate.ok) {
      return { ok: false, message: qGate.message, httpStatus: qGate.httpStatus, code: qGate.code }
    }

    const exp = new Date()
    exp.setUTCDate(exp.getUTCDate() + 30)
    const expiresAt = exp.toISOString().slice(0, 10)
    const amount = Math.max(0, Number(p.estimated_value_cents ?? 0))

    const quoteRes = await insertOrgQuote(supabase, {
      organizationId,
      customerId: ensured.customerId,
      equipmentId: null,
      workOrderId: null,
      title: `Quote · ${company}`,
      amountCents: amount,
      status: "Draft",
      expiresAt,
      lineItems:
        amount > 0
          ? [
              {
                description: "Estimated scope (from prospect)",
                qty: 1,
                unit: amount,
              },
            ]
          : [],
      notes: `Draft created from prospect pipeline for ${company}.`,
      internalNotes: null,
      sentAt: null,
    })

    if (quoteRes.error || !quoteRes.id) {
      return { ok: false, message: quoteRes.error ?? "Could not create quote.", httpStatus: 500, code: "insert_failed" }
    }

    const prevStatus = p.status as ProspectStatus
    const nextStatus: ProspectStatus = "proposal_sent"
    await supabase
      .from("prospects")
      .update({ ...stampLinkage, status: nextStatus })
      .eq("organization_id", organizationId)
      .eq("id", prospectId)

    if (prevStatus !== nextStatus) {
      await recordProspectStatusChange({
        supabase,
        organizationId,
        prospectId,
        companyName: company,
        previousStatus: prevStatus,
        nextStatus,
        reason: "conversion_quote",
        actorUserId: userId,
        extraMetadata: { quote_id: quoteRes.id },
      })
    }

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_quote_created",
      title: `Draft quote created · ${company}`,
      summary: `Linked to customer ${ensured.customerName}.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { quote_id: quoteRes.id, customer_id: ensured.customerId },
      sentAt: nowIso,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      quote_id: quoteRes.id,
    }
  }

  if (target === "work_order") {
    const woGate = await requireCanCreateRecord(supabase, userId, organizationId, "work_order")
    if (!woGate.ok) {
      return { ok: false, message: woGate.message, httpStatus: woGate.httpStatus, code: woGate.code }
    }

    const { data: wo, error: woErr } = await supabase
      .from("work_orders")
      .insert({
        organization_id: organizationId,
        customer_id: ensured.customerId,
        equipment_id: null,
        title: `${company} — Service`,
        status: "open",
        priority: "normal",
        type: "repair",
        notes: optionalString(p.notes, 4000),
        created_by: userId,
      })
      .select("id")
      .maybeSingle()

    if (woErr || !wo?.id) {
      return { ok: false, message: woErr?.message ?? "Could not create work order.", httpStatus: 500, code: "insert_failed" }
    }

    const prevStatus = p.status as ProspectStatus
    const nextStatus: ProspectStatus = prevStatus === "won" ? "won" : "proposal_sent"
    await supabase
      .from("prospects")
      .update({ ...stampLinkage, status: nextStatus })
      .eq("organization_id", organizationId)
      .eq("id", prospectId)

    if (prevStatus !== nextStatus) {
      await recordProspectStatusChange({
        supabase,
        organizationId,
        prospectId,
        companyName: company,
        previousStatus: prevStatus,
        nextStatus,
        reason: "conversion_work_order",
        actorUserId: userId,
        extraMetadata: { work_order_id: wo.id },
      })
    }

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_work_order_created",
      title: `Work order started · ${company}`,
      summary: `Created an open work order under the linked customer.`,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { work_order_id: wo.id, customer_id: ensured.customerId },
      sentAt: nowIso,
      createdBy: userId,
    })

    return {
      ok: true,
      customer_id: ensured.customerId,
      customer_name: ensured.customerName,
      work_order_id: wo.id as string,
    }
  }

  return { ok: false, message: "Unsupported conversion target.", httpStatus: 400, code: "bad_request" }
}
