import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { optionalString } from "@/lib/prospects/server-helpers"
import { parseConversionTarget, runProspectConversion } from "@/lib/prospects/run-conversion"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * POST /api/organizations/{org}/prospects/{prospectId}/convert
 *
 * Promotes a prospect along multiple operational paths. `conversion_target`
 * selects the destination (default: customer). All paths share a single linked
 * customer record on the prospect once created — duplicate customer rows are
 * avoided by reusing `converted_customer_id`.
 *
 * Targets:
 *   - customer — Phase 1 behaviour (customer + contact, prospect → won)
 *   - quote — draft org_quote + proposal_sent
 *   - work_order — open WO + linked customer
 *   - equipment — asset stub under customer
 *   - customer_location — site row (requires `location` in body)
 *   - opportunity — internal org_tasks follow-up + qualified status
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

  let body: Record<string, unknown>
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    body = {}
  }

  const target = parseConversionTarget(body.conversion_target)
  if (target === "invalid") return jsonError("Invalid conversion_target.", 400)

  const overrides = {
    company_name: typeof body.company_name === "string" ? body.company_name : undefined,
    contact_name: typeof body.contact_name === "string" ? body.contact_name : undefined,
    contact_email: typeof body.contact_email === "string" ? body.contact_email : undefined,
    contact_phone: typeof body.contact_phone === "string" ? body.contact_phone : undefined,
  }

  const rawLoc = body.location
  const location =
    rawLoc && typeof rawLoc === "object"
      ? {
          name: optionalString((rawLoc as Record<string, unknown>).name, 200) ?? undefined,
          address_line1: optionalString((rawLoc as Record<string, unknown>).address_line1, 400) ?? undefined,
          address_line2: optionalString((rawLoc as Record<string, unknown>).address_line2, 400),
          city: optionalString((rawLoc as Record<string, unknown>).city, 120) ?? undefined,
          state: optionalString((rawLoc as Record<string, unknown>).state, 80) ?? undefined,
          postal_code: optionalString((rawLoc as Record<string, unknown>).postal_code, 32) ?? undefined,
          phone: optionalString((rawLoc as Record<string, unknown>).phone, 64),
          contact_person: optionalString((rawLoc as Record<string, unknown>).contact_person, 200),
          notes: optionalString((rawLoc as Record<string, unknown>).notes, 4000),
          is_default: Boolean((rawLoc as Record<string, unknown>).is_default),
        }
      : undefined

  const result = await runProspectConversion({
    supabase,
    userId,
    organizationId,
    prospectId,
    target,
    overrides,
    location,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.httpStatus },
    )
  }

  return NextResponse.json({
    ok: true,
    conversion_target: target,
    customer_id: result.customer_id,
    customer_name: result.customer_name,
    converted_at: result.converted_at,
    quote_id: result.quote_id,
    work_order_id: result.work_order_id,
    equipment_id: result.equipment_id,
    location_id: result.location_id,
    org_task_id: result.org_task_id,
  })
}
