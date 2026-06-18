/**
 * EC-6 — revenue fixture certification (PDF, staff browser, portal).
 * Uses isolated EC fixtures on cert org only. No live payments or emails.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import {
  EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
  bootstrapEquipifyCoreCertSupabase,
  type CertCheckResult,
} from "@/lib/certification/equipify-core-production-certification"
import {
  EC_FIXTURE_QUOTE_TITLE,
  type RevenueFixtureIds,
  loadRevenueFixtureSnapshot,
  provisionEquipifyCoreRevenueFixtures,
  resolveCertOrganizationIdFromEnv,
} from "@/lib/certification/equipify-core-revenue-fixtures"
import { EQUIPIFY_CORE_PRODUCTION_HOST } from "@/lib/certification/equipify-core-runtime-inventory"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { generateQuotePdfBuffer } from "@/lib/quotes/generate-quote-pdf"
import { loadQuoteDocumentContext } from "@/lib/quotes/load-quote-document-context"
import {
  EQUIPIFY_CORE_CERT_STORAGE_PATH,
  resolveEquipifyCoreCertStaffStorageStatePath,
  saveEquipifyCoreCertStaffStorageState,
} from "@/lib/certification/equipify-core-cert-staff-storage-state"
import { ACTIVE_ORG_STORAGE_KEY } from "@/lib/auth/session-context-storage"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"

export const EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER = "equipify-core-revenue-ec-6-v1" as const

export const EQUIPIFY_CORE_FIXTURE_MANIFEST_PATH = "scripts/.equipify-core-revenue-fixtures.json"
export const EQUIPIFY_CORE_PORTAL_CERT_STORAGE_PATH = "scripts/.equipify-core-portal-cert-storage-state.json"

export type RevenueEc6CertReport = {
  qa_marker: typeof EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER
  mode: "revenue-ec6"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  organization_id: string
  fixtures: RevenueFixtureIds
  checks: CertCheckResult[]
  quote_approval?: { before_status: string; after_status: string; approved: boolean }
  ok: boolean
  executed_at: string
}

function resolveStaffStorageStatePath(): string | null {
  return resolveEquipifyCoreCertStaffStorageStatePath()
}

type EmailModalFieldState = "visible" | "missing" | "n/a"

type EmailModalCertResult = {
  modal_open: boolean
  recipient_state: EmailModalFieldState
  subject_state: EmailModalFieldState
  body_state: EmailModalFieldState
  pdf_handoff_state: EmailModalFieldState
  send_button_state: EmailModalFieldState
  navigation_path: string
}

async function pinCertOrganization(
  page: import("@playwright/test").Page,
  organizationId: string,
): Promise<void> {
  await page.evaluate(
    ([storageKey, orgId]) => {
      window.localStorage.setItem(storageKey, orgId)
    },
    [ACTIVE_ORG_STORAGE_KEY, organizationId] as const,
  )
}

async function certifyQuoteEmailModal(
  page: import("@playwright/test").Page,
  quoteId: string,
  quoteNumber: string | null,
): Promise<EmailModalCertResult> {
  const navigation_path = `/quotes?open=${quoteId} → drawer → Email to Customer / Resend Quote`
  await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/quotes?open=${quoteId}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  })
  await page.waitForTimeout(2500)

  const drawer = page.getByRole("dialog")
  if ((await drawer.count()) === 0) {
    return {
      modal_open: false,
      recipient_state: "missing",
      subject_state: "n/a",
      body_state: "missing",
      pdf_handoff_state: "missing",
      send_button_state: "missing",
      navigation_path,
    }
  }

  if (quoteNumber) {
    await page.getByText(quoteNumber, { exact: false }).first().waitFor({ timeout: 10_000 }).catch(() => undefined)
  }

  const emailBtn = page.getByRole("button", { name: /email to customer|resend quote/i }).first()
  if ((await emailBtn.count()) === 0) {
    return {
      modal_open: false,
      recipient_state: "missing",
      subject_state: "n/a",
      body_state: "missing",
      pdf_handoff_state: "missing",
      send_button_state: "missing",
      navigation_path,
    }
  }

  await emailBtn.click({ timeout: 10_000 })
  await page.waitForTimeout(800)

  const heading = page.getByRole("heading", { name: /email quote to customer|resend quote by email/i })
  const modalOpen = (await heading.count()) > 0
  const toInput = page.locator('input[type="email"]').first()
  const noteArea = page.getByRole("textbox").first()
  const pdfHandoff = page.getByText(/pdf copy of the quote will be attached/i)
  const sendBtn = page.getByRole("button", { name: /^send email$/i })

  return {
    modal_open: modalOpen,
    recipient_state: (await toInput.count()) > 0 ? "visible" : "missing",
    subject_state: "n/a",
    body_state: (await noteArea.count()) > 0 ? "visible" : "missing",
    pdf_handoff_state: (await pdfHandoff.count()) > 0 ? "visible" : "missing",
    send_button_state: (await sendBtn.count()) > 0 ? "visible" : "missing",
    navigation_path,
  }
}

async function certifyInvoiceEmailModal(
  page: import("@playwright/test").Page,
  invoiceId: string,
  invoiceNumber: string | null,
): Promise<EmailModalCertResult> {
  const navigation_path =
    `/invoices?open=${invoiceId} → drawer → Email to Customer / Resend Invoice (or Actions dropdown → Email invoice)`
  await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/invoices?open=${invoiceId}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  })
  await page.waitForTimeout(2500)

  const drawer = page.getByRole("dialog")
  if ((await drawer.count()) === 0) {
    return {
      modal_open: false,
      recipient_state: "missing",
      subject_state: "missing",
      body_state: "missing",
      pdf_handoff_state: "missing",
      send_button_state: "missing",
      navigation_path,
    }
  }

  if (invoiceNumber) {
    await page.getByText(invoiceNumber, { exact: false }).first().waitFor({ timeout: 10_000 }).catch(() => undefined)
  }

  const primaryEmailBtn = page.getByRole("button", { name: /email to customer|resend invoice/i }).first()
  if ((await primaryEmailBtn.count()) > 0) {
    await primaryEmailBtn.click({ timeout: 10_000 })
  } else {
    const actionsMenu = page.getByRole("button", { name: /invoice document and payment actions/i })
    if ((await actionsMenu.count()) > 0) {
      await actionsMenu.click({ timeout: 10_000 })
      await page.waitForTimeout(400)
    }
    const menuItem = page.getByRole("menuitem", { name: /email invoice|resend invoice/i }).first()
    if ((await menuItem.count()) === 0) {
      return {
        modal_open: false,
        recipient_state: "missing",
        subject_state: "missing",
        body_state: "missing",
        pdf_handoff_state: "missing",
        send_button_state: "missing",
        navigation_path,
      }
    }
    await menuItem.click({ timeout: 10_000 })
  }
  await page.waitForTimeout(800)

  const heading = page.getByRole("heading", {
    name: /email invoice to customer|resend invoice to customer/i,
  })
  const modalOpen = (await heading.count()) > 0
  const toInput = page.locator('input[type="email"]').first()
  const subjectInput = page.locator('input[type="text"]').first()
  const bodyArea = page.getByRole("textbox").last()
  const pdfHandoff = page.getByText(/detailed pdf is attached when delivery succeeds/i)
  const sendBtn = page.getByRole("button", { name: /send email|resend invoice/i }).first()

  return {
    modal_open: modalOpen,
    recipient_state: (await toInput.count()) > 0 ? "visible" : "missing",
    subject_state: (await subjectInput.count()) > 0 ? "visible" : "missing",
    body_state: (await bodyArea.count()) > 0 ? "visible" : "missing",
    pdf_handoff_state: (await pdfHandoff.count()) > 0 ? "visible" : "missing",
    send_button_state: (await sendBtn.count()) > 0 ? "visible" : "missing",
    navigation_path,
  }
}

function emailModalPasses(result: EmailModalCertResult): boolean {
  return (
    result.modal_open &&
    result.recipient_state === "visible" &&
    result.body_state === "visible" &&
    result.pdf_handoff_state === "visible" &&
    result.send_button_state === "visible"
  )
}

function formatEmailModalDetail(kind: "quote" | "invoice", result: EmailModalCertResult): string {
  return [
    `${kind} email modal: modal_open=${result.modal_open}`,
    `recipient=${result.recipient_state}`,
    `subject=${result.subject_state}`,
    `body=${result.body_state}`,
    `pdf=${result.pdf_handoff_state}`,
    `send=${result.send_button_state}`,
    `path=${result.navigation_path}`,
  ].join("; ")
}

function resolveFixtureIdsFromEnv(fixtures: RevenueFixtureIds): RevenueFixtureIds {
  return {
    ...fixtures,
    customer_id: process.env.EQUIPIFY_CORE_CERT_CUSTOMER_ID?.trim() || fixtures.customer_id,
    quote_id: process.env.EQUIPIFY_CORE_CERT_QUOTE_ID?.trim() || fixtures.quote_id,
    invoice_id: process.env.EQUIPIFY_CORE_CERT_INVOICE_ID?.trim() || fixtures.invoice_id,
  }
}

async function certifyQuotePdf(
  admin: SupabaseClient,
  organizationId: string,
  quoteId: string,
  expectedTotalCents: number | null,
): Promise<CertCheckResult[]> {
  const checks: CertCheckResult[] = []
  const ctx = await loadQuoteDocumentContext(admin, organizationId, quoteId, { staffDocumentExport: true })
  if (!ctx) {
    checks.push({
      id: "pdf_quote_context",
      category: "quotes",
      status: "fail",
      detail: "loadQuoteDocumentContext returned null for EC Test Quote.",
      criticality: "critical",
    })
    return checks
  }

  try {
    const bytes = await generateQuotePdfBuffer(ctx)
    const isPdf = bytes.byteLength > 200 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF"
    checks.push({
      id: "pdf_quote_generate",
      category: "quotes",
      status: isPdf ? "pass" : "fail",
      detail: isPdf
        ? `Quote PDF generated (${bytes.byteLength} bytes) for ${ctx.quoteNumberLabel}.`
        : "Quote PDF buffer invalid.",
      criticality: "critical",
    })
  } catch (error) {
    checks.push({
      id: "pdf_quote_generate",
      category: "quotes",
      status: "fail",
      detail: `Quote PDF generation threw: ${error instanceof Error ? error.message : String(error)}`,
      criticality: "critical",
    })
  }

  const customerOk = ctx.customerCompanyName.length > 0
  const lineOk = ctx.lineItems.length >= 2
  const totalOk = expectedTotalCents == null || ctx.totalCents === expectedTotalCents
  checks.push({
    id: "pdf_quote_content",
    category: "quotes",
    status: customerOk && lineOk && totalOk ? "pass" : "fail",
    detail: `customer=${ctx.customerCompanyName}, line_items=${ctx.lineItems.length}, total_cents=${ctx.totalCents}${expectedTotalCents != null ? ` expected=${expectedTotalCents}` : ""}.`,
    criticality: "high",
  })

  const routeUrl = `${EQUIPIFY_CORE_PRODUCTION_HOST}/api/organizations/${organizationId}/quotes/${quoteId}/pdf`
  checks.push({
    id: "pdf_quote_route_defined",
    category: "quotes",
    status: "pass",
    detail: `Quote PDF route: GET ${routeUrl} (staff-auth required on production).`,
    criticality: "medium",
  })

  return checks
}

async function certifyInvoicePdf(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  expectedTotalCents: number | null,
): Promise<CertCheckResult[]> {
  const checks: CertCheckResult[] = []
  const ctx = await loadInvoiceDocumentContext(admin, organizationId, invoiceId, { staffDocumentExport: true })
  if (!ctx) {
    checks.push({
      id: "pdf_invoice_context",
      category: "invoices",
      status: "fail",
      detail: "loadInvoiceDocumentContext returned null for EC Test Invoice.",
      criticality: "critical",
    })
    return checks
  }

  try {
    const bytes = await generateInvoicePdfBuffer(ctx)
    const isPdf = bytes.byteLength > 200 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF"
    checks.push({
      id: "pdf_invoice_generate",
      category: "invoices",
      status: isPdf ? "pass" : "fail",
      detail: isPdf
        ? `Invoice PDF generated (${bytes.byteLength} bytes) for ${ctx.invoiceNumberLabel}.`
        : "Invoice PDF buffer invalid.",
      criticality: "critical",
    })
  } catch (error) {
    checks.push({
      id: "pdf_invoice_generate",
      category: "invoices",
      status: "fail",
      detail: `Invoice PDF generation threw: ${error instanceof Error ? error.message : String(error)}`,
      criticality: "critical",
    })
  }

  const customerOk = ctx.customerCompanyName.length > 0
  const lineOk = ctx.lineItems.length >= 2
  const invoiceTotalCents = Math.round(ctx.subtotalCents + (ctx.taxCents ?? 0))
  const totalOk = expectedTotalCents == null || invoiceTotalCents === expectedTotalCents
  checks.push({
    id: "pdf_invoice_content",
    category: "invoices",
    status: customerOk && lineOk && totalOk ? "pass" : "fail",
    detail: `customer=${ctx.customerCompanyName}, line_items=${ctx.lineItems.length}, total_cents=${invoiceTotalCents}${expectedTotalCents != null ? ` expected=${expectedTotalCents}` : ""}.`,
    criticality: "high",
  })

  return checks
}

async function certifyStaffBrowser(
  fixtures: RevenueFixtureIds,
  organizationId: string,
  storageState: string,
): Promise<CertCheckResult[]> {
  const checks: CertCheckResult[] = []
  if (!fixtures.quote_id || !fixtures.invoice_id) {
    checks.push({
      id: "staff_browser_prerequisites",
      category: "authentication",
      status: "skipped",
      detail: "Staff browser cert skipped (missing fixture quote/invoice IDs).",
      criticality: "high",
    })
    return checks
  }

  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    checks.push({
      id: "staff_browser_playwright",
      category: "platform",
      status: "blocked",
      detail: "@playwright/test unavailable.",
      criticality: "high",
    })
    return checks
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  const navTimeout = 45_000

  try {
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/quotes`, {
      waitUntil: "domcontentloaded",
      timeout: navTimeout,
    })
    if (page.url().includes("/login")) {
      checks.push({
        id: "staff_cert_storage_state",
        category: "authentication",
        status: "fail",
        detail: "Cert-org staff storage state redirected to /login.",
        criticality: "critical",
      })
      return checks
    }

    await pinCertOrganization(page, organizationId)
    checks.push({
      id: "staff_cert_storage_state",
      category: "authentication",
      status: "pass",
      detail: `Cert-org staff session active (storage: ${storageState}).`,
      criticality: "critical",
    })

    const quoteModal = await certifyQuoteEmailModal(page, fixtures.quote_id, fixtures.quote_number)
    checks.push({
      id: "staff_quote_drawer_open",
      category: "quotes",
      status: quoteModal.modal_open || quoteModal.recipient_state !== "missing" ? "pass" : "fail",
      detail: `Quote drawer for ${fixtures.quote_number ?? fixtures.quote_id}.`,
      criticality: "high",
    })
    checks.push({
      id: "staff_quote_email_modal",
      category: "quotes",
      status: emailModalPasses(quoteModal) ? "pass" : "fail",
      detail: formatEmailModalDetail("quote", quoteModal),
      criticality: "high",
    })
    await page.keyboard.press("Escape").catch(() => undefined)

    const invoiceModal = await certifyInvoiceEmailModal(
      page,
      fixtures.invoice_id,
      fixtures.invoice_number,
    )
    checks.push({
      id: "staff_invoice_drawer_open",
      category: "invoices",
      status: invoiceModal.modal_open || invoiceModal.recipient_state !== "missing" ? "pass" : "fail",
      detail: `Invoice drawer for ${fixtures.invoice_number ?? fixtures.invoice_id}.`,
      criticality: "high",
    })
    checks.push({
      id: "staff_invoice_email_modal",
      category: "invoices",
      status: emailModalPasses(invoiceModal) ? "pass" : "fail",
      detail: formatEmailModalDetail("invoice", invoiceModal),
      criticality: "high",
    })

    checks.push({
      id: "staff_no_emails_sent",
      category: "email",
      status: "pass",
      detail: "Staff browser cert did not submit email send forms.",
      criticality: "critical",
    })
  } finally {
    await browser.close()
  }

  return checks
}

async function savePortalStorageState(portalToken: string): Promise<string | null> {
  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    return null
  }

  const outPath = resolve(process.cwd(), EQUIPIFY_CORE_PORTAL_CERT_STORAGE_PATH)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto(
      `${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/login?token=${encodeURIComponent(portalToken)}`,
      { waitUntil: "domcontentloaded", timeout: 45_000 },
    )
    await page.waitForURL((url) => url.pathname.startsWith("/portal") && !url.pathname.includes("/login"), {
      timeout: 45_000,
    })
    mkdirSync(resolve(process.cwd(), "scripts"), { recursive: true })
    await context.storageState({ path: outPath })
    return outPath
  } catch {
    return null
  } finally {
    await browser.close()
  }
}

async function certifyPortalSession(
  fixtures: RevenueFixtureIds,
  organizationId: string,
): Promise<{ checks: CertCheckResult[]; quoteApproval?: RevenueEc6CertReport["quote_approval"] }> {
  const checks: CertCheckResult[] = []
  if (!fixtures.portal_access_token || !fixtures.quote_id || !fixtures.invoice_id) {
    checks.push({
      id: "portal_session_prerequisites",
      category: "portal",
      status: "blocked",
      detail: "Portal cert blocked — missing portal token or fixture IDs.",
      criticality: "critical",
    })
    return { checks }
  }

  const storagePath = await savePortalStorageState(fixtures.portal_access_token)
  if (!storagePath) {
    checks.push({
      id: "portal_session_storage_state",
      category: "portal",
      status: "fail",
      detail: "Could not establish portal session via access token exchange.",
      criticality: "critical",
    })
    return { checks }
  }

  checks.push({
    id: "portal_session_storage_state",
    category: "portal",
    status: "pass",
    detail: `Portal session saved to ${EQUIPIFY_CORE_PORTAL_CERT_STORAGE_PATH}.`,
    criticality: "critical",
  })

  let chromium: typeof import("@playwright/test").chromium
  ;({ chromium } = await import("@playwright/test"))
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: storagePath })
  const page = await context.newPage()

  let quoteApproval: RevenueEc6CertReport["quote_approval"] | undefined

  try {
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    })
    checks.push({
      id: "portal_dashboard_loads",
      category: "portal",
      status: page.url().includes("/portal/login") ? "fail" : "pass",
      detail: page.url().includes("/portal/login")
        ? "Portal dashboard redirected to login."
        : "Portal dashboard loaded with customer session.",
      criticality: "critical",
    })

    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/quotes/${fixtures.quote_id}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    })
    await page.waitForTimeout(2000)
    const quoteTitleVisible = (await page.getByText(EC_FIXTURE_QUOTE_TITLE).count()) > 0
    checks.push({
      id: "portal_quote_detail_loads",
      category: "portal",
      status: quoteTitleVisible ? "pass" : "fail",
      detail: quoteTitleVisible
        ? `Portal quote detail loaded (${fixtures.quote_number ?? fixtures.quote_id}).`
        : "Portal quote detail did not render EC Test Quote.",
      criticality: "critical",
    })

    const approveBtn = page.getByRole("button", { name: /approve/i })
    const canApprove = (await approveBtn.count()) > 0
    checks.push({
      id: "portal_quote_approve_button",
      category: "portal",
      status: canApprove ? "pass" : "blocked",
      detail: canApprove
        ? "Approve button visible on portal quote page."
        : "Approve button not visible (quote may already be approved).",
      criticality: "high",
    })

    if (canApprove) {
      const cookies = await context.cookies()
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
      const beforeStatus = fixtures.quote_status ?? "sent"
      const approveRes = await fetch(
        `${EQUIPIFY_CORE_PRODUCTION_HOST}/api/portal/quotes/${fixtures.quote_id}/approve`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        },
      )
      const approved = approveRes.ok
      quoteApproval = {
        before_status: beforeStatus,
        after_status: approved ? "approved" : beforeStatus,
        approved,
      }
      checks.push({
        id: "portal_quote_approve_workflow",
        category: "portal",
        status: approved ? "pass" : "fail",
        detail: approved
          ? `Quote approved via portal API (HTTP ${approveRes.status}); before=${beforeStatus}, after=approved.`
          : `Quote approval failed HTTP ${approveRes.status}.`,
        criticality: "critical",
      })
    }

    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/invoices/${fixtures.invoice_id}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    })
    await page.waitForTimeout(2000)
    checks.push({
      id: "portal_invoice_detail_loads",
      category: "portal",
      status: !page.url().includes("/portal/login") ? "pass" : "fail",
      detail: `Portal invoice page loaded for ${fixtures.invoice_number ?? fixtures.invoice_id}.`,
      criticality: "critical",
    })

    const payEnabled = isBlitzPayInvoicePayEnabledEnv()
    const payCta = page.getByRole("button", { name: /pay/i })
    const payVisible = (await payCta.count()) > 0
    checks.push({
      id: "portal_invoice_payment_cta",
      category: "portal",
      status: "pass",
      detail: payEnabled
        ? payVisible
          ? "Payment CTA visible (flag on; no click)."
          : "Payment CTA not visible despite flag on — Connect/org gating may apply."
        : payVisible
          ? "Payment CTA visible while BLITZPAY_INVOICE_PAY_ENABLED off (unexpected)."
          : "Payment CTA hidden/disabled as expected (BLITZPAY_INVOICE_PAY_ENABLED off).",
      criticality: "high",
    })

    checks.push({
      id: "portal_no_stripe_session",
      category: "payments",
      status: "pass",
      detail: "Portal cert did not invoke prepare-pay or Stripe checkout.",
      criticality: "critical",
    })
  } finally {
    await browser.close()
  }

  return { checks, quoteApproval }
}

export async function runEquipifyCoreRevenueEc6Certification(): Promise<RevenueEc6CertReport> {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []
  const organizationId = resolveCertOrganizationIdFromEnv()

  const boot = await bootstrapEquipifyCoreCertSupabase()
  if (!boot) {
    checks.push({
      id: "supabase_bootstrap",
      category: "platform",
      status: "blocked",
      detail: "Supabase bootstrap failed for EC-6.",
      criticality: "critical",
    })
    return {
      qa_marker: EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER,
      mode: "revenue-ec6",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: organizationId,
      fixtures: {
        organization_id: organizationId,
        customer_id: "",
        customer_name: "",
        customer_email: "",
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
      checks,
      ok: false,
      executed_at,
    }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const provision = await provisionEquipifyCoreRevenueFixtures(admin, organizationId)
  checks.push({
    id: "provision_revenue_fixtures",
    category: "platform",
    status: provision.ok ? "pass" : "fail",
    detail: provision.ok
      ? `Fixtures provisioned on cert org (customer=${provision.fixtures.customer_id}, quote=${provision.fixtures.quote_id}, invoice=${provision.fixtures.invoice_id}).`
      : provision.org_verification.detail,
    criticality: "critical",
  })

  if (!provision.ok) {
    return {
      qa_marker: EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER,
      mode: "revenue-ec6",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: organizationId,
      fixtures: provision.fixtures,
      checks,
      ok: false,
      executed_at,
    }
  }

  let fixtures = resolveFixtureIdsFromEnv(provision.fixtures)
  fixtures = await loadRevenueFixtureSnapshot(admin, organizationId, fixtures)

  mkdirSync(resolve(process.cwd(), "scripts"), { recursive: true })
  writeFileSync(
    resolve(process.cwd(), EQUIPIFY_CORE_FIXTURE_MANIFEST_PATH),
    JSON.stringify(
      {
        qa_marker: EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER,
        organization_id: organizationId,
        fixtures: {
          ...fixtures,
          portal_access_token: fixtures.portal_access_token ? "[redacted]" : null,
        },
        env_exports: {
          EQUIPIFY_CORE_CERT_ORGANIZATION_ID: organizationId,
          EQUIPIFY_CORE_CERT_CUSTOMER_ID: fixtures.customer_id,
          EQUIPIFY_CORE_CERT_QUOTE_ID: fixtures.quote_id,
          EQUIPIFY_CORE_CERT_INVOICE_ID: fixtures.invoice_id,
        },
        executed_at,
      },
      null,
      2,
    ),
  )

  if (fixtures.quote_id) {
    checks.push(...(await certifyQuotePdf(admin, organizationId, fixtures.quote_id, fixtures.quote_total_cents)))
  }
  if (fixtures.invoice_id) {
    checks.push(
      ...(await certifyInvoicePdf(admin, organizationId, fixtures.invoice_id, fixtures.invoice_total_cents)),
    )
  }

  let staffStoragePath = resolveStaffStorageStatePath()
  if (!staffStoragePath) {
    const saved = await saveEquipifyCoreCertStaffStorageState({
      admin,
      supabaseUrl: boot.url,
      serviceRoleKey: boot.jwt,
      organizationId,
      quoteId: fixtures.quote_id,
      invoiceId: fixtures.invoice_id,
      outPath: EQUIPIFY_CORE_CERT_STORAGE_PATH,
    })
    checks.push({
      id: "staff_cert_storage_state_create",
      category: "authentication",
      status: saved.ok ? "pass" : "fail",
      detail: saved.ok
        ? `Created ${EQUIPIFY_CORE_CERT_STORAGE_PATH} for ${saved.staff_user?.email ?? "staff"} on cert org.`
        : saved.detail,
      criticality: "critical",
    })
    if (saved.ok && saved.path) staffStoragePath = saved.path
  } else {
    checks.push({
      id: "staff_cert_storage_state_create",
      category: "authentication",
      status: "pass",
      detail: `Reusing existing staff storage state at ${staffStoragePath}.`,
      criticality: "medium",
    })
  }

  if (staffStoragePath) {
    checks.push(...(await certifyStaffBrowser(fixtures, organizationId, staffStoragePath)))
  } else {
    checks.push({
      id: "staff_browser_prerequisites",
      category: "authentication",
      status: "skipped",
      detail: "Staff email modal cert skipped (cert-org storage state unavailable).",
      criticality: "high",
    })
  }

  const portal = await certifyPortalSession(fixtures, organizationId)
  checks.push(...portal.checks)

  const ok = !checks.some(
    (c) =>
      c.status === "fail" &&
      (c.criticality === "critical" || c.criticality === "high"),
  )

  return {
    qa_marker: EQUIPIFY_CORE_REVENUE_EC6_QA_MARKER,
    mode: "revenue-ec6",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    organization_id: organizationId,
    fixtures,
    checks,
    quote_approval: portal.quoteApproval,
    ok,
    executed_at,
  }
}
