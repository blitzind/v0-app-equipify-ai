import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { optionalString } from "@/lib/prospects/server-helpers"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * POST /api/organizations/{org}/prospects/{prospectId}/convert
 *
 * Promotes a prospect to a customer:
 *   1. Validates the prospect belongs to the org and has not already
 *      been converted.
 *   2. Runs the standard create-customer billing/plan gate so plan limits
 *      are honoured the same way the in-app modal does.
 *   3. Inserts a `customers` row + (optional) primary `customer_contacts`.
 *      Stays on the existing customer architecture — no new tables.
 *   4. Stamps the prospect with `converted_customer_id`, `converted_at`,
 *      sets status to `won`, and preserves all pre-conversion notes /
 *      pipeline history.
 *   5. Logs a single `communication_events` row tied to the *customer*
 *      (`related_entity_type='customer'`) and a metadata pointer back to
 *      the originating prospect for forward traceability.
 *
 * Gated by `canManageProspects`. Body fields are optional overrides for
 * the customer/contact insert; otherwise the server uses the prospect's
 * own data.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

  let body: {
    company_name?: string
    contact_name?: string | null
    contact_email?: string | null
    contact_phone?: string | null
  }
  try {
    body = (await request.json().catch(() => ({}))) as typeof body
  } catch {
    body = {}
  }

  const { data: prospect, error: lookupError } = await supabase
    .from("prospects")
    .select(
      "id, status, company_name, contact_name, contact_email, contact_phone, converted_customer_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()

  if (lookupError) return jsonError(lookupError.message, 500, "query_failed")
  if (!prospect) return jsonError("Prospect not found.", 404, "not_found")

  if (prospect.converted_customer_id) {
    return jsonError("Prospect has already been converted.", 409, "already_converted")
  }

  // Plan / billing gate — mirrors what AddCustomerModal calls client-side.
  const billingGate = await requireCanCreateRecord(supabase, userId, organizationId, "customer")
  if (!billingGate.ok) {
    return NextResponse.json(
      { error: billingGate.code, message: billingGate.message },
      { status: billingGate.httpStatus },
    )
  }

  const overrideCompany = optionalString(body.company_name, 200)
  const overrideContactName = optionalString(body.contact_name, 200)
  const overrideEmail = optionalString(body.contact_email, 200)
  const overridePhone = optionalString(body.contact_phone, 100)

  const company = overrideCompany ?? (prospect.company_name as string)
  const contactName = overrideContactName ?? optionalString(prospect.contact_name, 200)
  const contactEmail = overrideEmail ?? optionalString(prospect.contact_email, 200)
  const contactPhone = overridePhone ?? optionalString(prospect.contact_phone, 100)

  // 1. Insert the customer.
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
    return jsonError(insertError?.message ?? "Could not create customer.", 500, "insert_failed")
  }

  // 2. Optional primary contact.
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
      // Roll back the customer if the contact insert fails so we don't leave
      // an orphan record. Mirrors what AddCustomerModal does on the client.
      await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id)
        .eq("organization_id", organizationId)
      return jsonError(contactError.message, 500, "insert_failed")
    }
  }

  // 3. Stamp the prospect as converted.
  const convertedAt = new Date().toISOString()
  const { error: stampError } = await supabase
    .from("prospects")
    .update({
      converted_customer_id: customer.id,
      converted_at: convertedAt,
      status: "won",
    })
    .eq("organization_id", organizationId)
    .eq("id", prospectId)

  if (stampError) {
    // Customer is already created; surface the error but leave the
    // customer in place (the user can manually reconcile from the UI).
    return jsonError(stampError.message, 500, "update_failed")
  }

  // 4. Log a single conversion event on the customer timeline.
  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "system",
    direction: "outbound",
    eventType: "prospect_converted",
    title: `Prospect converted to customer · ${company}`,
    summary: `Prospect "${prospect.company_name as string}" was converted to a customer.`,
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "none",
    relatedEntityType: "customer",
    relatedEntityId: customer.id,
    provider: "manual",
    metadata: {
      prospect_id: prospectId,
      converted_at: convertedAt,
    },
    sentAt: convertedAt,
    createdBy: userId,
  })

  return NextResponse.json({
    ok: true,
    customer_id: customer.id,
    customer_name: customer.company_name,
    converted_at: convertedAt,
  })
}
