# Outbound email audit (Phase 55.2)

End-to-end inventory of **actual** Resend sends and related behaviors. All live sends use `sendEmail()` from `lib/email/resend.ts` (Phase 55.1). Update this doc when adding routes.

**Manual test status:** unchecked items need validation in your environment (Resend + env configured).

---

## 1. Resend / `sendEmail()` paths

| Flow | Route or helper | `category` | Recipient source | Org scope | Failure behavior | Manual test |
|------|-----------------|------------|------------------|-----------|------------------|-------------|
| Signup welcome | `lib/email/signup-provision-emails.ts` → provision | `signup_welcome` | Auth user email | `organizationId` | Does not fail provisioning; logs `signup-provision-email` + `outbound-email` | ☐ |
| Signup internal notify | same | `signup_internal_notify` | `EMAIL_SIGNUP_INTERNAL_NOTIFY` / default | `organizationId` | Same | ☐ |
| Team invite | `POST /api/invites/create` | `team_invite` | Request body `email` | Yes | **Invite row already inserted**; returns `email_failed` + `inviteLink` for copy/paste; 503 if config, 502 if provider | ☐ |
| Invoice (customer template) | `POST /api/invoices/send-email` | `invoice_customer` | Request `to` | Yes | 502/503; no invoice status change on failure | ☐ |
| Invoice (legacy template) | `POST /api/email/invoice` | `invoice_customer_legacy_route` | Request `to` | Yes | Same pattern | ☐ |
| Quote | `POST /api/email/quote` | `quote_customer` | Request `to` | Yes | 502/503 | ☐ |
| Certificate | `POST /api/email/certificate` | `certificate_customer` | Request `to` | Yes | 502/503 | ☐ |
| Work order summary | `POST /api/email/work-order-summary` | `work_order_summary` | Request `to` | Yes | 502/503 | ☐ |
| Appointment confirmation | same, `variant: appointment_confirmation` | `work_order_appointment_confirmation` | Request `to` | Yes | 502/503 | ☐ |
| AI Ops digest | `lib/ai-ops/digest-runner.ts` | `ai_ops_digest` | Settings recipients[] | Yes | Digest run records destination failure; does not throw | ☐ |
| Invoice payment reminder (AI Ops) | `lib/ai-ops/actions/send-invoice-payment-reminder.ts` | `invoice_payment_reminder_ai_ops` | Customer `billing_email` or override | Yes | Returns structured error to caller | ☐ |
| BlitzPay customer receipt (auto) | `lib/blitzpay/blitzpay-receipt-email-dispatch.ts` ← `completeBlitzpayPaymentIntentSucceeded` webhook | `blitzpay_invoice_payment_receipt` | Invoice `billing_contact_email` else customer `billing_email` | Yes | **Non-blocking** for payment booking; skipped when outbound mail not configured, no safe email, or customer `invoice_delivery_preference` is not email-oriented; duplicate webhook replays are idempotent via `blitzpay_payment_receipt_dispatches` | ☐ |
| BlitzPay customer receipt (staff resend) | `POST /api/organizations/{orgId}/invoices/{invoiceId}/blitzpay/resend-receipt` | `blitzpay_invoice_payment_receipt_resend` | Same recipient resolution as auto | Yes | 503 if outbound mail not configured; 502 on provider failure; does not honor delivery preference (explicit staff action) | ☐ |
| BlitzPay staff payment alert | `lib/blitzpay/blitzpay-receipt-email-dispatch.ts` (webhook auto only) | `blitzpay_staff_payment_received` | Active org **owner** / **admin** emails from `profiles` | Yes | Non-blocking; idempotent per payment intent; skipped when mail not configured or no staff emails | ☐ |
| BlitzPay automated reminder | `lib/blitzpay/blitzpay-collections.ts` ← `POST /api/cron/blitzpay-reminders` | `blitzpay_invoice_payment_reminder` | Customer `billing_email` (email-valid + preference-safe only) | Yes | Suppressed for paid/void/archived/preference conflicts; replay-safe via `blitzpay_payment_reminders` idempotency key; includes hosted `/portal/pay/{token}` link | ☐ |
| Customer / CRM staff message | `POST /api/organizations/{orgId}/customers/{customerId}/contact-email` | `customer_staff_message` | Request `to` **must** match `customers.billing_email` or a non-archived `customer_contacts.email` | Yes | 400 if recipient not on file; 403 if role lacks comms/WO/invoice edit; 502/503; logs `customer_staff_email` + `customer-contact-email` summary | ☐ |

**Centralized compliance:** Every row above calls `sendEmail()`; there is **no** second Resend client or direct `resend.emails.send` outside `lib/email/resend.ts`.

### Gmail vs Resend (Phase 55.5)

| | **Resend (today)** | **Gmail (planned)** |
|--|-------------------|---------------------|
| Role | System transactional email for Equipify (`sendEmail()`). | Future **mailbox** integration for user/org identity (send-as, threads, optional sync). |
| Status | Live when env configured. | **Not implemented** — catalog “Coming soon” only; see [GMAIL_INTEGRATION.md](./GMAIL_INTEGRATION.md). |
| OAuth / tokens | API key server-side only. | Would use Google OAuth **server-only** token storage when built — not in this repo yet. |

**Policy:** Do not route signup, invoice, quote, invite, or other system-critical transactional sends through Gmail unless product explicitly changes that.

---

## 2. Communications module (no duplicate sender)

| Flow | Behavior |
|------|----------|
| `POST .../communications/{id}/send` | **Hand-off only:** `fetch` to existing live routes (`/api/email/invoice`, `/api/email/quote`, `/api/email/work-order-summary`, prospect follow-up). Does **not** call Resend itself. |
| `POST .../communications/{eventId}/retry` | **Replay hand-off:** same pattern as send — `fetch` to the live route with the user cookie, then settles the row to `sent` or `failed` in one request. Structured log line `source: "communication-retry"`. See retry matrix below. |
| Draft compose | Creates `communication_events`; send path is hand-off above. |

### Communications retry matrix (Phase 55.3)

| Event / row shape | Live route | Notes |
|-------------------|------------|--------|
| `event_type = communication_draft` | Same as draft send (`planDraftHandoff`) | Invoice / quote / WO use Resend-backed routes; prospect uses log-only follow-up (no `sendEmail`). |
| `invoice_email` + `related_entity_type = invoice` | `POST /api/email/invoice` | Template from legacy invoice route; `variant` from metadata or default `resend`. |
| `quote_email` + quote link | `POST /api/email/quote` | Same. |
| `work_order_summary_email` / `appointment_confirmation_email` + WO link | `POST /api/email/work-order-summary` | Variant derived from `event_type`. |
| `prospect_followup_email`, AI Ops reminder metadata, digest/system rows, unrelated types | — | API returns `retry_unavailable` or `retry_blocked` with a clear message — no fake queue. |

**Manual check:** fail a draft send (e.g. invalid env), hit Retry, confirm outbound Resend log + row `sent`, and a second timeline row from the live route when applicable.

### Customer / contact send entry points (Phase 55.4)

| Surface | What happens |
|---------|----------------|
| **Email → Send with Equipify…** (`ContactActions`) | Opens dialog → `contact-email` API → `sendEmail()` → `communication_events` row `customer_staff_email`. Also available when only billing/contact emails exist (mailto templates use first known address when present). |
| Customer detail · Contacts card | Same actions row per contact (mailto + Equipify + optional `contact_id` metadata). |
| Customers list / table cards | `ContactActions` with org + customer id for Equipify. |
| Customer drawer · contacts & locations | Equipify context wired. |
| Quote / equipment / maintenance plan drawers | Loads recipient candidates via Supabase (billing + contacts); mailto + Equipify. |
| **Communications compose draft** | Still **save-only**; email hand-off from the feed supports invoice / quote / work order / prospect. Compose warns when the linked record type is customer / equipment / maintenance plan. |

**Intentionally unsupported here:** Gmail sync, inbound mail, marketing drips, retry replay for `customer_staff_email` (no stored subject/body on the row for automated replay — send again from the customer UI).

---

## 3. Log-only / non-Resend “email” touches

| Flow | Notes |
|------|--------|
| `POST .../prospects/.../follow-up` | Logs `communication_events` with channel `email`; **does not** send mail. |
| Workflow action `send_email` | Inserts `communication_events` with `delivery_status: queued`, `provider: manual`; **does not** call `sendEmail`. |
| Supabase Auth (signup, reset, magic link) | **Supabase-hosted** templates and mail; not via Equipify `sendEmail`. |

---

## 4. Recipient & permission checks (summary)

- **Invoice / quote / certificate / work order routes:** `requireOrganizationMember` + capability gates (`canEditInvoices`, `canEditQuotes`, etc.); `to` validated with `isValidEmail` where applicable.
- **Invites:** Owner/admin only; email format validated before insert.
- **AI Ops reminder:** Validates billing email or override before send.
- **Digest:** Internal staff recipients from workspace settings; not customer-facing.
- **Customer staff message (`contact-email`):** Active org member; **any of** `canManageCommunications`, `canEditWorkOrders`, or `canEditInvoices`; recipient must belong to the customer (no arbitrary addresses).

---

## 5. Links & absolute URLs

| Use case | Mechanism |
|----------|-----------|
| Invite accept link | `getPublicAppOrigin()` + `/onboarding?inviteToken=…` |
| Signup welcome dashboard | `getPublicAppOrigin()` + `/` |
| AI Ops digest (HTML + text) | `APP_URL` in runner = `getPublicAppOrigin()`; `absoluteUrl()` in `ai-ops-digest-template.ts` |
| Invoice / quote / WO / certificate bodies | **No clickable app URLs** in shared templates today — placeholder copy for payment/portal/PDF; avoids broken relative links. When product adds real links, build with `getPublicAppOrigin()` (or portal-specific base if split later). |

**Fix in 55.2:** Plain-text digest footer used a relative settings path; it now uses the same `absoluteUrl()` helper as HTML.

---

## 6. Logging (production)

- Every `sendEmail` completion: JSON line `source: "outbound-email"`, `category`, `organizationId` (when passed), `recipientCount`, `ok`, `providerMessageId`, truncated errors — **no** bodies or secrets.
- Signup path also logs `source: "signup-provision-email"` for idempotency/diagnostics.
- Customer CRM send: `source: "customer-contact-email"`, `organizationId`, `customerId`, optional `contactId`, `outcome`, `category` — **no** bodies or secrets.

---

## 7. Manual test matrix (practical)

Prerequisites: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, verified domain, `NEXT_PUBLIC_SITE_URL` (or fallbacks), server running.

| # | Test | Steps | Expect |
|---|------|-------|--------|
| 1 | Signup welcome | New self-serve signup through onboarding/provision | One welcome + one internal notify (if creator); no dup on provision retry |
| 2 | Invite | Owner invites email; check inbox | Absolute invite URL; `team_invite` in logs |
| 3 | Invoice | Send from invoice UI → `/api/invoices/send-email` | Customer receives; `invoice_customer` in logs |
| 4 | Quote | Send quote email | `quote_customer` in logs |
| 5 | Certificate | Send certificate email (WO + equipment context) | `certificate_customer` in logs |
| 6 | Work order summary | Send summary | `work_order_summary` in logs |
| 7 | Appointment confirmation | Send with `variant: appointment_confirmation` | `work_order_appointment_confirmation` in logs |
| 8 | AI Ops digest | Trigger digest send (manual or cron) with recipients | `ai_ops_digest`; HTML + **text** footers absolute URLs |
| 9 | Payment reminder | AI Ops confirmed reminder | `invoice_payment_reminder_ai_ops` |
| 10 | Communications hand-off | Send draft for invoice/quote/WO | Same logs as underlying route; no duplicate Resend client |
| 10b | Communications retry | Failed draft or failed `invoice_email` / `quote_email` / WO email → Retry | Same as underlying route; `communication-retry` log line; no row stuck in `queued` |
| 13 | Customer Equipify send | Customer with billing or contact email → Email → Send with Equipify | `customer_staff_message` in `outbound-email`; timeline shows `customer_staff_email`; 400 if recipient not on file |
| 14 | Customer no email | Customer with zero billing + contact emails | Dialog explains; API returns `no_customer_email` if forced |
| 15 | Double-click send | Rapid Send in dialog | Second request blocked client-side while in flight |
| 11 | Missing env | Unset `RESEND_API_KEY`; attempt invoice send | 503, safe message, structured `outbound-email` log |
| 12 | Bad recipient | Invalid `to` on send route | 400 from route validation before `sendEmail` |

---

## 8. Migrations / DB

None required for this audit phase.

---

## Related

- [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md) — env, Resend checklist, dev health route.
- [SIGNUP_PROVISION_EMAILS.md](./SIGNUP_PROVISION_EMAILS.md) — signup idempotency.
- [COMMUNICATIONS_PHASE3.md](./COMMUNICATIONS_PHASE3.md) — draft hand-off architecture.
