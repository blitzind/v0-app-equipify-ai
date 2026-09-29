/**
 * Customer portal magic-link completion — URL safety, mint/redeem, invoice email CTA.
 * Run: pnpm test:portal-magic-link
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { sha256Hex } from "../lib/portal/token-hash"
import { mintPortalAccessLink, generateRawPortalAccessToken } from "../lib/portal/mint-portal-access-link"
import { redeemPortalAccessToken } from "../lib/portal/redeem-portal-access-link"
import { buildPortalAccessLoginUrl } from "../lib/portal/build-portal-access-url"
import {
  isSafePortalNextPath,
  sanitizePortalNext,
  portalInvoicePath,
} from "../lib/portal/safe-portal-next"
import { PORTAL_ACCESS_LINK_MAX_USES, PORTAL_DASHBOARD_PATH } from "../lib/portal/constants"
import { buildInvoiceCustomerEmailFromTemplate } from "../lib/email/invoice-customer-email-html"
import { buildPortalAccessEmailContent } from "../lib/email/portal-access-email"

const ORG = "00000000-0000-4000-8000-000000000001"
const CUST_A = "00000000-0000-4000-8000-00000000000a"
const CUST_B = "00000000-0000-4000-8000-00000000000b"
const INVOICE_A = "00000000-0000-4000-8000-0000000000aa"
const INVOICE_B = "00000000-0000-4000-8000-0000000000bb"
const USER_A = "00000000-0000-4000-8000-0000000000c1"
const ORIGIN = "https://app.equipify.ai"

function root(...parts: string[]) {
  return join(process.cwd(), ...parts)
}

function read(rel: string) {
  return readFileSync(root(rel), "utf8")
}

function testSafeNext() {
  assert.equal(isSafePortalNextPath("/portal/invoices/" + INVOICE_A), true)
  assert.equal(isSafePortalNextPath("/portal/dashboard"), true)
  assert.equal(isSafePortalNextPath("/portal/invoices/" + INVOICE_A + "?blitzpay=1"), true)
  assert.equal(isSafePortalNextPath("https://evil.com"), false)
  assert.equal(isSafePortalNextPath("//evil.com"), false)
  assert.equal(isSafePortalNextPath("/portal/login"), false)
  assert.equal(isSafePortalNextPath("/portal/login?token=abc"), false)
  assert.equal(isSafePortalNextPath("/login"), false)
  assert.equal(sanitizePortalNext(" /portal/dashboard "), PORTAL_DASHBOARD_PATH)
  assert.equal(sanitizePortalNext("//evil"), null)
}

function testUrlBuilder() {
  const raw = "test-token-value"
  const url = buildPortalAccessLoginUrl({
    rawToken: raw,
    next: portalInvoicePath(INVOICE_A),
    origin: ORIGIN,
  })
  const parsed = new URL(url)
  assert.equal(parsed.origin, ORIGIN)
  assert.equal(parsed.pathname, "/portal/login")
  assert.equal(parsed.searchParams.get("token"), raw)
  assert.equal(parsed.searchParams.get("next"), `/portal/invoices/${INVOICE_A}`)
  assert.equal(parsed.searchParams.get("token") === raw && parsed.searchParams.has("next"), true)
}

function testTokenHashNeverEqualsRaw() {
  const raw = generateRawPortalAccessToken()
  const hash = sha256Hex(raw)
  assert.ok(raw.length >= 32)
  assert.equal(hash.length, 64)
  assert.notEqual(raw, hash)
  assert.equal(sha256Hex(raw), hash)
}

function invoiceEmailArgs(viewInvoiceUrl: string) {
  return {
    organizationName: "Acme",
    customerName: "Riverstone Imaging Center",
    invoiceLabel: "INV-AR-PBS-7010",
    amountDueLabel: "$10.00",
    grandTotalLabel: "$10.00",
    dueDateLabel: "Oct 1, 2026",
    issuedDateLabel: "Sep 29, 2026",
    statusDisplay: "Sent",
    pdfAttached: true,
    balanceDueCents: 1000,
    variant: "send" as const,
    viewInvoiceUrl,
  }
}

function testInvoiceEmailContainsMagicLink() {
  const accessUrl = buildPortalAccessLoginUrl({
    rawToken: "invoice-raw-token",
    next: portalInvoicePath(INVOICE_A),
    origin: ORIGIN,
  })
  for (const variant of ["send", "resend", "reminder"] as const) {
    const built = buildInvoiceCustomerEmailFromTemplate({ ...invoiceEmailArgs(accessUrl), variant })
    assert.equal(built.html.includes("View invoice"), true)
    assert.equal(built.html.includes("/portal/login?"), true)
    assert.equal(built.html.includes("token="), true)
    assert.equal(built.html.includes(INVOICE_A), true)
    assert.equal(built.text.includes("invoice-raw-token") || built.text.includes(accessUrl), true)
    assert.equal(built.html.includes(`${ORIGIN}/portal/invoices/${INVOICE_A}"`), false)
  }
}

function testPortalAccessEmail() {
  const accessUrl = buildPortalAccessLoginUrl({
    rawToken: "invite-raw-token",
    next: PORTAL_DASHBOARD_PATH,
    origin: ORIGIN,
  })
  const built = buildPortalAccessEmailContent({
    organizationName: "Acme",
    customerName: "Riverstone Imaging Center",
    accessUrl,
    expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
  })
  assert.equal(built.html.includes("Open customer portal"), true)
  assert.equal(built.html.includes("invite-raw-token"), true)
  assert.equal(built.text.includes(accessUrl) || built.text.includes("invite-raw-token"), true)
}

type LinkRow = {
  id: string
  organization_id: string
  portal_user_id: string
  token_hash: string
  kind: string
  expires_at: string
  max_uses: number
  use_count: number
  revoked_at: string | null
}

type UserRow = {
  id: string
  organization_id: string
  customer_id: string
  email: string
  display_name: string | null
  status: string
  activated_at: string | null
}

function createMemoryPortalClient(seed?: { users?: UserRow[]; links?: LinkRow[]; orgStatus?: string }) {
  const customers = [
    { id: CUST_A, organization_id: ORG, archived_at: null },
    { id: CUST_B, organization_id: ORG, archived_at: null },
  ]
  const users: UserRow[] = seed?.users ? [...seed.users] : []
  const links: LinkRow[] = seed?.links ? [...seed.links] : []
  const orgStatus = seed?.orgStatus ?? "active"

  function matches(row: Record<string, unknown>, filters: Array<{ k: string; v: unknown; op: string }>) {
    return filters.every((f) => {
      const val = row[f.k]
      if (f.op === "eq") return val === f.v
      if (f.op === "is") return (val ?? null) === f.v
      if (f.op === "in") return Array.isArray(f.v) && f.v.includes(val)
      return true
    })
  }

  const client = {
    _users: () => users,
    _links: () => links,
    from(table: string) {
      const filters: Array<{ k: string; v: unknown; op: string }> = []
      let mode: "select" | "insert" | "update" = "select"
      let insertPayload: Record<string, unknown> | null = null
      let updatePayload: Record<string, unknown> | null = null
      const chain = {
        select() {
          return chain
        },
        insert(row: Record<string, unknown>) {
          mode = "insert"
          insertPayload = row
          return chain
        },
        update(row: Record<string, unknown>) {
          mode = "update"
          updatePayload = row
          return chain
        },
        eq(k: string, v: unknown) {
          filters.push({ k, v, op: "eq" })
          return chain
        },
        is(k: string, v: unknown) {
          filters.push({ k, v, op: "is" })
          return chain
        },
        in(k: string, v: unknown) {
          filters.push({ k, v, op: "in" })
          return chain
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(run(true)).then(onFulfilled, onRejected)
        },
        async maybeSingle() {
          return run(true)
        },
        async single() {
          return run(false)
        },
      }
      function run(maybe: boolean) {
        if (table === "customers") {
          const row = customers.find((c) => matches(c as unknown as Record<string, unknown>, filters)) ?? null
          return { data: row, error: row || maybe ? null : { message: "not found" } }
        }
        if (table === "organizations") {
          return { data: { status: orgStatus }, error: null }
        }
        if (table === "portal_users") {
          if (mode === "insert" && insertPayload) {
            const id = (insertPayload.id as string) || USER_A
            const row: UserRow = {
              id,
              organization_id: insertPayload.organization_id as string,
              customer_id: insertPayload.customer_id as string,
              email: insertPayload.email as string,
              display_name: (insertPayload.display_name as string | null) ?? null,
              status: (insertPayload.status as string) ?? "pending",
              activated_at: (insertPayload.activated_at as string | null) ?? null,
            }
            users.push(row)
            return { data: { id }, error: null }
          }
          if (mode === "update" && updatePayload) {
            const row = users.find((u) => matches(u as unknown as Record<string, unknown>, filters))
            if (row) Object.assign(row, updatePayload)
            return { data: row ?? null, error: null }
          }
          const row = users.find((u) => matches(u as unknown as Record<string, unknown>, filters)) ?? null
          return { data: row, error: null }
        }
        if (table === "portal_access_links") {
          if (mode === "insert" && insertPayload) {
            const row: LinkRow = {
              id: `link-${links.length + 1}`,
              organization_id: insertPayload.organization_id as string,
              portal_user_id: insertPayload.portal_user_id as string,
              token_hash: insertPayload.token_hash as string,
              kind: insertPayload.kind as string,
              expires_at: insertPayload.expires_at as string,
              max_uses: insertPayload.max_uses as number,
              use_count: (insertPayload.use_count as number) ?? 0,
              revoked_at: (insertPayload.revoked_at as string | null) ?? null,
            }
            links.push(row)
            return { data: row, error: null }
          }
          if (mode === "update" && updatePayload) {
            const row = links.find((l) => matches(l as unknown as Record<string, unknown>, filters))
            if (!row) return { data: null, error: null }
            Object.assign(row, updatePayload)
            return { data: { id: row.id }, error: null }
          }
          const row = links.find((l) => matches(l as unknown as Record<string, unknown>, filters)) ?? null
          return { data: row, error: null }
        }
        return { data: null, error: { message: `unknown table ${table}` } }
      }
      return chain
    },
  }
  return client
}

async function testMintPersistsHashNotRaw() {
  const db = createMemoryPortalClient()
  const minted = await mintPortalAccessLink({
    supabase: db as never,
    organizationId: ORG,
    customerId: CUST_A,
    email: "billing@riverstone.example",
    displayName: "Riverstone",
    kind: "magic_login",
    next: portalInvoicePath(INVOICE_A),
  })
  assert.equal(minted.ok, true)
  if (!minted.ok) return
  assert.equal(minted.kind, "magic_login")
  const stored = db._links()[0]
  assert.ok(stored)
  assert.equal(stored.token_hash, minted.tokenHash)
  assert.notEqual(stored.token_hash, minted.rawToken)
  assert.equal(stored.token_hash.includes(minted.rawToken), false)
  JSON.stringify(stored)
  assert.equal(JSON.stringify(stored).includes(minted.rawToken), false)
  assert.equal(stored.max_uses, PORTAL_ACCESS_LINK_MAX_USES)
  assert.equal(stored.use_count, 0)
  assert.equal(stored.portal_user_id, minted.portalUserId)
  const url = new URL(minted.accessUrl)
  assert.equal(url.pathname, "/portal/login")
  assert.equal(url.searchParams.get("token"), minted.rawToken)
  assert.equal(url.searchParams.get("next"), portalInvoicePath(INVOICE_A))
}

async function testRedeemValidThenAtomicReject() {
  const raw = generateRawPortalAccessToken()
  const hash = sha256Hex(raw)
  const db = createMemoryPortalClient({
    users: [
      {
        id: USER_A,
        organization_id: ORG,
        customer_id: CUST_A,
        email: "billing@riverstone.example",
        display_name: "Riverstone",
        status: "pending",
        activated_at: null,
      },
    ],
    links: [
      {
        id: "link-1",
        organization_id: ORG,
        portal_user_id: USER_A,
        token_hash: hash,
        kind: "magic_login",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        max_uses: 1,
        use_count: 0,
        revoked_at: null,
      },
    ],
  })

  const first = await redeemPortalAccessToken(db as never, raw)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.portalUser.customer_id, CUST_A)
  assert.equal(first.portalUser.organization_id, ORG)
  assert.equal(db._links()[0]!.use_count, 1)

  const second = await redeemPortalAccessToken(db as never, raw)
  assert.equal(second.ok, false)
  if (second.ok) return
  assert.equal(second.status, 401)
}

async function testExpiredInvalidRevoked() {
  const raw = generateRawPortalAccessToken()
  const hash = sha256Hex(raw)

  const expired = await redeemPortalAccessToken(
    createMemoryPortalClient({
      users: [
        {
          id: USER_A,
          organization_id: ORG,
          customer_id: CUST_A,
          email: "a@example.com",
          display_name: null,
          status: "active",
          activated_at: new Date().toISOString(),
        },
      ],
      links: [
        {
          id: "link-exp",
          organization_id: ORG,
          portal_user_id: USER_A,
          token_hash: hash,
          kind: "invite",
          expires_at: new Date(Date.now() - 1000).toISOString(),
          max_uses: 1,
          use_count: 0,
          revoked_at: null,
        },
      ],
    }) as never,
    raw,
  )
  assert.equal(expired.ok, false)

  const invalid = await redeemPortalAccessToken(createMemoryPortalClient() as never, "not-a-real-token")
  assert.equal(invalid.ok, false)

  const revokedLink = await redeemPortalAccessToken(
    createMemoryPortalClient({
      users: [
        {
          id: USER_A,
          organization_id: ORG,
          customer_id: CUST_A,
          email: "a@example.com",
          display_name: null,
          status: "active",
          activated_at: new Date().toISOString(),
        },
      ],
      links: [
        {
          id: "link-rev",
          organization_id: ORG,
          portal_user_id: USER_A,
          token_hash: hash,
          kind: "invite",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          max_uses: 1,
          use_count: 0,
          revoked_at: new Date().toISOString(),
        },
      ],
    }) as never,
    raw,
  )
  assert.equal(revokedLink.ok, false)

  const revokedUser = await redeemPortalAccessToken(
    createMemoryPortalClient({
      users: [
        {
          id: USER_A,
          organization_id: ORG,
          customer_id: CUST_A,
          email: "a@example.com",
          display_name: null,
          status: "revoked",
          activated_at: new Date().toISOString(),
        },
      ],
      links: [
        {
          id: "link-ok",
          organization_id: ORG,
          portal_user_id: USER_A,
          token_hash: hash,
          kind: "invite",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          max_uses: 1,
          use_count: 0,
          revoked_at: null,
        },
      ],
    }) as never,
    raw,
  )
  assert.equal(revokedUser.ok, false)
  if (!revokedUser.ok) assert.equal(revokedUser.status, 403)
}

function testSourceWiring() {
  const dispatch = read("lib/invoices/dispatch-customer-invoice-email.ts")
  assert.equal(dispatch.includes("mintPortalAccessLink"), true)
  assert.equal(dispatch.includes('kind: "magic_login"'), true)
  assert.equal(dispatch.includes("/portal/invoices/${encodeURIComponent(args.invoiceId)}"), false)

  const exchange = read("app/api/portal/access/exchange/route.ts")
  assert.equal(exchange.includes("export async function GET"), false)
  assert.equal(exchange.includes("redeemPortalAccessToken"), true)
  assert.equal(exchange.includes(".eq(\"use_count\""), false)

  const redeemSrc = read("lib/portal/redeem-portal-access-link.ts")
  assert.equal(redeemSrc.includes('.eq("use_count", row.use_count)'), true)
  assert.equal(redeemSrc.includes("GET of the email URL never reaches this function"), true)

  const login = read("app/(portal)/portal/login/page.tsx")
  assert.equal(login.includes('fetch("/api/portal/access/exchange"'), true)
  assert.equal(login.includes("sanitizePortalNext"), true)

  const gate = read("lib/portal/middleware-gate.ts")
  assert.equal(gate.includes('pathname === "/portal/login"'), true)
  assert.equal(/if \(pathname\.startsWith\("\/portal\/pay"/.test(gate), false)

  const invites = read("app/api/organizations/[organizationId]/portal-invites/route.ts")
  assert.equal(invites.includes("mintPortalAccessLink"), true)
  assert.equal(invites.includes("request.headers.get(\"origin\")"), false)
  assert.equal(invites.includes("getPublicAppOrigin"), true)

  const drawer = read("components/drawers/customer-drawer.tsx")
  assert.equal(drawer.includes("Send Portal Access"), true)
  assert.equal(drawer.includes("Copy Secure Portal Link"), true)
  assert.equal(drawer.includes("tryOpenStaffPortalPreviewInNewTab"), true)
  assert.equal(drawer.includes("disabled\n                aria-disabled"), false)

  const invoiceDrawer = read("components/drawers/invoice-detail-view.tsx")
  assert.equal(invoiceDrawer.includes("customer-portal-link"), true)
  assert.equal(invoiceDrawer.includes("Copy Customer Invoice Link"), true)
}

function testIsolationCommentContract() {
  const invoiceApi = read("app/api/portal/invoices/[invoiceId]/route.ts")
  assert.equal(invoiceApi.includes("requirePortalSession"), true)
  assert.equal(invoiceApi.includes(".eq(\"customer_id\", custId)"), true)
  assert.equal(invoiceApi.includes(".eq(\"organization_id\", orgId)"), true)
  assert.equal(invoiceApi.includes("Invoice not found."), true)

  const nextA = portalInvoicePath(INVOICE_A)
  const nextB = portalInvoicePath(INVOICE_B)
  assert.notEqual(nextA, nextB)
  assert.equal(nextA.includes(CUST_B), false)
}

async function main() {
  testSafeNext()
  testUrlBuilder()
  testTokenHashNeverEqualsRaw()
  testInvoiceEmailContainsMagicLink()
  testPortalAccessEmail()
  await testMintPersistsHashNotRaw()
  await testRedeemValidThenAtomicReject()
  await testExpiredInvalidRevoked()
  testSourceWiring()
  testIsolationCommentContract()
  console.log("portal magic-link tests passed")
}

void main()
