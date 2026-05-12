# BlitzPay / Equipify Payments — architecture (Phase 54.3)

Design document for BlitzPay / Connect. **Phase 1** (`docs/BLITZPAY_PHASE_1.md`) implements **Stripe Connect Express onboarding**. **Phases 2A–2J** (`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12) add hosted **Stripe Checkout** for **org invoices** on the **connected account** (staff dashboard + **customer portal**), `application_fee_amount`, webhook-driven `org_invoice_payments`, fee snapshots, ledger rows, **staff refunds**, **dispute visibility**, diagnostics APIs, **platform-managed** convenience-fee disclosure, payout/balance-transaction ledger + reconciliation (staff only), **Phase 2I** multi-method payment foundations (card + ACH) with stored profile references (Stripe-hosted details only), and **Phase 2J** collections automation foundations (reminders, recovery states, hosted payment links, read-only collection insights/reporting). **Phase 2O** adds **provider-agnostic financing session/offers**, **installment / staged payment plans**, org-level **revenue acceleration** toggles, and **read-only insights** (no Equipify-side lending or autonomous credit decisions) — see `docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12.16. **Phase 2P** adds a **work order BlitzPay panel**, **`canAssistBlitzpayCollection`** field-safe pay-link and checkout actions, optional **WO ↔ payment plan** linkage, **reporting** for work-order-originated links and field “invoice later” markers — see §12.17. **Phase 2Q** adds **revenue intelligence** (dashboard + forecasts + collections metrics + read-only recommendations) for financial roles and **platform revenue rollup** — see §12.18. **Phase 2T** adds the **financial command center** (owner scorecards + combined AR/AP cash outlook) — see §12.21. **Phase 2U** adds **deterministic executive business health** (bounded WO/invoice sampling, customer payment signals, platform health rollup) — **no LLM** — see §12.22. **Phase 2V** adds **collections copilot + cash acceleration metrics** (priority queue, playbooks, field/ACH/installment heuristics, platform collections rollup) — **deterministic only, staff + platform admin** — see §12.23. **Phase 2W** adds **recurring revenue / membership renewal** signals (maintenance plans, service agreements, scheduled renewals, installment cadence, bounded MRR-style proxies, platform recurring rollup) — **deterministic, staff + platform admin, no portal admin** — see §12.24. **Phase 2X** adds **native BlitzPay memberships** (Postgres tables, recurring invoice generation with idempotency, failure retries, retention snapshots, cron tick), **minimal portal read APIs** (no raw Stripe identifiers in payloads), and **staff dashboards** — see §12.25; it complements Phase 2W heuristics without replacing Connect invoice payment flows. **Phase 2Y** adds **payroll-style accruals** (technician commissions, WO-linked **contractor settlements** distinct from Phase 2S `blitzpay_vendor_payouts`, revenue-share rules/ledger, payroll run orchestration — **accounting only, no ACH payroll**) — see §12.26. **Phase 2Z** adds **internal cash-bucket planning** (`blitzpay_cash_accounts`, allocations, reserve rules, runway snapshots), deterministic operating-cash and reserve-gap estimates layered on treasury + AP + payroll signals — **not bank accounts, not custodial balances, no money transmission**; Stripe Connect remains the movement source of truth — see §12.27. **Phase 2AA** (**Phase 2 extension — shipped**) adds **customer billing profiles**, **saved payment-method metadata** (hashed Stripe references + masked brand/last4 only), **autopay enrollment preferences**, bounded reporting rates, and **minimal portal billing APIs** — **no PAN/bank numbers, no raw Stripe ids in client payloads, no charges or subscription creation in this phase** — see `docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12.28. **Phase 2AB** (**Phase 2 extension — shipped**) adds **invoice collection state**, **deterministic capped retry scheduling** (day 1 / 3 / 7 / 14 + final review), **recovery-flow + activity-log orchestration** (no autonomous email/SMS, no off-Stripe charges), **staff collections APIs**, **portal billing overview** (`/portal/billing`), and reporting snapshot collection KPIs — **not** enterprise “Phase 3B — Native AP Automation & Bill Pay”; it remains Connect-centric collections orchestration — see §12.29. **Phase 3A (internal general ledger — shipped)** adds double-entry COA, journals, periods, and deferred-revenue foundations — see `docs/BLITZPAY_PHASE_3_ARCHITECTURE.md`. **Phase 3B (native vendor AP & bill pay foundations — shipped)** adds **vendors**, **vendor bills/lines**, **approval-flow rows**, **payment-run + allocation orchestration** (planning only; **no autonomous money movement**), **append-only AP audit events**, **GL accrual on approve**, **paid-bill DB immutability**, and **bounded** AP health / reporting fields — same doc (Phase 3B section). **Phase 3C (tax & compliance foundations — shipped)** adds **tax jurisdictions & rules**, **deterministic tax calculation rows**, **immutable compliance audit log**, **ACH authorization retention** (hashed references), **vendor tax / 1099 readiness profiles**, **tax liability snapshots**, **bounded** tax/compliance reporting + staff UI — **no filing/remittance, no legal guarantees, no portal compliance APIs** — see same doc (Phase 3C section). **Historical migration filenames** still contain `phase_3a` / `phase_3b` / `phase_3c` for applied-migration integrity; **product/docs labels** use **Phase 2AA** / **Phase 2AB** for those files, **Phase 3A** for the GL migration `20261010120000_blitzpay_phase_3a_general_ledger.sql`, and **Phase 3C** for `20261013120000_blitzpay_phase_3c_tax_compliance.sql`.

**BlitzPay roadmap series:** **Phase 2** (2A–2Z plus **2AA** / **2AB**) = Stripe-backed payments, billing, treasury visibility, payroll/payout, cash planning, recurring/membership signals, customer billing + saved payment metadata + autopay foundations (**2AA**), and deterministic invoice collections orchestration (**2AB**) — still movement- and Connect-centric. **Phase 3A (general ledger — shipped)** = native **double-entry internal books** (chart of accounts, journals, periods, deferred revenue foundations, bounded reporting) — see `docs/BLITZPAY_PHASE_3_ARCHITECTURE.md`. **Phase 3B (vendor AP foundations — shipped)** = deterministic **vendor bill lifecycle**, **treasury-aware scheduling signals**, **approval thresholds**, and **reconciliation-ready** allocations — **orchestration only**; Stripe remains the movement path for Connect payouts when you pay through approved flows — see same doc. **Phase 3C (tax & compliance foundations — shipped)** = **jurisdictions + rules**, **deterministic calculations**, **append-only compliance audit**, **ACH retention tracking**, **1099 readiness**, **bounded** reporting + FCC tiles — **no automated filing/remittance** — see `docs/BLITZPAY_PHASE_3_ARCHITECTURE.md` (Phase 3C). **Phase 3D–3E** (planned) = deeper automation surfaces (e.g. financing marketplace expansion, procurement & inventory finance) — see `docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12.30. **Phase 4** = deterministic-first AI-assisted financial operations. **Phase 5** = network/ecosystem expansion. **Phase 6** = mobile/scale/observability maturity.

SaaS subscription billing stays on the existing platform Stripe account and `/api/stripe/webhook` flow (Phases 54.1–54.2) — **unchanged**.

---

## 1. Current state audit (codebase)

### BlitzPay Connect onboarding (Phase 1 — implemented)

| Surface | Role |
|--------|------|
| `organizations` Connect columns | Persist `stripe_connect_account_id`, normalized status, requirements arrays, `last_stripe_connect_sync_at` |
| `lib/blitzpay/*` | Express `accounts.create` (US), `accountLinks.create`, `accounts.retrieve`, map Account → org patch |
| `GET/POST …/blitzpay/*` | Org-scoped status, enable, sync, account-link (owner/admin + platform admin for mutations) |
| `POST /api/blitzpay/webhook` | `STRIPE_BLITZPAY_WEBHOOK_SECRET`, idempotency table `blitzpay_stripe_webhook_events`, `account.updated` only |
| Settings → **Payments** | `/settings/payments` — Enable, Continue onboarding, Refresh status |

### SaaS subscription billing (unchanged scope)

| Surface | Role |
|--------|------|
| `app/api/billing/checkout/route.ts` | Hosted Checkout Session for **Equipify plan** subscriptions |
| `app/actions/stripe.ts`, `lib/billing/hosted-subscription-checkout.ts` | Embedded / admin checkout paths; metadata ties session to `organization_id` |
| `app/(dashboard)/settings/billing/page.tsx` | Plan purchase, portal, Stripe customer payment methods for **Equipify subscription** |
| `app/actions/stripe-setup.ts` | Setup intents for billing |
| `app/actions/stripe-billing-data.ts` | Reads Stripe **subscription** invoices / PMs for settings UI |
| `organization_subscriptions` | SaaS tier, Stripe customer/subscription/price ids, status, periods |
| `app/api/stripe/webhook/route.ts` + `lib/billing/stripe-webhook-sync.ts` | Subscription + SaaS invoice events only |

**Important:** `stripe_customer_id` on `organization_subscriptions` is the **Equipify tenant** as customer of **Equipify’s** Stripe account — **not** the field service company’s end-customer and **not** a Connect account id.

### Customer invoice payments (org → their customer)

| Surface | Role |
|--------|------|
| `org_invoices` | Invoice totals, `status`, `paid_at`, portal exposure |
| `org_invoice_payments` (Phase 38 migration) | **Staff-recorded** payments: cash, check, ACH, wire, card (label only), etc. — **no processor** |
| `components/drawers/invoice-detail-view.tsx` | “Record payment” (`PaymentModal`) writes to `org_invoice_payments`; **BlitzPay (hosted)** starts Checkout on the connected account (staff). **Phase 2E:** refund actions + disputes + diagnostics on the Payments tab (staff only). |
| `app/(portal)/portal/invoices/[invoiceId]/page.tsx` + `POST /api/portal/invoices/[invoiceId]/blitzpay/prepare-pay` | Portal cookie session; same prepare pipeline as staff; return URLs under `/portal/invoices/...`. |
| `lib/billing/invoice-payment-allocation.ts` + repository | Balance / paid / partial pay logic |
| `app/api/invoices/send-email/route.ts`, `app/api/email/invoice/route.ts` | Email invoice to customer |
| Portal `app/api/portal/invoices/*` | Invoice list/detail including balances; **prepare-pay** when BlitzPay is enabled; **net** balances after BlitzPay refunds; customer-safe refund lines (no dispute internals) |

### QuickBooks

| Surface | Role |
|--------|------|
| OAuth + sync | `organization_integration_oauth_tokens`, QuickBooks invoice sync |
| `lib/integrations/quickbooks/invoice-inbound-reconcile.ts`, `apply-inbound-paid` | When QB shows paid, can **mark Equipify invoice paid**; reconciles with recorded payments |

**Remaining gaps:** Dispute evidence workflow, richer payout sync, and dedicated accounting dashboards — see `docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12 and `docs/BLITZPAY_REMAINING_PHASES_ROADMAP.md`.

---

## 2. Recommended architecture (Stripe Connect)

### Decision: use **Stripe Connect** for BlitzPay

End-customer invoice payments are **merchant-of-record for the service company**, with Equipify taking an **application fee**. That requires **connected accounts**, not the existing SaaS `organization_subscriptions` Stripe customer.

### Account type: **Express** (default recommendation)

| Model | Fit for Equipify |
|-------|-------------------|
| **Standard** | Lowest platform control; connected users manage everything in Stripe Dashboard; weaker embedded “Equipify Payments” story. |
| **Express** | **Best default:** Stripe-hosted onboarding, dashboard for connected users, platform controls charges/fees/payouts via API, moderate compliance vs Custom. |
| **Custom** | Full UI/branding control; **highest** compliance and development cost — only if Express limits block the product. |

**Recommendation:** **Stripe Connect Express** for most field service orgs; revisit **Standard** for partners who insist on owning the full Stripe relationship.

### Charge pattern

Evaluate two supported patterns (choose one primary per rollout; document in runbooks):

1. **Direct charges on the connected account** (`stripeAccount` header / `Stripe-Account` on API calls) with **`application_fee_amount`** (and platform may use `transfer_data` only if using destination model — follow current Stripe Connect charge docs).  
   - **Pros:** Clear MoR on connected account for their sales; platform fee explicit.  
   - **Cons:** Platform must implement Connect-aware PaymentIntents/Checkout.

2. **Destination charges** (charge on platform, `transfer_data[destination]`, `application_fee_amount`).  
   - **Pros:** Single charge object on platform; some reporting centralization.  
   - **Cons:** Can shift **liability / branding / compliance** mix; must be validated with Stripe and counsel for your model.

**Initial recommendation:** Prefer **direct charges on the connected account + application fee** for “FreshBooks-like” clarity (service company is seller). Confirm with Stripe account rep before implementation.

**Not recommended for BlitzPay v1:** “Hosted payment links” **without** Connect as a long-term substitute — they don’t establish connected-account MoR + fee split for arbitrary Equipify invoices without additional design.

### Tradeoffs summary

- **Compliance:** Express shifts KYC/onboarding to Stripe’s flows; platform still has Connect responsibilities.  
- **Risk:** Keep **SaaS billing** and **BlitzPay** on **separate webhook endpoints and secrets** to avoid wrong handlers updating `organization_subscriptions`.  
- **Accounting:** Connected account receives net of Stripe fees; platform receives application fees — maps cleanly to “platform revenue” vs “pass-through” in your books; service companies reconcile payouts like any Stripe business.  
- **QB:** Paid status in Equipify should still be driven by **internal payment records** + optional QB inbound sync; BlitzPay should write the same `org_invoice_payments` / status semantics where possible for one reconciliation story.

---

## 3. BlitzPay product / technical model

### What the **service organization** (Equipify tenant) sees

- Settings: “Payments” / BlitzPay — **Connect onboarding status** (required, restricted, enabled), payout timing notice, optional fee disclosure (configured by Equipify, not arbitrary surcharges in v1).  
- Per invoice: “Collect online” / payment status, link to Stripe Dashboard for disputes (Express).  
- Reporting: payments, fees, refunds (future UI).

### What **their customer** sees

- Branded or neutral **checkout** (Payment Element or Checkout Session) for **that invoice** (amount, line items optional).  
- Receipt from Stripe; email from Equipify optional.

### Where Stripe onboarding happens

- **Stripe Connect Express onboarding** (hosted link or embedded Connect onboarding), initiated server-side only. **Never** expose secret keys; use redirect URLs and account links.

### Merchant of record

- **Connected account (service company)** for BlitzPay card/ACH payments (under direct-charge model).  
- **Equipify platform Stripe account** remains MoR only for **SaaS subscriptions** (existing flow).

### Application fees

- Config: global default + optional per-org override (future).  
- Calculation: e.g. `floor(amount * bps) + fixed` with caps — **implemented server-side only**; never trust client.  
- Stripe: `application_fee_amount` (or equivalent for chosen charge pattern).

### Refunds

- Initiated by org admin or platform support; executed against the **original charge on the connected account**; application fee refunds per Stripe rules.  
- Equipify DB: adjust `org_invoice_payments` / allocation and **audit log**.

### Disputes / chargebacks

- Handled in **connected account’s** Stripe flow primarily; Equipify surfaces **status webhooks** and in-app banner.  
- Policy: who absorbs dispute fees — product/legal decision; document in TOS.

### Payouts

- Stripe → connected account bank (Express default). Platform does not “payout” application fees separately in basic model — they accumulate on the **platform** balance from `application_fee`.

### Account status tracking

- Persist: `connect_account_id`, `charges_enabled`, `payouts_enabled`, `details_submitted`, `requirements` summary (from `account.updated`).  
- Gate “pay online” until `charges_enabled`.

### Invoices ↔ payment sessions

- New link table or columns: `org_invoice_id` ↔ `stripe_payment_intent_id` / `checkout_session_id`, status, `application_fee_cents`, `connected_account_id`, idempotency key.  
- **One active session** per invoice or explicit multi-attempt policy.

### QuickBooks — paid invoices

- On successful BlitzPay payment: mark Equipify invoice paid (same as today’s payment recording) and optionally push payment to QB if/when outbound payment sync exists.  
- Inbound QB paid: keep **reconcile** rules — if BlitzPay recorded a card payment, avoid double-applying (reuse Phase 38 reconcile patterns).

---

## 4. Database additions (recommended, **no migrations in 54.3**)

When implementing later, consider:

| Area | Suggested artifacts |
|------|---------------------|
| Connect profile | `organization_payment_providers` or columns on a dedicated `organization_blitzpay_settings` — `stripe_connect_account_id`, onboarding state, capabilities JSON hash |
| Pay attempts | `org_invoice_payment_intents` or extend `org_invoice_payments` with nullable `stripe_*` fields + `source = 'stripe' \| 'manual'` |
| Fees | `application_fee_cents`, `platform_fee_rate_snapshot` on the payment row for audit |
| Webhooks | New idempotency table `stripe_connect_webhook_events` **or** extend existing with `webhook_stream` enum — **prefer separate table** for blast radius |
| Reconciliation | Optional `external_reconciliation_ref`, payout id (future) |

**54.3 does not add these tables** — implement in 54.3B+ with a focused migration.

---

## 5. Webhook / event architecture (future)

### Separate from SaaS webhooks

- **New endpoint:** e.g. `POST /api/stripe/connect/webhook`  
- **New secret:** `STRIPE_CONNECT_WEBHOOK_SECRET` (or Stripe’s multi-endpoint dashboard setup)  
- **Never** route Connect `payment_intent.*` into `dispatchStripeWebhookEvent` used for subscriptions.

### Likely Connect-related events

| Event | Use |
|-------|-----|
| `account.updated` | Refresh onboarding / capability gates |
| `payment_intent.succeeded` | Mark invoice payment, fee confirmation |
| `payment_intent.payment_failed` | Notify org, retry policy |
| `charge.refunded` | Align DB + invoice balance |
| `charge.dispute.created` | Surface dispute; optional notifications |
| `application_fee.created` | Reconciliation / analytics |
| `checkout.session.completed` | Only if using Checkout for invoice pay — **do not** reuse SaaS subscription handler; branch by `metadata.purpose=blitzpay_invoice` or separate endpoint |

### SaaS endpoint (`/api/stripe/webhook`)

- **Leave unchanged** for subscription lifecycle (Phase 54.2).  
- Optionally **reject** events that include `account` context for connected objects if they ever hit the wrong URL (defense in depth).

---

## 6. Implementation plan (future phases)

| Phase | Scope |
|-------|--------|
| **54.3A** | Architecture + audit only (this document) |
| **54.3B** | Connect Express onboarding (Account Links), store `stripe_connect_account_id`, `account.updated` webhook |
| **54.3C** | Server-only PaymentIntent or Checkout for **one** invoice; link to `org_invoices`; no fee or **zero fee** in sandbox first |
| **54.3D** | Application fee calculation + Stripe fee parameters; dashboards for internal validation |
| **54.3E** | Refunds, disputes surfacing, payout/status, reconciliation exports |
| **54.3F** | QuickBooks paid + payment push/reconcile rules with BlitzPay rows |

---

## 7. Environment variables (future, **not required for 54.3**)

| Variable | Purpose |
|----------|---------|
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook signature |
| `STRIPE_CONNECT_CLIENT_ID` | If using OAuth Standard later (optional) |
| Platform flags | e.g. `BLITZPAY_ENABLED=false` default — kill switch |

Existing `STRIPE_SECRET_KEY` for Connect API calls typically uses the **platform** secret; **connected account** context is per-request, not a second secret.

---

## 8. Compliance and non-goals

### Compliance cautions

- **Surcharging / convenience fees** on card payments are **jurisdiction- and network-dependent** — do not implement as a default “customer pays extra %” without legal review.  
- **Money transmission / MSB** analysis may apply depending on flow — involve counsel before moving funds.  
- **PCI:** Use Stripe.js / Checkout / Payment Element; never send raw PAN to Equipify servers.

### Explicit non-goals (54.3)

- No production customer invoice charging.  
- No application fee on **SaaS** subscriptions.  
- No reuse of `organization_subscriptions.stripe_customer_id` for end-customer invoice checkout.  
- No Connect onboarding links in production until 54.3B is explicitly scoped and reviewed.

---

## 9. Manual setup notes (future)

- Create Connect application in Stripe Dashboard; enable Express.  
- Configure **separate** webhook endpoint for Connect events.  
- Test in Stripe test mode with test connected accounts; verify platform balance application fees in test.

---

## 10. Risks and open decisions

- **Charge type:** direct vs destination — finalize with Stripe + finance.  
- **ACH vs cards:** different pricing and verification; may ship cards first.  
- **Who pays Stripe processing fees** — connected account vs absorbed by platform (affects fee math).  
- **QuickBooks:** whether BlitzPay creates a **payment** entity in QB or only updates invoice balance — product decision.  
- **Multi-org franchises:** single Connect account vs per-location — data model impact.

---

## Related docs

- [BLITZPAY_PHASE_2_ARCHITECTURE.md](./BLITZPAY_PHASE_2_ARCHITECTURE.md) — **Phase 2 (pre-implementation):** invoice pay, Connect charges, application fees, webhooks, rate limits, ledger — design before coding.  
- [BLITZPAY_REMAINING_PHASES_ROADMAP.md](./BLITZPAY_REMAINING_PHASES_ROADMAP.md) — **Phases 3–15** roadmap (UX, dashboard, refunds, disputes, payouts, fees, portal, admin tools, packaging, automation, scale, mobile, future ideas).
- [STRIPE_PRODUCTION_READINESS.md](./STRIPE_PRODUCTION_READINESS.md) — SaaS subscription production checklist (separate from BlitzPay).
