import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireOrganizationMember } from "@/lib/email/route-auth"
import { triggerQuickBooksInvoiceAutoSyncIfEnabled } from "@/lib/integrations/quickbooks/invoice-auto-sync"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { invoiceId?: string }
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "invalid_invoice" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "No access to this organization." }, { status: 403 })
  }

  const { data: inv } = await supabase
    .from("org_invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!inv) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  await triggerQuickBooksInvoiceAutoSyncIfEnabled({ organizationId, invoiceId })

  return NextResponse.json({ ok: true })
}
