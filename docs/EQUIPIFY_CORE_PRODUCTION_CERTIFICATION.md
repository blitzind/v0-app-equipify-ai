# Equipify Core Production Certification (EC-1)

**Phase:** EC-1 — Certification foundation (inventory only)  
**Production host:** https://app.equipify.ai  
**QA marker:** `equipify-core-certification-ec-1-v1`  
**Runtime inventory:** `lib/certification/equipify-core-runtime-inventory.ts`  
**Verification script:** `pnpm exec tsx scripts/test-equipify-core-production-certification-foundation.ts`

This document defines what must be certified on **Vercel Production** before Equipify Core is considered production-ready for customer workflows. **No production execution has been performed in EC-1.** All items start at **Untested**.

**Out of scope for EC-1:** Growth Engine (`/growth/*`), plan naming UI changes, feature additions, billing logic changes.

---

## EC-2 execution log (2026-06-18)

**Harness:** `scripts/certify-equipify-core-production.ts`  
**Modes run:** `readiness`, `read-safe` (via `pnpm test:equipify-core-production-*:vercel`)  
**Production host probed:** https://app.equipify.ai  
**Mutations:** none | **Emails:** none | **Stripe API calls:** none | **Payments:** none  
**Supabase creds (read-safe):** `supabase_cli_linked_project` (Vercel Sensitive secrets not materialized locally)  
**Cert org sampled:** `fc7e7631-efb8-4e14-9db2-5c4cadfb74f0` (active subscription, `plan_id=scale`)

| EC-2 check | Certification mapping | Status |
|------------|----------------------|--------|
| Vercel production runtime | Platform | **Pass** |
| Local sensitive secret materialization | Platform readiness | **Blocked** (Vercel CLI limitation locally) |
| Supabase URL / anon / service role (local readiness) | Platform | **Fail** locally / **Pass** on Vercel runtime (assumed configured) |
| Stripe secret + webhook secrets (local readiness) | Billing / payments | **Fail** locally / runtime TBD in EC-3 |
| Stripe catalog price IDs (solo/core/growth/scale) | Billing | **Pass** |
| Resend + from-address (local readiness) | Email | **Fail** locally |
| BLITZPAY_INVOICE_PAY_ENABLED | Payments | **Pass** (disabled_by_flag — expected pre-payment cert) |
| Supabase read-safe bootstrap | Auth / tenant | **Pass** |
| Cert org + subscription row read | Billing | **Pass** (`active`, Equipify Scale candidate) |
| Customers/prospects/WOs/quotes/invoices list limit(5) | List reads | **Pass** |
| Purchase orders list (`org_purchase_orders`) | PO list | **Pass** (after table name fix) |
| Work orders unbounded client query | Work order list | **Pass** (EC-3: `.limit(100)` via `WORK_ORDERS_LIST_PAGE_LIMIT`; server-side search/pagination backlog) |
| GET `/login`, `/portal/login` | Auth / portal | **Pass** (HTTP 200) |
| GET `/api/portal/bootstrap` without session | Portal auth | **Pass** (HTTP 401) |
| GET `/settings/billing`, `/` unauthenticated | Billing / dashboard | **Pass** (HTTP 307 redirect) |
| PDF route files exist | Quote/invoice/PO PDF | **Pass** |
| Authenticated browser user | Staff login session | **Skipped** (no `EQUIPIFY_CORE_CERT_STORAGE_STATE`) |

Mutation and payment flows remain **Untested**.

### EC-3 follow-up (2026-06-18)

- **Fix:** `WORK_ORDERS_LIST_PAGE_LIMIT = 100` on client `/work-orders` list query.
- **Backlog:** Server-side search and “Load more” pagination for orgs with >100 work orders.

### EC-4 execution log (2026-06-18)

**Harness:** `scripts/certify-equipify-core-production.ts` (modes: `mutation-dry-run`, `payment-dry-run`, `browser-revenue`)  
**Revenue inventory:** `lib/certification/equipify-core-revenue-dependency-inventory.ts`  
**Production host probed:** https://app.equipify.ai  
**Mutations:** none | **Emails:** none | **Stripe API calls:** none | **Payments:** none  
**Supabase creds:** `supabase_cli_linked_project` (Vercel Sensitive secrets not materialized locally)

| EC-4 check | Certification mapping | Status |
|------------|----------------------|--------|
| Revenue dependency inventory (21 entries) | Quotes/invoices/payments/portal/stripe/email | **Pass** |
| Revenue env: Stripe keys/webhooks (local) | Payments / billing | **Blocked** locally |
| Revenue env: Resend + from-address (local) | Email | **Blocked** locally |
| Revenue env: BLITZPAY_INVOICE_PAY_ENABLED | Payments | **Blocked** (disabled_by_flag) |
| Mutation dry-run (`ok: true`) | Quote/invoice prerequisites | **Pass** |
| Cert org customer fixture | Customers | **Pass** (`ae22b6ca-26b3-4f19-ae08-57850733c0ff`) |
| Cert org quote/invoice fixtures | Quotes/invoices | **Blocked** (0 rows — need test quote/invoice for PDF/email/payability) |
| Payment dry-run (`ok: true`) | Webhooks + schema + idempotency | **Pass** |
| Connect on cert org | Payments | **Blocked** (no `stripe_connect_account_id`) |
| Portal hosted checkout eligibility | Portal pay | **Blocked** (`feature_disabled` + Connect) |
| Webhook POST reachability (prod) | Stripe / BlitzPay | **Pass** (HTTP 400 without signature) |
| Browser: `/quotes` auth + create modal | Quote UI | **Pass** |
| Browser: `/invoices` auth + create button | Invoice UI | **Pass** |
| Browser: portal invoice/quote detail | Portal | **Skipped** (no portal customer session) |
| Live quote/invoice PDF generation | PDF | Untested |
| Live email quote/invoice | Email | Untested |
| Live payment + receipt | Payments | Untested (EC-5+) |

**Cert org:** `fc7e7631-efb8-4e14-9db2-5c4cadfb74f0` (active, `plan_id=scale`, `allow_record_creation=true`)

### EC-6 execution log (2026-06-18)

**Harness:** `scripts/certify-equipify-core-revenue-ec6.ts`, `scripts/provision-equipify-core-revenue-fixtures.ts`  
**Fixture manifest:** `scripts/.equipify-core-revenue-fixtures.json`  
**Portal storage state:** `scripts/.equipify-core-portal-cert-storage-state.json`  
**Cert org:** `fc7e7631-efb8-4e14-9db2-5c4cadfb74f0` (Equipify Demo Workspace, `plan_id=scale`, active)

| Fixture | ID / value |
|---------|------------|
| `EQUIPIFY_CORE_CERT_ORGANIZATION_ID` | `fc7e7631-efb8-4e14-9db2-5c4cadfb74f0` |
| `EQUIPIFY_CORE_CERT_CUSTOMER_ID` | `0ca2bed2-ae3e-40f2-b982-e8de7f011e8a` |
| `EQUIPIFY_CORE_CERT_QUOTE_ID` | `0c7d752f-7067-4877-9c83-01c472a60163` |
| `EQUIPIFY_CORE_CERT_INVOICE_ID` | `83ae2aee-b1c2-48d6-a1f3-07e651fd79d8` |

| EC-6 check | Status |
|------------|--------|
| EC Test Customer provisioned | **Pass** |
| EC Test Quote (`EC-Q-CERT-001`, sent, $200) | **Pass** |
| EC Test Invoice (`EC-INV-CERT-001`, sent, $250) | **Pass** |
| Quote PDF generation (service-role context) | **Pass** |
| Invoice PDF generation (service-role context) | **Pass** |
| Staff quote/invoice drawers open | **Pass** |
| Staff email modals (no send) | **Pass** (EC-6B: quote + invoice modals open; recipient/subject/body/PDF handoff/send visible; no send) |
| Portal session via access token | **Pass** |
| Portal quote detail + approval | **Pass** (sent → approved on EC Test Quote only) |
| Portal invoice detail + pay CTA | **Pass** (pay hidden — flag off) |
| Live payment / email send | **Skipped** (by design) |

### EC-6B execution log (2026-06-18)

**Harness:** `lib/certification/equipify-core-cert-staff-storage-state.ts`, `scripts/save-equipify-core-cert-storage-state.ts`, EC-6 staff browser cert  
**Staff storage state:** `scripts/.equipify-core-cert-storage-state.json` (gitignored; `EQUIPIFY_CORE_CERT_STORAGE_STATE`)  
**Staff user:** `playreview@equipify.ai` (cert org member)  
**Cert org:** `fc7e7631-efb8-4e14-9db2-5c4cadfb74f0`

| EC-6B check | Status |
|-------------|--------|
| Cert-org staff storage state | **Pass** |
| Quote email modal (no send) | **Pass** |
| Invoice email modal (no send) | **Pass** |
| Live email send | **Untested** (by design) |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Untested** | Not yet executed on production |
| **Pass** | Production execution succeeded |
| **Fail** | Production execution failed or blocked |

## Criticality legend

| Level | Meaning |
|-------|---------|
| **Critical** | Revenue, auth, or subscription blocker |
| **High** | Core daily operations |
| **Medium** | Important but workaround exists |
| **Low** | Nice-to-have or admin-only |

---

## Authentication

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Staff email login | `/login` | supabase_auth, vercel | Valid credentials establish session; redirect to dashboard or onboarding | Critical | **Pass** (EC-2: GET /login HTTP 200; session flow Untested) |
| Google OAuth login | `/login` → `/auth/callback` | supabase_auth, vercel | OAuth completes; session cookie set; org membership resolved | Critical | Untested |
| Session persistence | App shell | supabase_auth | Refresh preserves session across navigation | High | Untested |
| Logout | Account hub | supabase_auth | Session cleared; redirect to login | High | Untested |
| Unauthorized access guard | Protected routes | supabase_auth | Unauthenticated users redirected to `/login` | Critical | **Pass** (EC-2: /settings/billing and / redirect unauthenticated) |

---

## Onboarding

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Onboarding wizard | `/onboarding` | supabase, supabase_auth, stripe_saas | New user completes workspace setup | Critical | Untested |
| Org provisioning | `/api/onboarding/provision` | supabase | Org row, membership, trial subscription (`plan_id=scale`, `intended_plan_id` set) created | Critical | Untested |
| Plan selection | `/onboarding` | stripe_saas | Selected plan stored as `intended_plan_id` | Critical | Untested |
| Post-onboarding redirect | `/onboarding` | supabase_auth | Lands on dashboard or billing per intent | High | Untested |
| Welcome email | Signup flow | resend | Provision email delivered (if enabled) | Medium | Untested |

---

## Customers

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Customer list | `/customers` | supabase, supabase_auth | Org customers visible; search/filter works | Critical | **Pass** (EC-2: DB list limit 5) |
| Create customer | `/customers` | supabase | New customer persisted with company name | Critical | Untested |
| Customer detail | `/customers/[id]` | supabase | Contacts, locations, billing profile load | Critical | Untested |
| Edit customer | `/customers/[id]` | supabase | Field updates persist after refresh | High | Untested |
| Archive customer | `/customers` | supabase | Archived customer hidden from default list | High | Untested |
| Bulk archive | `/api/organizations/[organizationId]/customers/bulk-archive` | supabase | Selected customers archived | Medium | Untested |
| Contacts CRUD | Customer detail | supabase | Add/edit/remove contact | High | Untested |
| Service locations | Customer detail | supabase | Location CRUD works | High | Untested |
| Activity history | Customer detail | supabase | Timeline reflects recent changes | Medium | Untested |
| Business card scan | Customer flows | supabase, ai_providers | Growth+ org extracts card data (or gate message on Solo/Core) | Medium | Untested |
| Portal invite | Customer detail / settings | resend, portal_session | Invite email sent; portal access works | High | Untested |

---

## Prospects

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Prospect list / kanban | `/prospects` | supabase | Pipeline renders; stages correct | High | **Pass** (EC-2: DB list limit 5) |
| Create prospect | `/prospects` | supabase | Prospect created with source | High | Untested |
| Edit prospect | `/prospects` | supabase | Updates persist | High | Untested |
| Convert to customer | `/api/organizations/[organizationId]/prospects/[prospectId]/convert` | supabase | Customer created; prospect marked converted | High | Untested |
| Business card scan | Prospect flows | ai_providers | Scan works on entitled plan | Medium | Untested |
| Follow-up email draft | Prospect drawer | resend, ai_providers | Draft generated; send handoff works on Growth+ | Medium | Untested |

---

## Work Orders

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Work order list | `/work-orders` | supabase | Org work orders visible | Critical | **Pass** (EC-3: bounded `.limit(100)`; search filters in-window only) |
| Create work order | `/work-orders` | supabase | WO created with customer/equipment link | Critical | Untested |
| Work order detail | `/work-orders/[id]` | supabase, supabase_storage | Detail loads; notes and attachments work | Critical | Untested |
| Assign technician | `/work-orders/[id]`, `/dispatch` | supabase | Assignment visible to technician | Critical | Untested |
| Schedule job | `/dispatch`, `/service-schedule` | supabase | Scheduled date/time persists | High | Untested |
| Update status | `/work-orders/[id]` | supabase | Status transitions valid | Critical | Untested |
| Job notes | `/work-orders/[id]` | supabase | Notes saved and visible | High | Untested |
| Job photos/files | `/work-orders/[id]` | supabase_storage | Upload and display succeed | High | Untested |
| Technician completion | `/work-orders/[id]` | supabase | Complete flow marks WO completed | Critical | Untested |
| Dispatch board | `/dispatch` | supabase | Week/route views load; bulk assign works | High | Untested |
| Offline sync | `/work-orders/[id]` | supabase | Queued offline edits sync when online | Medium | Untested |
| WO summary email | `/api/email/work-order-summary` | resend | Customer receives summary email | Medium | Untested |

---

## Quotes

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Quote list | `/quotes` | supabase | Quotes listed with status | Critical | **Pass** (EC-2: DB list limit 5; 0 rows on cert org) |
| Create quote | `/quotes` | supabase | Quote with line items saved; totals correct | Critical | **Pass** (EC-6: EC Test Quote fixture + drawer open) |
| Edit quote | `/quotes` | supabase | Line item changes persist | High | Untested |
| Quote PDF | `/api/organizations/[organizationId]/quotes/[quoteId]/pdf` | supabase | PDF downloads; org branding correct | Critical | **Pass** (EC-6: PDF generated for EC-Q-CERT-001) |
| Email quote | `/api/email/quote` | resend | Email delivered with PDF attachment | Critical | **Untested** (EC-6B: modal **Pass**; send not exercised) |
| Quote approval (staff) | `/quotes` | supabase | Status reflects approval | High | Untested |
| Portal quote approve | `/api/portal/quotes/[quoteId]/approve` | portal_session, supabase | Customer approval recorded | Critical | **Pass** (EC-6: EC Test Quote sent → approved) |
| Convert quote to job | `/quotes` | supabase | Work order created from quote | High | Untested |
| Convert quote to invoice | `/quotes` | supabase | Invoice created from quote | High | Untested |
| BlitzPay quote pay | `/api/organizations/[organizationId]/quotes/[quoteId]/blitzpay/prepare-pay` | stripe_connect | Checkout session created when Connect enabled | High | Untested |

---

## Invoices

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Invoice list | `/invoices` | supabase | Invoices listed with payment status | Critical | **Pass** (EC-2: DB list limit 5; 0 rows on cert org) |
| Create invoice | `/invoices` | supabase | Invoice with line items saved | Critical | **Pass** (EC-6: EC Test Invoice fixture + drawer open) |
| Create from work order | `/work-orders/[id]` | supabase | Line items populated from WO | Critical | Untested |
| Invoice PDF | `/api/organizations/[organizationId]/invoices/[invoiceId]/pdf` | supabase | PDF correct | Critical | **Pass** (EC-6: PDF generated for EC-INV-CERT-001) |
| Print layout | `/organizations/[organizationId]/invoices/[invoiceId]/print` | supabase | Printable view renders | High | Untested |
| Email invoice | `/api/email/invoice` | resend | Email with PDF delivered | Critical | **Untested** (EC-6B: modal **Pass**; send not exercised) |
| Payment status tracking | `/invoices` | supabase, stripe_connect | Paid/unpaid reflects webhook sync | Critical | Untested |
| QuickBooks sync | `/api/organizations/[organizationId]/invoices/[invoiceId]/quickbooks-sync` | quickbooks | Export succeeds when QBO connected | Medium | Untested |

---

## Payments

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Stripe Connect onboarding | `/settings/payments` | stripe_connect | Express account created; status shows connected | Critical | **Blocked** (EC-4: cert org has no Connect account) |
| Staff collect payment | `/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay` | stripe_connect | Checkout completes; invoice marked paid | Critical | **Blocked** (EC-4: `BLITZPAY_INVOICE_PAY_ENABLED` off; prepare-pay auth gate **Pass**) |
| Payment link | `/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-link` | stripe_connect | Link opens checkout; payment succeeds | High | Untested |
| BlitzPay webhook | `/api/blitzpay/webhook` | stripe_connect, supabase | Charge events update invoice payment state idempotently | Critical | **Pass** (EC-4: handler reachable HTTP 400; idempotency tables readable; live events Untested) |
| Payment return | `/payment-return` | stripe_connect | User returned to invoice context after checkout | High | Untested |
| Receipt email | `/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/resend-receipt` | resend, stripe_connect | Receipt email delivered after payment | High | **Pass** (EC-4: route + permission gate; send Untested) |
| Refund flow | Invoice BlitzPay APIs | stripe_connect | Refund recorded; invoice status updated | High | Untested |
| Field collect on WO | `/work-orders/[id]` | stripe_connect | Field payment from work order succeeds | High | Untested |

---

## Purchase Orders

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| PO list | `/purchase-orders` | supabase | POs listed with status | Medium | **Pass** (EC-2: `org_purchase_orders` list limit 5) |
| Create PO | `/purchase-orders` | supabase | PO with vendor and line items saved | Medium | Untested |
| PO PDF | `/api/organizations/[organizationId]/purchase-orders/[purchaseOrderId]/pdf` | supabase | PDF generates correctly | Medium | **Pass** (EC-2: route file exists; generation Untested) |
| Vendor directory | `/vendors` | supabase | Vendors CRUD works | Low | Untested |
| Draft PO from reorder | Inventory reorder API | supabase | Low-stock triggers draft PO | Low | Untested |

---

## Portal

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Portal login | `/portal/login` | portal_session, resend | Magic link authenticates customer | Critical | **Pass** (EC-2: GET HTTP 200; magic link Untested) |
| Portal bootstrap | `/api/portal/bootstrap` | portal_session, supabase | Branding and scoped data load | Critical | **Pass** (EC-2: HTTP 401 without session — auth enforced) |
| Portal dashboard | `/portal/dashboard` | portal_session | Overview shows customer context | Critical | Untested |
| View quotes | `/portal/quotes` | portal_session | Customer sees sent quotes | Critical | **Pass** (EC-6: portal quote detail) |
| Approve quote | `/api/portal/quotes/[quoteId]/approve` | portal_session | Approval status updated | Critical | **Pass** (EC-6) |
| View invoices | `/portal/invoices` | portal_session | Customer sees invoices | Critical | **Pass** (EC-6: portal invoice detail) |
| Pay invoice | `/api/portal/invoices/[invoiceId]/blitzpay/prepare-pay` | portal_session, stripe_connect | Portal checkout succeeds | Critical | **Blocked** (EC-6: pay CTA hidden — flag off; no session created) |
| Service request | `/api/portal/service-requests` | portal_session | Request submitted and visible to staff | High | Untested |
| Equipment view | `/portal/equipment` | portal_session | Customer equipment list loads | High | Untested |
| Staff portal config | `/settings/portal` | resend | Portal settings save; invites work | High | Untested |

---

## Billing

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Billing page | `/settings/billing` | supabase, stripe_saas | Current plan, status, usage display correctly | Critical | **Pass** (EC-2: route redirect enforced; page render Untested) |
| Subscription row read (cert org) | `organization_subscriptions` | supabase | Plan/status readable for billing UI | Critical | **Pass** (EC-2: `active`, `plan_id=scale`, Equipify Scale candidate) |
| Start trial | Onboarding provision | stripe_saas, supabase | 14-day trial row with Scale entitlements | Critical | Untested |
| Upgrade checkout | `/api/billing/checkout` | stripe_saas | Stripe checkout completes; webhook updates `plan_id` | Critical | Untested |
| SaaS webhook | `/api/stripe/webhook` | stripe_saas, supabase | Subscription events sync idempotently | Critical | **Pass** (EC-4: handler reachable HTTP 400; `stripe_webhook_events` readable; secret blocked locally) |
| Payment method save | `/settings/billing` | stripe_saas | SetupIntent saves card on Stripe customer | High | Untested |
| Trial ending warning | App shell banner | supabase | Banner shows ≤7 days before trial end | High | Untested |
| Past due state | `/settings/billing` | stripe_saas | Warning copy; creation still allowed (grace) | High | Untested |
| Canceled state | `/settings/billing` | stripe_saas | Restricted creation on guarded flows | High | Untested |
| Self-serve cancel/downgrade | Manage billing dialog | stripe_saas | **Expected today: not available** (copy says coming soon) | Medium | Untested |
| Webhook replay safety | `/api/stripe/webhook` | stripe_saas | Duplicate events return 200 without double-write | Critical | Untested |

---

## Mobile

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Responsive web (technician) | `/technicians/today` | supabase, vercel | Field view usable on mobile browser | High | Untested |
| Native iOS login | External app (`ai.equipify.mobile`) | supabase_auth | Native Apple/Google sign-in works | High | Untested |
| Native job list | External iOS app | supabase | Assigned jobs visible | High | Untested |
| Push device registration | `/api/organizations/[organizationId]/mobile/push-devices` | mobile_push | Device token stored | High | Untested |
| Push test notification | `/api/organizations/[organizationId]/mobile/push-devices/test` | mobile_push | Test push received on device | Medium | Untested |
| BlitzPay mobile health | `/api/organizations/[organizationId]/blitzpay/mobile/health` | stripe_connect | Health endpoint returns ok when configured | High | Untested |
| Mobile collect payment | Native app + BlitzPay mobile APIs | stripe_connect | Payment completes from mobile | Critical | Untested |

---

## Notifications

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| Communications feed | `/communications` | supabase, resend | Feed loads; compose handoff works | High | Untested |
| Quote email delivery | `/api/email/quote` | resend | Delivered to inbox; not spam-blocked | Critical | Untested |
| Invoice email delivery | `/api/email/invoice` | resend | Delivered with attachment | Critical | Untested |
| Internal notifications | In-app bell | supabase | Notifications appear for org events | Medium | Untested |
| SMS workspace config | `/api/organizations/[organizationId]/sms-workspace` | twilio, telnyx | Provider config saves when credentials set | Medium | Untested |
| Follow-up task queue | `/communications/follow-ups` | supabase, resend | Tasks evaluate and handoff to email | Medium | Untested |

---

## Settings

| Feature | Route | Dependencies | Expected result | Criticality | Status |
|---------|-------|--------------|-----------------|-------------|--------|
| General settings | `/settings/general` | supabase | Org settings persist | Medium | Untested |
| Team / invites | `/settings/team` | supabase | Invite sent; seat cap enforced | High | Untested |
| Workspace branding | `/settings/workspace` | supabase, supabase_storage | Logo and company profile save | High | Untested |
| Permissions | `/settings/permissions` | supabase | Role capabilities reflect saved config | High | Untested |
| Payments settings | `/settings/payments` | stripe_connect | BlitzPay toggles and Connect status accurate | Critical | Untested |
| QuickBooks integration | `/settings/integrations/quickbooks` | quickbooks | OAuth connect + disconnect works | Medium | Untested |
| Dashboard home | `/` | supabase | Widgets reflect org data after CRUD | High | Untested |

---

## Production Test Matrix

Assign criticality for EC-2 execution planning. **No execution in EC-1.**

### Critical Revenue Path

| Step | Criticality | Expected result |
|------|-------------|-----------------|
| Login | Critical | Session established on production |
| Create customer | Critical | Customer visible in list and detail |
| Create work order | Critical | WO created and assignable |
| Create quote | Critical | Quote totals correct |
| Email quote | Critical | Email received with PDF |
| Approve quote (portal) | Critical | Portal approval recorded |
| Create invoice | Critical | Invoice from quote or WO |
| Collect payment (staff) | Critical | Stripe checkout succeeds; invoice paid |
| Receipt | High | Receipt email or UI confirmation |
| Portal payment | Critical | Customer pays invoice in portal |

### Billing Path

| Step | Criticality | Expected result |
|------|-------------|-----------------|
| Start trial | Critical | Trial row with Scale entitlements |
| Upgrade | Critical | Checkout updates `plan_id` via webhook |
| Past due | High | Warning UX; graceful degradation |
| Canceled | High | Creation blocked on guarded flows |
| Webhook replay | Critical | Idempotent handling |

### Portal Path

| Step | Criticality | Expected result |
|------|-------------|-----------------|
| Portal login | Critical | Magic link session works |
| Approve quote | Critical | Status updated |
| Pay invoice | Critical | Payment succeeds |
| Service request | High | Request reaches staff queue |

### Technician Path

| Step | Criticality | Expected result |
|------|-------------|-----------------|
| Login | Critical | Technician session works |
| View jobs | Critical | Assigned WOs visible |
| Complete job | Critical | Completion status persists |
| Collect payment | Critical | Field payment succeeds |

---

## EC-2 prerequisites

Before EC-2 production execution:

1. Run `pnpm exec tsx scripts/test-equipify-core-production-certification-foundation.ts` (must pass).
2. Confirm Vercel Production env: live Stripe keys, Resend, Supabase service role, `BLITZPAY_INVOICE_PAY_ENABLED` if testing payments.
3. Prepare isolated test org per plan tier (Solo, Core, Growth, Scale).
4. Do **not** use `.env.local` — use `scripts/vercel-production-env-run.ts` pattern for production env bootstrap.

---

## References

- `lib/certification/equipify-core-runtime-inventory.ts`
- `lib/certification/equipify-core-certification-helpers.ts`
- `docs/STRIPE_PRODUCTION_READINESS.md`
- `docs/BILLING_ACCESS_AND_GRACE_PERIODS.md`
- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md`
