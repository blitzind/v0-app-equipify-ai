/**
 * EC-6 — isolated revenue path fixtures for production certification.
 * Idempotent provision via service-role Supabase (cert org only).
 */

import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertOrgInvoice, insertOrgQuote } from "@/lib/org-quotes-invoices/repository"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import { sha256Hex } from "@/lib/portal/token-hash"

export const EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER = "equipify-core-revenue-fixtures-ec-6-v1" as const

/** Default cert org from EC-2/EC-4 read-safe sampling. Override via EQUIPIFY_CORE_CERT_ORGANIZATION_ID. */
export const EQUIPIFY_CORE_DEFAULT_CERT_ORGANIZATION_ID = "fc7e7631-efb8-4e14-9db2-5c4cadfb74f0"

export const EC_FIXTURE_CUSTOMER_COMPANY_NAME = "EC Test Customer" as const
export const EC_FIXTURE_CUSTOMER_EXTERNAL_CODE = "EC-CERT-CUSTOMER-V1" as const
export const EC_FIXTURE_CUSTOMER_EMAIL = "ec-revenue-cert-fixtures@equipify.test" as const
export const EC_FIXTURE_CUSTOMER_PHONE = "(555) 010-0006" as const

export const EC_FIXTURE_QUOTE_SEED_KEY = "ec-cert-quote-v1" as const
export const EC_FIXTURE_QUOTE_TITLE = "EC Test Quote" as const
export const EC_FIXTURE_QUOTE_NUMBER = "EC-Q-CERT-001" as const

export const EC_FIXTURE_INVOICE_SEED_KEY = "ec-cert-invoice-v1" as const
export const EC_FIXTURE_INVOICE_TITLE = "EC Test Invoice" as const
export const EC_FIXTURE_INVOICE_NUMBER = "EC-INV-CERT-001" as const

export type RevenueFixtureIds = {
  organization_id: string
  customer_id: string
  customer_name: string
  customer_email: string
  quote_id: string | null
  quote_number: string | null
  quote_status: string | null
  quote_total_cents: number | null
  invoice_id: string | null
  invoice_number: string | null
  invoice_status: string | null
  invoice_total_cents: number | null
  portal_user_id: string | null
  portal_access_token: string | null
}

const EC_QUOTE_LINE_ITEMS: LineItemJson[] = [
  { description: "EC Cert — calibration service", qty: 1, unit: 150 },
  { description: "EC Cert — travel & setup", qty: 1, unit: 50 },
]

const EC_INVOICE_LINE_ITEMS: LineItemJson[] = [
  { description: "EC Cert — field service labor", qty: 2, unit: 75 },
  { description: "EC Cert — parts & materials", qty: 1, unit: 100 },
]

function quoteLineTotalCents(items: LineItemJson[]): number {
  return Math.round(items.reduce((s, li) => s + li.qty * li.unit, 0) * 100)
}

function expiresAtYmd(daysFromNow: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

function issuedTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function verifyCertOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: boolean; detail: string; plan_id?: string; subscription_status?: string }> {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, status")
    .eq("id", organizationId)
    .maybeSingle()
  if (orgErr || !org) {
    return { ok: false, detail: `Organization not found: ${organizationId}` }
  }
  if ((org as { status?: string }).status === "archived") {
    return { ok: false, detail: "Cert organization is archived." }
  }

  const { data: sub, error: subErr } = await admin
    .from("organization_subscriptions")
    .select("plan_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (subErr) {
    return { ok: false, detail: `Subscription read failed: ${subErr.message}` }
  }
  if (!sub) {
    return { ok: false, detail: "No organization_subscriptions row for cert org." }
  }
  const status = String((sub as { status?: string }).status ?? "")
  if (!["active", "trialing"].includes(status)) {
    return { ok: false, detail: `Cert org subscription not active (status=${status}).` }
  }

  return {
    ok: true,
    detail: `Cert org ${(org as { name?: string }).name ?? organizationId} subscription ${status}.`,
    plan_id: (sub as { plan_id?: string }).plan_id,
    subscription_status: status,
  }
}

async function locateOrCreateCustomer(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ customer_id: string; created: boolean }> {
  const { data: byCode } = await admin
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .eq("external_code", EC_FIXTURE_CUSTOMER_EXTERNAL_CODE)
    .is("archived_at", null)
    .maybeSingle()
  if (byCode?.id) {
    return { customer_id: byCode.id, created: false }
  }

  const { data: byName } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_name", EC_FIXTURE_CUSTOMER_COMPANY_NAME)
    .is("archived_at", null)
    .maybeSingle()
  if (byName?.id) {
    return { customer_id: byName.id, created: false }
  }

  const { data: inserted, error } = await admin
    .from("customers")
    .insert({
      organization_id: organizationId,
      external_code: EC_FIXTURE_CUSTOMER_EXTERNAL_CODE,
      company_name: EC_FIXTURE_CUSTOMER_COMPANY_NAME,
      status: "active",
    })
    .select("id")
    .single()
  if (error || !inserted?.id) {
    throw new Error(`Could not create EC Test Customer: ${error?.message ?? "unknown"}`)
  }

  const customerId = inserted.id as string

  const { data: locExisting } = await admin
    .from("customer_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .limit(1)
  if (!locExisting?.length) {
    await admin.from("customer_locations").insert({
      organization_id: organizationId,
      customer_id: customerId,
      name: "EC Cert — primary",
      address_line1: "100 Certification Lane",
      city: "Columbus",
      state: "OH",
      postal_code: "43215",
      is_default: true,
    })
  }

  const { data: contactExisting } = await admin
    .from("customer_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("email", EC_FIXTURE_CUSTOMER_EMAIL)
    .limit(1)
  if (!contactExisting?.length) {
    await admin.from("customer_contacts").insert({
      organization_id: organizationId,
      customer_id: customerId,
      full_name: "EC Cert Contact",
      role: "Billing",
      email: EC_FIXTURE_CUSTOMER_EMAIL,
      phone: EC_FIXTURE_CUSTOMER_PHONE,
      is_primary: true,
    })
  }

  return { customer_id: customerId, created: true }
}

async function locateOrCreateQuote(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ quote_id: string; created: boolean }> {
  const { data: existing } = await admin
    .from("org_quotes")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("seed_key", EC_FIXTURE_QUOTE_SEED_KEY)
    .maybeSingle()

  const amountCents = quoteLineTotalCents(EC_QUOTE_LINE_ITEMS)
  const expiresAt = expiresAtYmd(90)

  if (existing?.id) {
    await admin
      .from("org_quotes")
      .update({
        status: "sent",
        title: EC_FIXTURE_QUOTE_TITLE,
        amount_cents: amountCents,
        line_items: EC_QUOTE_LINE_ITEMS,
        expires_at: expiresAt,
        customer_id: customerId,
        archived_at: null,
      })
      .eq("organization_id", organizationId)
      .eq("id", existing.id)
    return { quote_id: existing.id as string, created: false }
  }

  const { error: insErr } = await admin.from("org_quotes").insert({
    organization_id: organizationId,
    customer_id: customerId,
    seed_key: EC_FIXTURE_QUOTE_SEED_KEY,
    quote_number: EC_FIXTURE_QUOTE_NUMBER,
    title: EC_FIXTURE_QUOTE_TITLE,
    amount_cents: amountCents,
    status: "sent",
    expires_at: expiresAt,
    line_items: EC_QUOTE_LINE_ITEMS,
    notes: "EC-6 revenue certification fixture — do not use for production customers.",
  })
  if (insErr) {
    const viaRepo = await insertOrgQuote(admin, {
      organizationId,
      customerId,
      equipmentId: null,
      workOrderId: null,
      title: EC_FIXTURE_QUOTE_TITLE,
      amountCents,
      status: "Sent",
      expiresAt,
      lineItems: EC_QUOTE_LINE_ITEMS,
      notes: "EC-6 revenue certification fixture.",
      internalNotes: null,
      sentAt: null,
    })
    if (!viaRepo.id) throw new Error(`Quote insert failed: ${insErr.message} / ${viaRepo.error}`)
    await admin
      .from("org_quotes")
      .update({ seed_key: EC_FIXTURE_QUOTE_SEED_KEY, quote_number: EC_FIXTURE_QUOTE_NUMBER })
      .eq("id", viaRepo.id)
    return { quote_id: viaRepo.id, created: true }
  }

  const { data: row } = await admin
    .from("org_quotes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("seed_key", EC_FIXTURE_QUOTE_SEED_KEY)
    .maybeSingle()
  if (!row?.id) throw new Error("Quote insert succeeded but row not found.")
  return { quote_id: row.id as string, created: true }
}

async function locateOrCreateInvoice(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ invoice_id: string; created: boolean }> {
  const amountCents = quoteLineTotalCents(EC_INVOICE_LINE_ITEMS)
  const issuedAt = issuedTodayYmd()
  const dueDate = expiresAtYmd(30)

  const { data: existing } = await admin
    .from("org_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("seed_key", EC_FIXTURE_INVOICE_SEED_KEY)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from("org_invoices")
      .update({
        status: "sent",
        title: EC_FIXTURE_INVOICE_TITLE,
        amount_cents: amountCents,
        line_items: EC_INVOICE_LINE_ITEMS,
        issued_at: issuedAt,
        due_date: dueDate,
        paid_at: null,
        customer_id: customerId,
        archived_at: null,
      })
      .eq("organization_id", organizationId)
      .eq("id", existing.id)
    return { invoice_id: existing.id as string, created: false }
  }

  const viaRepo = await insertOrgInvoice(
    admin,
    {
      organizationId,
      customerId,
      equipmentId: null,
      workOrderId: null,
      quoteId: null,
      calibrationRecordId: null,
      title: EC_FIXTURE_INVOICE_TITLE,
      amountCents,
      status: "Sent",
      issuedAt,
      dueDate,
      paidAt: null,
      lineItems: EC_INVOICE_LINE_ITEMS,
      notes: "EC-6 revenue certification fixture — unpaid test invoice.",
      internalNotes: null,
    },
    { skipQuickBooksQueue: true, skipWorkOrderBillingStateSync: true },
  )
  if (!viaRepo.id) {
    const { error: insErr } = await admin.from("org_invoices").insert({
      organization_id: organizationId,
      customer_id: customerId,
      seed_key: EC_FIXTURE_INVOICE_SEED_KEY,
      invoice_number: EC_FIXTURE_INVOICE_NUMBER,
      title: EC_FIXTURE_INVOICE_TITLE,
      amount_cents: amountCents,
      status: "sent",
      issued_at: issuedAt,
      due_date: dueDate,
      line_items: EC_INVOICE_LINE_ITEMS,
    })
    if (insErr) throw new Error(`Invoice insert failed: ${viaRepo.error ?? insErr.message}`)
    const { data: row } = await admin
      .from("org_invoices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("seed_key", EC_FIXTURE_INVOICE_SEED_KEY)
      .maybeSingle()
    if (!row?.id) throw new Error("Invoice row missing after insert.")
    return { invoice_id: row.id as string, created: true }
  }

  await admin
    .from("org_invoices")
    .update({
      seed_key: EC_FIXTURE_INVOICE_SEED_KEY,
      invoice_number: EC_FIXTURE_INVOICE_NUMBER,
    })
    .eq("id", viaRepo.id)

  return { invoice_id: viaRepo.id, created: true }
}

export async function provisionPortalAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
  email: string = EC_FIXTURE_CUSTOMER_EMAIL,
): Promise<{ portal_user_id: string; portal_access_token: string; created_link: boolean }> {
  const { data: existingPu } = await admin
    .from("portal_users")
    .select("id, status, customer_id")
    .eq("organization_id", organizationId)
    .eq("email", email.toLowerCase())
    .maybeSingle()

  let portalUserId = existingPu?.id as string | undefined
  const nowIso = new Date().toISOString()

  if (!portalUserId) {
    const { data: inserted, error } = await admin
      .from("portal_users")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        email: email.toLowerCase(),
        display_name: "EC Cert Portal User",
        status: "active",
        invited_at: nowIso,
        activated_at: nowIso,
      })
      .select("id")
      .single()
    if (error || !inserted?.id) {
      throw new Error(`portal_users insert failed: ${error?.message ?? "unknown"}`)
    }
    portalUserId = inserted.id as string
  } else {
    await admin
      .from("portal_users")
      .update({
        customer_id: customerId,
        status: (existingPu as { status?: string }).status === "revoked" ? "active" : undefined,
        display_name: "EC Cert Portal User",
      })
      .eq("id", portalUserId)
      .eq("organization_id", organizationId)
  }

  const rawToken = Buffer.from(randomBytes(32)).toString("base64url")
  const tokenHash = sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const { error: linkErr } = await admin.from("portal_access_links").insert({
    organization_id: organizationId,
    portal_user_id: portalUserId,
    token_hash: tokenHash,
    kind: "invite",
    expires_at: expiresAt,
    max_uses: 10,
    use_count: 0,
  })
  if (linkErr) {
    throw new Error(`portal_access_links insert failed: ${linkErr.message}`)
  }

  return {
    portal_user_id: portalUserId,
    portal_access_token: rawToken,
    created_link: true,
  }
}

export async function loadRevenueFixtureSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  ids: Partial<RevenueFixtureIds>,
): Promise<RevenueFixtureIds> {
  const customerId = ids.customer_id ?? ""
  let customerName = ids.customer_name ?? EC_FIXTURE_CUSTOMER_COMPANY_NAME
  const customerEmail = ids.customer_email ?? EC_FIXTURE_CUSTOMER_EMAIL

  if (customerId) {
    const { data: cust } = await admin
      .from("customers")
      .select("company_name")
      .eq("id", customerId)
      .maybeSingle()
    if (cust?.company_name) customerName = cust.company_name as string
  }

  async function readQuote(quoteId: string | null | undefined) {
    if (!quoteId) return null
    const { data } = await admin
      .from("org_quotes")
      .select("id, quote_number, status, amount_cents, tax_amount_cents")
      .eq("organization_id", organizationId)
      .eq("id", quoteId)
      .maybeSingle()
    return data as {
      id: string
      quote_number: string
      status: string
      amount_cents: number
      tax_amount_cents?: number | null
    } | null
  }

  async function readInvoice(invoiceId: string | null | undefined) {
    if (!invoiceId) return null
    const { data } = await admin
      .from("org_invoices")
      .select("id, invoice_number, status, amount_cents, tax_amount_cents")
      .eq("organization_id", organizationId)
      .eq("id", invoiceId)
      .maybeSingle()
    return data as {
      id: string
      invoice_number: string
      status: string
      amount_cents: number
      tax_amount_cents?: number | null
    } | null
  }

  const quote = await readQuote(ids.quote_id)
  const invoice = await readInvoice(ids.invoice_id)

  return {
    organization_id: organizationId,
    customer_id: customerId,
    customer_name: customerName,
    customer_email: customerEmail,
    quote_id: quote?.id ?? ids.quote_id ?? null,
    quote_number: quote?.quote_number ?? null,
    quote_status: quote?.status ?? null,
    quote_total_cents: quote
      ? Math.round(Number(quote.amount_cents) + Number(quote.tax_amount_cents ?? 0))
      : null,
    invoice_id: invoice?.id ?? ids.invoice_id ?? null,
    invoice_number: invoice?.invoice_number ?? null,
    invoice_status: invoice?.status ?? null,
    invoice_total_cents: invoice
      ? Math.round(Number(invoice.amount_cents) + Number(invoice.tax_amount_cents ?? 0))
      : null,
    portal_user_id: ids.portal_user_id ?? null,
    portal_access_token: ids.portal_access_token ?? null,
  }
}

export type ProvisionRevenueFixturesResult = {
  qa_marker: typeof EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER
  ok: boolean
  organization_id: string
  org_verification: { ok: boolean; detail: string; plan_id?: string }
  fixtures: RevenueFixtureIds
  created: { customer: boolean; quote: boolean; invoice: boolean; portal_link: boolean }
  executed_at: string
}

export async function provisionEquipifyCoreRevenueFixtures(
  admin: SupabaseClient,
  organizationId: string,
  options?: { skipPortalToken?: boolean },
): Promise<ProvisionRevenueFixturesResult> {
  const executed_at = new Date().toISOString()
  const orgVerification = await verifyCertOrganization(admin, organizationId)
  if (!orgVerification.ok) {
    return {
      qa_marker: EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER,
      ok: false,
      organization_id: organizationId,
      org_verification: orgVerification,
      fixtures: {
        organization_id: organizationId,
        customer_id: "",
        customer_name: EC_FIXTURE_CUSTOMER_COMPANY_NAME,
        customer_email: EC_FIXTURE_CUSTOMER_EMAIL,
        quote_id: null,
        quote_number: null,
        quote_status: null,
        quote_total_cents: null,
        invoice_id: null,
        invoice_number: null,
        invoice_status: null,
        invoice_total_cents: null,
        portal_user_id: null,
        portal_access_token: null,
      },
      created: { customer: false, quote: false, invoice: false, portal_link: false },
      executed_at,
    }
  }

  const customer = await locateOrCreateCustomer(admin, organizationId)
  const quote = await locateOrCreateQuote(admin, organizationId, customer.customer_id)
  const invoice = await locateOrCreateInvoice(admin, organizationId, customer.customer_id)

  let portalUserId: string | null = null
  let portalToken: string | null = null
  let portalLinkCreated = false
  if (!options?.skipPortalToken) {
    const portal = await provisionPortalAccessToken(admin, organizationId, customer.customer_id)
    portalUserId = portal.portal_user_id
    portalToken = portal.portal_access_token
    portalLinkCreated = portal.created_link
  }

  const fixtures = await loadRevenueFixtureSnapshot(admin, organizationId, {
    customer_id: customer.customer_id,
    customer_name: EC_FIXTURE_CUSTOMER_COMPANY_NAME,
    customer_email: EC_FIXTURE_CUSTOMER_EMAIL,
    quote_id: quote.quote_id,
    invoice_id: invoice.invoice_id,
    portal_user_id: portalUserId,
    portal_access_token: portalToken,
  })

  return {
    qa_marker: EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER,
    ok: true,
    organization_id: organizationId,
    org_verification: orgVerification,
    fixtures,
    created: {
      customer: customer.created,
      quote: quote.created,
      invoice: invoice.created,
      portal_link: portalLinkCreated,
    },
    executed_at,
  }
}

export function resolveCertOrganizationIdFromEnv(): string {
  return (
    process.env.EQUIPIFY_CORE_CERT_ORGANIZATION_ID?.trim() || EQUIPIFY_CORE_DEFAULT_CERT_ORGANIZATION_ID
  )
}
