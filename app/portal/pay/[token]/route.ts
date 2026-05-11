import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { resolveBlitzpayPaymentLinkToken } from "@/lib/blitzpay/blitzpay-collections"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const tokenRaw = String(token ?? "").trim()
  if (!tokenRaw) {
    return NextResponse.redirect(new URL("/portal/login?error=invalid_payment_link", request.url))
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.redirect(new URL("/portal/login?error=payment_link_unavailable", request.url))
  }
  const resolved = await resolveBlitzpayPaymentLinkToken(admin, tokenRaw)
  if (!resolved.ok) {
    return NextResponse.redirect(new URL("/portal/login?error=invalid_payment_link", request.url))
  }
  const path =
    resolved.kind === "invoice"
      ? `/portal/invoices/${encodeURIComponent(resolved.invoiceId)}`
      : `/portal/quotes/${encodeURIComponent(resolved.quoteId)}`
  const target = new URL(path, request.url)
  target.searchParams.set("blitzpay_link", "1")
  return NextResponse.redirect(target)
}
