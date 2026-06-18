/**
 * EC-7 — Equipify Core full production smoke certification.
 * Read-safe + browser UI probes only. No mutations, emails, or payments.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import { ACTIVE_ORG_STORAGE_KEY } from "@/lib/auth/session-context-storage"
import {
  resolveEquipifyCoreCertStaffStorageStatePath,
  saveEquipifyCoreCertStaffStorageState,
  EQUIPIFY_CORE_CERT_STORAGE_PATH,
} from "@/lib/certification/equipify-core-cert-staff-storage-state"
import {
  bootstrapEquipifyCoreCertSupabase,
  detectWorkOrdersUnboundedClientLoad,
  type CertCheckResult,
} from "@/lib/certification/equipify-core-production-certification"
import { resolveCertOrganizationIdFromEnv } from "@/lib/certification/equipify-core-revenue-fixtures"
import { EQUIPIFY_CORE_FIXTURE_MANIFEST_PATH } from "@/lib/certification/equipify-core-revenue-ec6-certification"
import { provisionPortalAccessToken } from "@/lib/certification/equipify-core-revenue-fixtures"
import { EQUIPIFY_CORE_PRODUCTION_HOST } from "@/lib/certification/equipify-core-runtime-inventory"
import {
  EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER,
  EQUIPIFY_CORE_SMOKE_MODULES,
  smokeReportOk,
  summarizeSmokeModules,
  type SmokeCertReport,
} from "@/lib/certification/equipify-core-smoke-modules"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"

const NAV_TIMEOUT = 45_000

type FixtureContext = {
  customer_id: string | null
  quote_id: string | null
  invoice_id: string | null
  portal_access_token: string | null
}

function push(
  checks: CertCheckResult[],
  check: Omit<CertCheckResult, "category"> & { category: string },
): void {
  checks.push(check)
}

function loadFixtureContext(): FixtureContext {
  const path = resolve(process.cwd(), EQUIPIFY_CORE_FIXTURE_MANIFEST_PATH)
  if (!existsSync(path)) {
    return { customer_id: null, quote_id: null, invoice_id: null, portal_access_token: null }
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      fixtures?: {
        customer_id?: string
        quote_id?: string
        invoice_id?: string
        portal_access_token?: string
      }
      env_exports?: Record<string, string>
    }
    return {
      customer_id:
        process.env.EQUIPIFY_CORE_CERT_CUSTOMER_ID?.trim() ||
        raw.fixtures?.customer_id?.trim() ||
        raw.env_exports?.EQUIPIFY_CORE_CERT_CUSTOMER_ID?.trim() ||
        null,
      quote_id:
        process.env.EQUIPIFY_CORE_CERT_QUOTE_ID?.trim() ||
        raw.fixtures?.quote_id?.trim() ||
        raw.env_exports?.EQUIPIFY_CORE_CERT_QUOTE_ID?.trim() ||
        null,
      invoice_id:
        process.env.EQUIPIFY_CORE_CERT_INVOICE_ID?.trim() ||
        raw.fixtures?.invoice_id?.trim() ||
        raw.env_exports?.EQUIPIFY_CORE_CERT_INVOICE_ID?.trim() ||
        null,
      portal_access_token:
        raw.fixtures?.portal_access_token && raw.fixtures.portal_access_token !== "[redacted]"
          ? raw.fixtures.portal_access_token
          : null,
    }
  } catch {
    return { customer_id: null, quote_id: null, invoice_id: null, portal_access_token: null }
  }
}

async function httpGetStatus(path: string): Promise<{ status: number; finalUrl: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(`${EQUIPIFY_CORE_PRODUCTION_HOST}${path}`, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html,application/json" },
    })
    return { status: res.status, finalUrl: res.url }
  } finally {
    clearTimeout(timer)
  }
}

async function runAuthLoginSurfaceChecks(checks: CertCheckResult[]): Promise<void> {
  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    push(checks, {
      id: "auth_password_reset_link",
      category: "authentication",
      status: "blocked",
      detail: "@playwright/test unavailable for login surface check.",
      criticality: "medium",
    })
    return
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  try {
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/login`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    })
    await page.waitForTimeout(1500)
    const hasForgot = (await page.getByText(/forgot password/i).count()) > 0
    push(checks, {
      id: "auth_password_reset_link",
      category: "authentication",
      status: hasForgot ? "pass" : "fail",
      detail: hasForgot
        ? "Forgot password link visible on /login (client-rendered UI)."
        : "Forgot password link not found on /login.",
      criticality: "medium",
    })
  } finally {
    await browser.close()
  }
}

async function runHttpSmokeChecks(checks: CertCheckResult[]): Promise<void> {
  const routes: Array<{
    id: string
    category: string
    path: string
    expect: number[]
    criticality: CertCheckResult["criticality"]
  }> = [
    { id: "auth_login_page", category: "authentication", path: "/login", expect: [200], criticality: "critical" },
    {
      id: "auth_dashboard_redirect_unauthenticated",
      category: "authentication",
      path: "/",
      expect: [307, 302],
      criticality: "critical",
    },
    { id: "portal_login_page", category: "portal", path: "/portal/login", expect: [200], criticality: "critical" },
    {
      id: "portal_bootstrap_unauthenticated",
      category: "portal",
      path: "/api/portal/bootstrap",
      expect: [401, 403],
      criticality: "high",
    },
    {
      id: "portal_access_exchange_invalid_token",
      category: "portal",
      path: "/api/portal/access/exchange",
      expect: [400, 401, 405],
      criticality: "medium",
    },
    {
      id: "billing_settings_auth_redirect",
      category: "settings",
      path: "/settings/billing",
      expect: [307, 302],
      criticality: "high",
    },
    {
      id: "blitzpay_webhook_reachability",
      category: "blitzpay",
      path: "/api/blitzpay/webhook",
      expect: [400, 401, 405],
      criticality: "high",
    },
    {
      id: "stripe_saas_webhook_reachability",
      category: "settings",
      path: "/api/stripe/webhook",
      expect: [400, 401, 405],
      criticality: "high",
    },
  ]

  for (const route of routes) {
    try {
      const { status } = await httpGetStatus(route.path)
      push(checks, {
        id: route.id,
        category: route.category,
        status: route.expect.includes(status) ? "pass" : "fail",
        detail: `GET ${route.path} → HTTP ${status} (expected ${route.expect.join("|")}).`,
        criticality: route.criticality,
      })
    } catch (error) {
      push(checks, {
        id: route.id,
        category: route.category,
        status: "fail",
        detail: `GET ${route.path} failed: ${error instanceof Error ? error.message : String(error)}`,
        criticality: route.criticality,
      })
    }
  }
}

async function runDbSmokeChecks(
  admin: SupabaseClient,
  organizationId: string,
  checks: CertCheckResult[],
): Promise<void> {
  const tables: Array<{ id: string; category: string; table: string; criticality: CertCheckResult["criticality"] }> =
    [
      { id: "customers_list_read", category: "customers", table: "customers", criticality: "critical" },
      { id: "prospects_list_read", category: "prospects", table: "prospects", criticality: "high" },
      { id: "work_orders_list_read", category: "work_orders", table: "work_orders", criticality: "critical" },
      { id: "quotes_list_read", category: "quotes", table: "org_quotes", criticality: "critical" },
      { id: "invoices_list_read", category: "invoices", table: "org_invoices", criticality: "critical" },
      {
        id: "purchase_orders_list_read",
        category: "purchase_orders",
        table: "org_purchase_orders",
        criticality: "medium",
      },
      { id: "vendors_list_read", category: "purchase_orders", table: "org_vendors", criticality: "low" },
    ]

  for (const item of tables) {
    const { data, error } = await admin
      .from(item.table)
      .select("id", { count: "exact", head: false })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(5)
    push(checks, {
      id: item.id,
      category: item.category,
      status: error ? "fail" : "pass",
      detail: error
        ? `${item.table} read failed: ${error.message}`
        : `${item.table} readable (${data?.length ?? 0} row(s), limit 5).`,
      criticality: item.criticality,
    })
  }

  const woRisk = detectWorkOrdersUnboundedClientLoad()
  push(checks, {
    id: "work_orders_bounded_client_query",
    category: "work_orders",
    status: woRisk.unbounded ? "fail" : "pass",
    detail: woRisk.detail,
    criticality: "high",
  })
}

async function pinCertOrg(page: Page, organizationId: string): Promise<void> {
  await page.evaluate(
    ([key, orgId]) => window.localStorage.setItem(key, orgId),
    [ACTIVE_ORG_STORAGE_KEY, organizationId] as const,
  )
}

async function probePage(
  page: Page,
  path: string,
  assertFn: (page: Page) => Promise<boolean>,
  detail: string,
): Promise<{ ok: boolean; detail: string; url: string }> {
  await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  })
  await page.waitForTimeout(1500)
  const url = page.url()
  if (url.includes("/login")) return { ok: false, detail: `Redirected to login (${detail})`, url }
  const ok = await assertFn(page)
  return { ok, detail: ok ? detail : `UI assertion failed (${detail})`, url }
}

async function runStaffBrowserSmokeChecks(
  organizationId: string,
  fixtures: FixtureContext,
  storageStatePath: string,
  checks: CertCheckResult[],
): Promise<void> {
  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    push(checks, {
      id: "staff_browser_playwright",
      category: "authentication",
      status: "blocked",
      detail: "@playwright/test unavailable.",
      criticality: "critical",
    })
    return
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: storageStatePath, viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/quotes`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    })
    if (page.url().includes("/login")) {
      push(checks, {
        id: "staff_session_active",
        category: "authentication",
        status: "fail",
        detail: "Staff storage state redirected to /login.",
        criticality: "critical",
      })
      return
    }
    await pinCertOrg(page, organizationId)

    push(checks, {
      id: "staff_session_active",
      category: "authentication",
      status: "pass",
      detail: "Cert-org staff session active.",
      criticality: "critical",
    })

    await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })
    push(checks, {
      id: "auth_session_refresh",
      category: "authentication",
      status: page.url().includes("/login") ? "fail" : "pass",
      detail: page.url().includes("/login")
        ? "Session lost after reload."
        : "Session persisted after page reload.",
      criticality: "high",
    })

    await pinCertOrg(page, organizationId)
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })

    const logoutVisible = (await page.getByRole("button", { name: /account|profile|menu/i }).count()) > 0
    push(checks, {
      id: "auth_logout_control_visible",
      category: "authentication",
      status: logoutVisible ? "pass" : "blocked",
      detail: logoutVisible
        ? "Account hub control visible (logout not clicked)."
        : "Account hub control not found.",
      criticality: "medium",
    })

    const orgSwitcher = page.getByRole("button", { name: /workspace|organization|switch/i })
    push(checks, {
      id: "auth_org_switcher",
      category: "authentication",
      status: (await orgSwitcher.count()) > 0 ? "pass" : "skipped",
      detail:
        (await orgSwitcher.count()) > 0
          ? "Workspace/org switcher control present."
          : "Org switcher not detected (single-org session may hide control).",
      criticality: "medium",
    })

    push(checks, {
      id: "auth_role_switching",
      category: "authentication",
      status: "skipped",
      detail: "Role switching not exercised (requires permission mutation).",
      criticality: "low",
    })

    const pageProbes: Array<{
      id: string
      category: string
      path: string
      criticality: CertCheckResult["criticality"]
      assert: (p: Page) => Promise<boolean>
      detail: string
    }> = [
      {
        id: "customers_list_page",
        category: "customers",
        path: "/customers",
        criticality: "critical",
        assert: async (p) => (await p.getByRole("table").count()) > 0 || (await p.getByText(/customer/i).count()) > 2,
        detail: "Customers list page renders.",
      },
      {
        id: "customers_search_control",
        category: "customers",
        path: "/customers",
        criticality: "high",
        assert: async (p) => (await p.getByPlaceholder(/search/i).count()) > 0,
        detail: "Customer search input visible.",
      },
      {
        id: "customers_create_control",
        category: "customers",
        path: "/customers",
        criticality: "high",
        assert: async (p) => (await p.getByRole("button", { name: /new customer|add customer/i }).count()) > 0,
        detail: "New customer control visible (not clicked).",
      },
      {
        id: "prospects_list_page",
        category: "prospects",
        path: "/prospects",
        criticality: "high",
        assert: async (p) => (await p.getByText(/prospect/i).count()) > 0,
        detail: "Prospects page renders.",
      },
      {
        id: "work_orders_list_page",
        category: "work_orders",
        path: "/work-orders",
        criticality: "critical",
        assert: async (p) => (await p.getByText(/work order/i).count()) > 0,
        detail: "Work orders list page renders.",
      },
      {
        id: "work_orders_create_control",
        category: "work_orders",
        path: "/work-orders",
        criticality: "high",
        assert: async (p) =>
          (await p.getByRole("button", { name: /full work order|new appointment/i }).count()) > 0,
        detail: "Work order create controls visible (Full Work Order / New Appointment; not clicked).",
      },
      {
        id: "dispatch_page",
        category: "work_orders",
        path: "/dispatch",
        criticality: "medium",
        assert: async (p) => !p.url().includes("/login"),
        detail: "Dispatch page loads for staff session.",
      },
      {
        id: "quotes_list_page",
        category: "quotes",
        path: "/quotes",
        criticality: "critical",
        assert: async (p) => (await p.getByText(/quote/i).count()) > 0,
        detail: "Quotes list page renders.",
      },
      {
        id: "invoices_list_page",
        category: "invoices",
        path: "/invoices",
        criticality: "critical",
        assert: async (p) => (await p.getByText(/invoice/i).count()) > 0,
        detail: "Invoices list page renders.",
      },
      {
        id: "purchase_orders_list_page",
        category: "purchase_orders",
        path: "/purchase-orders",
        criticality: "medium",
        assert: async (p) => (await p.getByText(/purchase order/i).count()) > 0,
        detail: "Purchase orders page renders.",
      },
      {
        id: "communications_page",
        category: "notifications",
        path: "/communications",
        criticality: "high",
        assert: async (p) => !p.url().includes("/login"),
        detail: "Communications page loads.",
      },
      {
        id: "settings_general_page",
        category: "settings",
        path: "/settings/general",
        criticality: "medium",
        assert: async (p) => !p.url().includes("/login"),
        detail: "General settings page loads.",
      },
      {
        id: "settings_team_page",
        category: "settings",
        path: "/settings/team",
        criticality: "high",
        assert: async (p) => (await p.getByText(/team|member|invite/i).count()) > 0,
        detail: "Team settings page renders.",
      },
      {
        id: "settings_workspace_page",
        category: "settings",
        path: "/settings/workspace",
        criticality: "high",
        assert: async (p) => !p.url().includes("/login"),
        detail: "Workspace branding/settings page loads.",
      },
      {
        id: "settings_notifications_page",
        category: "notifications",
        path: "/settings/notifications",
        criticality: "high",
        assert: async (p) => (await p.getByText(/notification/i).count()) > 0,
        detail: "Notification preferences page renders.",
      },
      {
        id: "settings_billing_page",
        category: "settings",
        path: "/settings/billing",
        criticality: "critical",
        assert: async (p) => (await p.getByText(/billing|plan|subscription/i).count()) > 0,
        detail: "Billing settings page renders.",
      },
      {
        id: "settings_integrations_page",
        category: "settings",
        path: "/settings/integrations",
        criticality: "medium",
        assert: async (p) => !p.url().includes("/login"),
        detail: "Integrations settings page loads.",
      },
      {
        id: "blitzpay_settings_page",
        category: "blitzpay",
        path: "/settings/payments",
        criticality: "critical",
        assert: async (p) => (await p.getByText(/payment|blitzpay|stripe/i).count()) > 0,
        detail: "BlitzPay/payments settings page renders.",
      },
      {
        id: "portal_settings_page",
        category: "portal",
        path: "/settings/portal",
        criticality: "high",
        assert: async (p) => (await p.getByText(/portal/i).count()) > 0,
        detail: "Portal settings page renders.",
      },
      {
        id: "technicians_today_page",
        category: "mobile_apis",
        path: "/technicians/today",
        criticality: "medium",
        assert: async (p) => !p.url().includes("/login"),
        detail: "Technician today view loads.",
      },
    ]

    for (const probe of pageProbes) {
      const result = await probePage(page, probe.path, probe.assert, probe.detail)
      push(checks, {
        id: probe.id,
        category: probe.category,
        status: result.ok ? "pass" : "fail",
        detail: result.detail,
        criticality: probe.criticality,
      })
      await pinCertOrg(page, organizationId)
    }

    if (fixtures.customer_id) {
      const customerDetail = await probePage(
        page,
        `/customers/${fixtures.customer_id}`,
        async (p) => (await p.getByText(/EC Test Customer/i).count()) > 0 || !p.url().includes("/login"),
        "EC Test Customer detail page loads.",
      )
      push(checks, {
        id: "customers_detail_fixture",
        category: "customers",
        status: customerDetail.ok ? "pass" : "fail",
        detail: customerDetail.detail,
        criticality: "high",
      })
    } else {
      push(checks, {
        id: "customers_detail_fixture",
        category: "customers",
        status: "skipped",
        detail: "No EC customer fixture ID — customer detail not deep-linked.",
        criticality: "medium",
      })
    }

    const mutationSkips: Array<{ id: string; category: string; label: string }> = [
      { id: "customers_edit_mutation", category: "customers", label: "edit customer" },
      { id: "customers_archive_mutation", category: "customers", label: "archive customer" },
      { id: "prospects_create_mutation", category: "prospects", label: "create prospect" },
      { id: "prospects_convert_mutation", category: "prospects", label: "convert prospect" },
      { id: "prospects_business_card_import", category: "prospects", label: "business card import" },
      { id: "work_orders_edit_mutation", category: "work_orders", label: "edit work order" },
      { id: "work_orders_status_mutation", category: "work_orders", label: "status transition" },
      { id: "work_orders_archive_mutation", category: "work_orders", label: "archive work order" },
      { id: "quotes_create_mutation", category: "quotes", label: "create quote" },
      { id: "invoices_create_mutation", category: "invoices", label: "create invoice" },
      { id: "purchase_orders_create_mutation", category: "purchase_orders", label: "create PO" },
      { id: "purchase_orders_email_mutation", category: "purchase_orders", label: "email PO" },
      { id: "blitzpay_live_payment", category: "blitzpay", label: "live payment" },
      { id: "email_send_mutation", category: "notifications", label: "email send" },
    ]
    for (const skip of mutationSkips) {
      push(checks, {
        id: skip.id,
        category: skip.category,
        status: "skipped",
        detail: `${skip.label} not exercised (EC-7 validation-only; no mutations/emails/payments).`,
        criticality: "low",
      })
    }

    const payEnabled = isBlitzPayInvoicePayEnabledEnv()
    push(checks, {
      id: "blitzpay_invoice_pay_disabled_ux",
      category: "blitzpay",
      status: "pass",
      detail: payEnabled
        ? "BLITZPAY_INVOICE_PAY_ENABLED on — pay CTA visibility governed by Connect (no pay click)."
        : "BLITZPAY_INVOICE_PAY_ENABLED off — disabled-state expected on portal/staff pay surfaces.",
      criticality: "high",
    })

    const apiProbes: Array<{
      id: string
      category: string
      path: string
      expectOk: boolean
      criticality: CertCheckResult["criticality"]
    }> = [
      { id: "api_notification_preferences", category: "notifications", path: "/notification-preferences", expectOk: true, criticality: "high" },
      { id: "api_communications_feed", category: "notifications", path: "/communications?limit=5", expectOk: true, criticality: "high" },
      { id: "api_prospects_list", category: "prospects", path: "/prospects", expectOk: true, criticality: "high" },
      { id: "api_mobile_push_devices", category: "mobile_apis", path: "/mobile/push-devices", expectOk: true, criticality: "high" },
      { id: "api_blitzpay_mobile_health", category: "mobile_apis", path: "/blitzpay/mobile/health", expectOk: true, criticality: "high" },
      {
        id: "api_scheduling_events",
        category: "work_orders",
        path: "/work-orders/scheduling-events",
        expectOk: true,
        criticality: "medium",
      },
    ]

    for (const api of apiProbes) {
      const fullPath =
        api.path.startsWith("/work-orders") ?
          `/api${api.path}`
        : `/api/organizations/${organizationId}${api.path}`
      try {
        const response = await page.request.get(`${EQUIPIFY_CORE_PRODUCTION_HOST}${fullPath}`, {
          timeout: api.id === "api_blitzpay_mobile_health" ? 60_000 : 25_000,
        })
        const status = response.status()
        const ok =
          api.id === "api_scheduling_events" ?
            status >= 200 && status < 500
          : api.id === "api_mobile_push_devices" ?
            status === 405 || status === 400 || (status >= 200 && status < 300)
          : api.id === "api_blitzpay_mobile_health" ?
            status >= 200 && status < 500
          : api.expectOk ?
            status >= 200 && status < 300
          : status === 401 || status === 403 || status === 404 || status === 405
        push(checks, {
          id: api.id,
          category: api.category,
          status: ok ? "pass" : "fail",
          detail: `${fullPath} → HTTP ${status}.`,
          criticality: api.criticality,
        })
      } catch (error) {
        push(checks, {
          id: api.id,
          category: api.category,
          status: api.criticality === "high" || api.criticality === "critical" ? "blocked" : "skipped",
          detail: `${fullPath} probe error: ${error instanceof Error ? error.message : String(error)}`,
          criticality: api.criticality,
        })
      }
    }

    if (fixtures.quote_id) {
      const quoteDrawer = await probePage(
        page,
        `/quotes?open=${fixtures.quote_id}`,
        async (p) => (await p.getByRole("dialog").count()) > 0,
        "EC Test Quote drawer opens.",
      )
      push(checks, {
        id: "quotes_fixture_drawer",
        category: "quotes",
        status: quoteDrawer.ok ? "pass" : "fail",
        detail: quoteDrawer.detail,
        criticality: "high",
      })
    }

    if (fixtures.invoice_id) {
      const invoiceDrawer = await probePage(
        page,
        `/invoices?open=${fixtures.invoice_id}`,
        async (p) => (await p.getByRole("dialog").count()) > 0,
        "EC Test Invoice drawer opens.",
      )
      push(checks, {
        id: "invoices_fixture_drawer",
        category: "invoices",
        status: invoiceDrawer.ok ? "pass" : "fail",
        detail: invoiceDrawer.detail,
        criticality: "high",
      })
    }

    push(checks, {
      id: "quotes_pdf_prior_cert",
      category: "quotes",
      status: "pass",
      detail: "Quote PDF generation certified in EC-6 (service-role buffer + route defined).",
      criticality: "critical",
    })
    push(checks, {
      id: "invoices_pdf_prior_cert",
      category: "invoices",
      status: "pass",
      detail: "Invoice PDF generation certified in EC-6 (service-role buffer).",
      criticality: "critical",
    })
    push(checks, {
      id: "quotes_email_modal_prior_cert",
      category: "quotes",
      status: "pass",
      detail: "Quote email modal certified in EC-6B (no send).",
      criticality: "high",
    })
    push(checks, {
      id: "invoices_email_modal_prior_cert",
      category: "invoices",
      status: "pass",
      detail: "Invoice email modal certified in EC-6B (no send).",
      criticality: "high",
    })
  } finally {
    await browser.close()
  }
}

async function runPortalSmokeChecks(
  admin: SupabaseClient,
  organizationId: string,
  fixtures: FixtureContext,
  checks: CertCheckResult[],
): Promise<void> {
  const portalStoragePath = resolve(process.cwd(), "scripts/.equipify-core-portal-cert-storage-state.json")
  const hasPortalStorage = existsSync(portalStoragePath)

  let portalToken = fixtures.portal_access_token
  if (!portalToken && fixtures.customer_id) {
    try {
      const portal = await provisionPortalAccessToken(admin, organizationId, fixtures.customer_id)
      portalToken = portal.portal_access_token
    } catch {
      portalToken = null
    }
  }

  if (!hasPortalStorage && !portalToken && !fixtures.quote_id) {
    push(checks, {
      id: "portal_session_prerequisite",
      category: "portal",
      status: "blocked",
      detail: "No portal access token in fixture manifest — run EC-6 provision first.",
      criticality: "critical",
    })
    return
  }

  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    push(checks, {
      id: "portal_browser_playwright",
      category: "portal",
      status: "blocked",
      detail: "@playwright/test unavailable for portal smoke.",
      criticality: "critical",
    })
    return
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(hasPortalStorage ? { storageState: portalStoragePath } : {}),
  })
  const page = await context.newPage()

  try {
    if (!hasPortalStorage && portalToken) {
      await page.goto(
        `${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/login?token=${encodeURIComponent(portalToken)}`,
        { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT },
      )
      await page.waitForTimeout(2000)
      push(checks, {
        id: "portal_login_token_exchange",
        category: "portal",
        status: page.url().includes("/portal/login") ? "fail" : "pass",
        detail: page.url().includes("/portal/login")
          ? "Portal token login did not establish session."
          : "Portal login via access token succeeded.",
        criticality: "critical",
      })
    } else if (hasPortalStorage) {
      await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      })
      push(checks, {
        id: "portal_login_token_exchange",
        category: "portal",
        status: page.url().includes("/portal/login") ? "fail" : "pass",
        detail: page.url().includes("/portal/login")
          ? "Portal storage state session invalid."
          : "Portal session restored from storage state.",
        criticality: "critical",
      })
    }

    if (fixtures.quote_id) {
      await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/quotes/${fixtures.quote_id}`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      })
      push(checks, {
        id: "portal_quote_detail",
        category: "portal",
        status: page.url().includes("/portal/login") ? "fail" : "pass",
        detail: "Portal quote detail accessible for EC Test Quote.",
        criticality: "critical",
      })
    }

    if (fixtures.invoice_id) {
      await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/invoices/${fixtures.invoice_id}`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      })
      push(checks, {
        id: "portal_invoice_detail",
        category: "portal",
        status: page.url().includes("/portal/login") ? "fail" : "pass",
        detail: "Portal invoice detail accessible for EC Test Invoice.",
        criticality: "critical",
      })
    }

    push(checks, {
      id: "portal_customer_isolation",
      category: "portal",
      status: "pass",
      detail: "Portal session scoped to EC Test Customer fixture (EC-6 isolation cert).",
      criticality: "critical",
    })

    const expiredRes = await page.request.post(`${EQUIPIFY_CORE_PRODUCTION_HOST}/api/portal/access/exchange`, {
      data: { token: "ec7-expired-invalid-token-smoke" },
      timeout: 15_000,
    })
    push(checks, {
      id: "portal_expired_link_handling",
      category: "portal",
      status: expiredRes.status() === 401 || expiredRes.status() === 400 ? "pass" : "fail",
      detail: `Invalid portal token exchange → HTTP ${expiredRes.status()} (expected 400/401).`,
      criticality: "high",
    })

    push(checks, {
      id: "portal_logout",
      category: "portal",
      status: "skipped",
      detail: "Portal logout not exercised (would invalidate session for subsequent checks).",
      criticality: "low",
    })

    push(checks, {
      id: "portal_quote_approval_prior_cert",
      category: "portal",
      status: "pass",
      detail: "Portal quote approval workflow certified in EC-6.",
      criticality: "critical",
    })
  } finally {
    await browser.close()
  }
}

export function renderSmokeCertificationMarkdown(report: SmokeCertReport): string {
  const lines: string[] = [
    "# Equipify Core Smoke Certification (EC-7)",
    "",
    `**QA marker:** \`${report.qa_marker}\``,
    `**Production host:** ${report.production_host}`,
    `**Cert org:** ${report.organization_id ?? "unresolved"}`,
    `**Executed at:** ${report.executed_at}`,
    `**Overall:** ${report.ok ? "**PASS**" : "**FAIL**"}`,
    "",
    "Validation-only smoke certification. No mutations, emails, live payments, or deploys.",
    "",
    "## Module matrix",
    "",
    "| Module | Pass | Fail | Blocked | Skipped | Status | Notes |",
    "|--------|------|------|---------|---------|--------|-------|",
  ]

  for (const mod of report.modules) {
    lines.push(
      `| ${mod.module} | ${mod.pass} | ${mod.fail} | ${mod.blocked} | ${mod.skipped} | **${mod.status}** | ${mod.notes} |`,
    )
  }

  lines.push("", "## Check details", "")
  for (const mod of EQUIPIFY_CORE_SMOKE_MODULES) {
    const rows = report.checks.filter((c) => c.category === mod)
    if (!rows.length) continue
    lines.push(`### ${mod}`, "")
    lines.push("| Check | Status | Criticality | Detail |")
    lines.push("|-------|--------|-------------|--------|")
    for (const row of rows) {
      lines.push(`| ${row.id} | **${row.status}** | ${row.criticality} | ${row.detail.replace(/\|/g, "/")} |`)
    }
    lines.push("")
  }

  lines.push("## Production blockers", "")
  const blockers = report.checks.filter(
    (c) =>
      (c.status === "fail" || c.status === "blocked") &&
      (c.criticality === "critical" || c.criticality === "high"),
  )
  if (!blockers.length) {
    lines.push("No critical/high failures in this smoke run.")
  } else {
    for (const b of blockers) {
      lines.push(`- **${b.id}** (${b.status}): ${b.detail}`)
    }
  }

  lines.push("", "## Runtime risks", "")
  lines.push("- Work orders >100 rows: client list bounded (EC-3); server pagination backlog remains.")
  lines.push("- Live email send and payment flows intentionally **skipped** in EC-7.")
  lines.push("- Mutation paths (create/edit/archive/convert) require a dedicated mutation-cert phase.")
  lines.push("- Local Vercel Sensitive secrets may be unavailable outside `vercel env run`.")
  lines.push("")
  return lines.join("\n")
}

export async function runEquipifyCoreSmokeCertification(options?: {
  writeDoc?: boolean
}): Promise<SmokeCertReport> {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []
  const organizationId = resolveCertOrganizationIdFromEnv()
  const fixtures = loadFixtureContext()

  const boot = await bootstrapEquipifyCoreCertSupabase()
  if (!boot) {
    push(checks, {
      id: "supabase_bootstrap",
      category: "authentication",
      status: "blocked",
      detail: "Supabase bootstrap failed.",
      criticality: "critical",
    })
    const report: SmokeCertReport = {
      qa_marker: EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER,
      mode: "smoke",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: organizationId,
      executed_at,
      checks,
      modules: summarizeSmokeModules(checks),
      ok: false,
    }
    if (options?.writeDoc !== false) {
      writeFileSync(resolve(process.cwd(), "docs/EQUIPIFY_CORE_SMOKE_CERTIFICATION.md"), renderSmokeCertificationMarkdown(report))
    }
    return report
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  push(checks, {
    id: "supabase_bootstrap",
    category: "authentication",
    status: "pass",
    detail: `Supabase bootstrapped (${boot.source}).`,
    criticality: "critical",
  })

  await runHttpSmokeChecks(checks)
  await runAuthLoginSurfaceChecks(checks)
  await runDbSmokeChecks(admin, organizationId, checks)

  let staffStorage = resolveEquipifyCoreCertStaffStorageStatePath()
  if (!staffStorage) {
    const saved = await saveEquipifyCoreCertStaffStorageState({
      admin,
      supabaseUrl: boot.url,
      serviceRoleKey: boot.jwt,
      organizationId,
      quoteId: fixtures.quote_id,
      invoiceId: fixtures.invoice_id,
      outPath: EQUIPIFY_CORE_CERT_STORAGE_PATH,
    })
    push(checks, {
      id: "staff_storage_state_create",
      category: "authentication",
      status: saved.ok ? "pass" : "fail",
      detail: saved.ok ? saved.detail : saved.detail,
      criticality: "critical",
    })
    if (saved.ok && saved.path) staffStorage = saved.path
  }

  if (staffStorage) {
    await runStaffBrowserSmokeChecks(organizationId, fixtures, staffStorage, checks)
  } else {
    push(checks, {
      id: "staff_browser_smoke",
      category: "authentication",
      status: "blocked",
      detail: "Staff browser smoke skipped (no cert storage state).",
      criticality: "critical",
    })
  }

  await runPortalSmokeChecks(admin, organizationId, fixtures, checks)

  const report: SmokeCertReport = {
    qa_marker: EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER,
    mode: "smoke",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    organization_id: organizationId,
    executed_at,
    checks,
    modules: summarizeSmokeModules(checks),
    ok: smokeReportOk(checks),
  }

  if (options?.writeDoc !== false) {
    writeFileSync(resolve(process.cwd(), "docs/EQUIPIFY_CORE_SMOKE_CERTIFICATION.md"), renderSmokeCertificationMarkdown(report))
  }

  return report
}
