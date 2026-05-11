# BlitzPay — Remaining Phases Roadmap (planning only)

**Purpose:** Single **implementation-ready** roadmap for BlitzPay after **Phase 1** (shipped). Aligns with **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md`** (technical design for money movement), **`docs/BLITZPAY_ARCHITECTURE.md`** (north star), and **`docs/SCALE_READINESS_AUDIT.md`**.  
**Explicit boundary:** **SaaS subscription billing** (Equipify plan → tenant) stays on **`/api/stripe/webhook`**, **`organization_subscriptions`**, **`/settings/billing`**, Checkout for **platform** revenue. **BlitzPay** = **tenant’s end-customer** payments via **Stripe Connect** only — no merging of those two economic flows in one Stripe object.

**Rules for this document:** Planning **only** — no migrations, no application code, no commitment to phase numbering in release marketing (internal engineering phases).

---

## 1. Executive summary

BlitzPay **Phase 1** delivered Connect Express **onboarding** and **account health** (org columns, Account Links, `POST /api/blitzpay/webhook` for `account.updated`, idempotency table). **Phase 2** must deliver the **minimum safe vertical slice** to move money: **PaymentIntent (or Checkout) on connected account**, **`application_fee_amount`**, **webhook-driven reconciliation** into **`org_invoice_payments`**, **idempotency**, **rate limits**, and **observability** — as specified in **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md`**.

**Phases 3–15** below layer **product experience**, **operations**, **fees**, **portal history**, **platform admin tools**, **commercial packaging**, **automation**, **scale**, **mobile/offline**, and **exploratory** ideas — each with explicit **out of scope** items so nothing critical is forgotten and nothing unsafe is mixed into an earlier ship.

**Recommended critical path:** Phase **2** (foundation) → **3** (invoice pay UX) → **5** (refunds/failures) → **10** (support tools) → **13** (scale hardening). Phases **4**, **6**–**9**, **11**–**12**, **14**–**15** can parallelize where staffing allows, but **do not** skip webhook idempotency, allocation correctness, or kill switches.

---

## 2. Current state

| Layer | State |
|-------|--------|
| **Connect onboarding** | Shipped: `organizations.*stripe_connect*`, `lib/blitzpay/*`, `/api/organizations/.../blitzpay/*`, `/api/blitzpay/webhook` (`account.updated` only), Settings → **Payments** (`app/(dashboard)/settings/payments/page.tsx`). |
| **Invoice money** | **`org_invoices`** + staff **`org_invoice_payments`**; **Phase 2B:** Stripe **Checkout** on connected account + webhook reconciliation into **`org_invoice_payments`** (see **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §12.2**). Manual **`PaymentModal`** remains for non-BlitzPay payments. |
| **SaaS billing** | **`/api/billing/checkout`**, **`/api/stripe/webhook`**, **`lib/billing/stripe-webhook-sync.ts`**, **`organization_subscriptions`** — **unchanged** for BlitzPay work. |
| **Design docs** | **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md`** — Phase **2A** migration/RLS + Phase **2B** pay API + webhook completion documented in **§12**. |

---

## 3. What Phase 1 already solved

- **Express account creation** with **org-scoped idempotency** (Stripe idempotency key + DB guard).
- **Account Link** onboarding and **return/refresh** UX on Settings → Payments.
- **Status sync** (manual + webhook `account.updated`) into **normalized org columns**.
- **Separate webhook endpoint and secret** from SaaS — avoids handler collision.
- **Webhook idempotency** table pattern for Connect events (`blitzpay_stripe_webhook_events`).
- **Access control** for BlitzPay management (`lib/blitzpay/access.ts`).

**Phase 1 intentionally did not solve:** charging end-customers, application fees, invoice pay links, refunds, disputes UI, payouts reporting, portal pay, or platform admin payment diagnostics.

---

## 4. What Phase 2 should implement first

Phase 2 is the **non-negotiable engineering foundation**. Follow the **sub-phases 2.0–2.2** (minimum) in **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §9** before broad UX work:

1. **Migrations + RLS** for `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, `blitzpay_fee_snapshots`, `blitzpay_ledger_entries` (and optional `blitzpay_webhook_inbox`, `blitzpay_org_settings` per architecture doc).
2. **Expand** `POST /api/blitzpay/webhook` for at least `payment_intent.succeeded` / `payment_intent.payment_failed` with **insert-before-dispatch** idempotency and **bounded** handler time.
3. **Server API** to create a **single-invoice** PaymentIntent (or Checkout Session) on the **connected account** with **`application_fee_amount`** + **metadata** (`organization_id`, `org_invoice_id`, `purpose=blitzpay_invoice`).
4. **Wire success path** to **`org_invoice_payments`** / **`lib/billing/invoice-payment-allocation.ts`** so invoice balance matches existing rules.
5. **Feature flag** `BLITZPAY_INVOICE_PAY_ENABLED` (or equivalent) default **off**; structured logging for webhook + pay API.

**Phase 2 “first” UI:** minimal internal or staff-only “Create pay session” is acceptable; **full** customer-facing polish belongs in **Phase 3**.

---

## 5. Remaining phases after Phase 2 (overview)

| Phase | Theme |
|-------|--------|
| **3** | Customer invoice **payment experience** (staff + customer flows, emails, receipts) |
| **4** | Tenant **Payments dashboard** (lists, filters, export) |
| **5** | **Refunds**, partial refunds, failed payments, **retry** |
| **6** | **Disputes / chargebacks** visibility |
| **7** | **Payout** and **reconciliation** reporting |
| **8** | **Convenience fee** controls **by tenant** |
| **9** | **Customer portal** payment **history** |
| **10** | **Admin / platform** support tools |
| **11** | **Subscription / add-on packaging** for BlitzPay (commercial) |
| **12** | **Advanced automation** triggers (workflows, dunning) |
| **13** | **Scale hardening** for payments |
| **14** | **Mobile / offline** considerations |
| **15** | **Future / not now** ideas |

---

## Phase template (used below)

For each phase: **Goal** · **User-facing value** · **Database** · **API/routes** · **UI** · **Stripe/Connect** · **Security/RLS** · **Observability** · **Testing** · **Rollout / flags** · **Not in this phase**.

---

## 6. Phase 3: Customer invoice payment experience

| Field | Content |
|-------|---------|
| **Goal** | End-to-end **pay this invoice** for the tenant’s customer: clear amount, success/failure, receipt, and staff visibility — built on Phase 2 tables and webhooks. |
| **User-facing value** | Customers pay faster; fewer “how do I pay?” calls; professional receipt. |
| **Database** | May add **`blitzpay_pay_links`** (token hash, `expires_at`, `org_invoice_id`) if not folded into `blitzpay_invoice_payment_attempts`; email send log optional. No change to SaaS tables. |
| **API/routes** | Portal: `POST/GET …/portal/.../invoice-pay` (names TBD); staff: `POST …/blitzpay/invoices/[id]/send-pay-link`; resend, revoke link. |
| **UI** | Invoice drawer: **Pay online** CTA, status chip, copy link; portal invoice detail **Pay** button; hosted Checkout return page messaging. |
| **Stripe/Connect** | Checkout return URLs; `customer`/`customer_email` optional; 3DS handling messaging; **no** new Connect capabilities beyond cards unless ACH scoped. |
| **Security/RLS** | Short-lived signed or opaque tokens; rate limits (Phase 2 doc); no invoice id–only public URLs. |
| **Observability** | Log `pay_link_created`, `checkout_session_id`, `duration_ms`; funnel metrics (created → opened → paid). |
| **Testing** | E2E in Stripe test mode: success, decline, cancel, duplicate webhook, expired link. |
| **Rollout** | `BLITZPAY_PORTAL_PAY=true` separate from staff pay; beta org allowlist. |
| **Not in this phase** | Full dashboard analytics (Phase 4); refund UI (Phase 5); dispute center (Phase 6). |

---

## 7. Phase 4: Tenant Payments dashboard

| Field | Content |
|-------|---------|
| **Goal** | Single place for **owner/admin/billing** roles to see BlitzPay **volume**, **in-flight** PIs, **recent failures**, and deep links to invoices. |
| **User-facing value** | Ops visibility without opening Stripe for every question. |
| **Database** | Mostly **reads** on `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, `blitzpay_ledger_entries`; optional **materialized** summary table later (not required v1). |
| **API/routes** | `GET …/blitzpay/payments?cursor=&status=` paginated; `GET …/blitzpay/summary?from=&to=`. |
| **UI** | New **`/settings/payments/activity`** or **`/payments`** hub (product choice); tables with **pagination** (per scale audit). |
| **Stripe/Connect** | Optional **Balance** / **Payment** list from Stripe API for reconciliation drill-down — cache lightly, tenant-private. |
| **Security/RLS** | Restrict to roles with `canViewBilling` / explicit BlitzPay permission; never expose full card numbers. |
| **Observability** | API latency logs; slow query alerts on new list endpoints. |
| **Testing** | Large-org seed: pagination correctness; permission matrix. |
| **Rollout** | `BLITZPAY_DASHBOARD=true`. |
| **Not in this phase** | Platform-wide cross-tenant reporting (Phase 10); payout reports (Phase 7). |

---

## 8. Phase 5: Refunds, partial refunds, failed payments, and retry flows

| Field | Content |
|-------|---------|
| **Goal** | Safe **refund** and **partial refund** aligned to Stripe **Charge/Refund** APIs; **failed** payment UX + **retry** policy (new PI vs reuse — product rule). |
| **User-facing value** | Correct invoice balance after refunds; fewer support escalations. |
| **Database** | `blitzpay_refunds` (id, `organization_id`, `stripe_refund_id` unique, `amount_cents`, `blitzpay_payment_intent_id`, `status`, `created_at`); extend **`blitzpay_ledger_entries`** entry types; link to **`org_invoice_payments`** adjustments. |
| **API/routes** | `POST …/blitzpay/payment-intents/[id]/refund` (full/partial); internal idempotency keys. |
| **UI** | Invoice drawer: Refund modal; Payments dashboard: failed row actions (**Retry**, **Void session**). |
| **Stripe/Connect** | Refund on **connected account** charge; application fee refund behavior per Stripe rules — document in runbook. |
| **Security/RLS** | Owner/admin or scoped billing role; audit log entry; optional two-step confirm for large amounts. |
| **Observability** | Webhook `charge.refunded`; alert on refund > paid balance (integrity). |
| **Testing** | Partial refund twice; concurrent refund requests; webhook reordering. |
| **Rollout** | `BLITZPAY_REFUNDS=true`; max refund % per transaction optional cap. |
| **Not in this phase** | Dispute evidence upload (Phase 6); automated retry dunning (Phase 12). |

---

## 9. Phase 6: Disputes / chargebacks visibility

| Field | Content |
|-------|---------|
| **Goal** | Surface **dispute opened/closed** and amount at risk; link to **Stripe Express** dispute flow for evidence. |
| **User-facing value** | Tenant sees risk early; fewer surprise chargebacks. |
| **Database** | `blitzpay_disputes` (`stripe_dispute_id` unique, `charge_id`, `amount_cents`, `status`, `evidence_due_by`, `org_invoice_id` nullable). |
| **API/routes** | Webhook: `charge.dispute.*`; `GET …/blitzpay/disputes`. |
| **UI** | Banner on invoice + Payments dashboard row; optional email notification (communications system). |
| **Stripe/Connect** | Rely on Stripe dispute lifecycle; Equipify does **not** replace Stripe’s evidence UI in v1. |
| **Security/RLS** | Same as payments list; no PII from dispute beyond what Stripe sends. |
| **Observability** | Dispute stage transitions logged; SLA alert before `evidence_due_by`. |
| **Testing** | Stripe test dispute objects; webhook idempotency. |
| **Rollout** | `BLITZPAY_DISPUTES_UI=true`. |
| **Not in this phase** | In-app evidence builder; automatic acceptance liability shifts. |

---

## 10. Phase 7: Payout / reconciliation reporting

| Field | Content |
|-------|---------|
| **Goal** | Help tenants reconcile **Stripe payouts** to **paid invoices** and platform **application fees** (read-heavy reporting). |
| **User-facing value** | Month-end clarity; accountant-friendly exports. |
| **Database** | Optional `blitzpay_payout_snapshots` (`stripe_payout_id`, `amount_cents`, `arrival_date`, raw json hash); or query Stripe on demand + cache. |
| **API/routes** | `GET …/blitzpay/payouts`, `GET …/blitzpay/reconciliation?payout_id=`; CSV export. |
| **UI** | Payments dashboard tab: **Payouts**; download CSV. |
| **Stripe/Connect** | `payout.*` webhooks optional if snapshots needed without polling. |
| **Security/RLS** | Billing roles; export throttled. |
| **Observability** | Job duration for payout sync; Stripe rate limit handling. |
| **Testing** | Multi-invoice payout; currency edge cases (if single-currency invariant, document). |
| **Rollout** | `BLITZPAY_PAYOUT_REPORTS=true`. |
| **Not in this phase** | General ledger replacement; tax filing. |

---

## 11. Phase 8: Convenience fee controls by tenant

| Field | Content |
|-------|---------|
| **Goal** | **Configurable** convenience/platform fee rules **per org** (within legal allowlist), versioned in **`blitzpay_fee_snapshots`** / `blitzpay_org_settings`. |
| **User-facing value** | Transparent “processing fee” line where legally allowed; tenant control where product permits. |
| **Database** | `blitzpay_org_settings` columns: modes, bps, caps, `effective_from`; audit who changed. |
| **API/routes** | `PATCH …/blitzpay/settings` (owner/admin); validate on server. |
| **UI** | Settings → Payments: **Fee policy** card; preview on sample invoice. |
| **Stripe/Connect** | Fee folded into **`application_fee_amount`** and/or gross `amount` per **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md` §4** — legal review before enable. |
| **Security/RLS** | Owner/admin only; platform admin read override for support. |
| **Observability** | Log policy version on each PI create. |
| **Testing** | Matrix: fee off / bps / fixed / cap; rounding to cent. |
| **Rollout** | `BLITZPAY_CONVENIENCE_FEES=true` + jurisdiction allowlist env. |
| **Not in this phase** | Card surcharge in all regions by default; dynamic surcharging by card brand. |

---

## 12. Phase 9: Customer portal payment history

| Field | Content |
|-------|---------|
| **Goal** | Portal users see **their** paid invoices and **card/ACH** labels (brand, last4) from Stripe when available — **read-only** history. |
| **User-facing value** | Customer self-service “did my payment go through?”. |
| **Database** | Read **`blitzpay_payment_intents`** + **`org_invoice_payments`** filtered by portal customer scope; optional denormalized **`portal_payment_receipts`** view. |
| **API/routes** | `GET /api/portal/.../payments` paginated; reuse portal auth. |
| **UI** | Portal **Invoices** or new **Payments** subpage; receipt download link (Stripe-hosted where possible). |
| **Stripe/Connect** | `charges.list` / PaymentIntent expand — **minimize** PII stored in Equipify. |
| **Security/RLS** | Strict portal RLS; never leak other customers’ payments. |
| **Observability** | Portal list latency; 429 rate if abused. |
| **Testing** | Cross-customer access attempts must fail. |
| **Rollout** | `BLITZPAY_PORTAL_HISTORY=true`. |
| **Not in this phase** | Saving payment methods for future (wallet); MIT without mandate. |

---

## 13. Phase 10: Admin / platform support tools

| Field | Content |
|-------|---------|
| **Goal** | **Platform admins** diagnose webhook failures, stuck PIs, and Connect state **without** production DB SQL. |
| **User-facing value** | Faster incident resolution; lower MTTR. |
| **Database** | Reads across orgs (service role) + **`blitzpay_webhook_inbox`** dead letters; optional **`blitzpay_support_actions`** audit table for replays. |
| **API/routes** | `app/api/platform/**` — search by `stripe_payment_intent_id`, `evt_*`, org slug; **read-only** v1. |
| **UI** | `app/admin/**` — BlitzPay panel per org; link to Stripe Dashboard. |
| **Stripe/Connect** | Dashboard deep links with `acct_*`. |
| **Security/RLS** | Platform admin email gate + service role; every action audited; **no** “replay webhook” without dual control in prod. |
| **Observability** | Cross-tenant metrics (counts only); PagerDuty on DLQ depth. |
| **Testing** | Role separation: non-admin cannot access. |
| **Rollout** | Internal-only until reviewed. |
| **Not in this phase** | Arbitrary SQL execution; bulk refund without safeguards. |

---

## 14. Phase 11: Subscription / add-on packaging for BlitzPay

| Field | Content |
|-------|---------|
| **Goal** | **Commercial** packaging: which **Equipify plan** includes BlitzPay, usage tiers (% fee caps), or add-on SKU — **billing metadata only**; actual **money movement** remains Connect. |
| **User-facing value** | Clear packaging; upgrade path for BlitzPay features. |
| **Database** | May use **`organization_feature_overrides`**, **`organization_subscriptions.metadata`**, or new **`blitzpay_entitlements`** — **do not** conflate with `organization_subscriptions.stripe_customer_id` (that is **tenant as SaaS customer**). |
| **API/routes** | Feature gate middleware for `prepare-pay`; admin plan editor (platform). |
| **UI** | Settings copy; upgrade modal; **Settings → Billing** cross-link “BlitzPay add-on” vs **tenant invoice pay**. |
| **Stripe/Connect** | SaaS **Checkout** for add-on if sold as subscription item — **separate** Checkout from BlitzPay invoice Checkout. |
| **Security/RLS** | Entitlements enforced server-side only. |
| **Observability** | Gate denials logged (`reason`, `org_id` hash). |
| **Testing** | Org without entitlement cannot create PI. |
| **Rollout** | `BLITZPAY_PACKAGING_ENFORCED=true`. |
| **Not in this phase** | Taking platform fee via SaaS invoice instead of `application_fee_amount`; single Stripe customer for both worlds. |

---

## 15. Phase 12: Advanced automation triggers

| Field | Content |
|-------|---------|
| **Goal** | Workflow hooks: e.g. **invoice sent** → auto create pay link; **payment failed** → communication template; integrate with **`workflow_automations`** / communications where appropriate. |
| **User-facing value** | Less manual chasing; consistent dunning. |
| **Database** | `blitzpay_automation_rules` or reuse existing automation tables with **`trigger = blitzpay_*`** keys. |
| **API/routes** | Internal emitters after webhook commit; cron for scheduled reminders. |
| **UI** | Settings → Automations: BlitzPay triggers; template picker. |
| **Stripe/Connect** | None new beyond existing APIs. |
| **Security/RLS** | Same as automations today; no secrets in rules JSON. |
| **Observability** | Rule execution counts; failure DLQ. |
| **Testing** | Idempotent “send reminder” (no duplicate email storms). |
| **Rollout** | Per-org opt-in flags. |
| **Not in this phase** | ML-based dynamic dunning; cross-tenant automation templates without review. |

---

## 16. Phase 13: Scale hardening for payments

| Field | Content |
|-------|---------|
| **Goal** | Implement **`docs/SCALE_READINESS_AUDIT.md`** items **specific to BlitzPay**: webhook **async inbox**, **rate limits** everywhere pay touches, **pagination** on all new lists, **payload caps**, **structured logs** + correlation ids. |
| **User-facing value** | Stable pay flows under load; fewer 5xx and timeouts. |
| **Database** | `blitzpay_webhook_inbox` if not shipped in Phase 2; indexes for dequeue; optional partitioning plan (doc only until needed). |
| **API/routes** | Refactor hot paths to **queue** or `waitUntil`; health `GET …/blitzpay/health` internal. |
| **UI** | Virtualized tables where lists grow. |
| **Stripe/Connect** | Respect Stripe rate limits; exponential backoff on Dashboard API pulls. |
| **Security/RLS** | Rate limit bypass only for signed internal jobs. |
| **Observability** | SLO dashboards: webhook success %, PI create latency, DLQ age. |
| **Testing** | Load test webhook burst; chaos: duplicate `evt_*`. |
| **Rollout** | Progressive region enable. |
| **Not in this phase** | Replacing Postgres; multi-region active-active. |

---

## 17. Phase 14: Mobile / offline considerations

| Field | Content |
|-------|---------|
| **Goal** | Field techs and customers on phones: **responsive** pay flows, deep links, and clear behavior when **offline** (queue actions, show “pending sync”). |
| **User-facing value** | Pay links work on mobile browsers; fewer broken layouts. |
| **Database** | Optional **`blitzpay_offline_outbox`** client-not-needed if server-only; usually **no** DB change — UX + PWA notes. |
| **API/routes** | Same as Phase 3; ensure **mobile Safari** compatibility for Checkout/PE. |
| **UI** | Touch targets, portal responsive audit; invoice drawer pay sheet. |
| **Stripe/Connect** | Mobile 3DS; return URL handling. |
| **Security/RLS** | Same; avoid storing cards in localStorage. |
| **Observability** | Mobile client error breadcrumbs (privacy-safe). |
| **Testing** | iOS Safari E2E smoke; low bandwidth. |
| **Rollout** | UX polish release. |
| **Not in this phase** | Native app store payments bypassing Stripe; offline card capture (PCI nightmare). |

---

## 18. Phase 15: Future not-now ideas

| Idea | Why later |
|------|-----------|
| **Multi-currency** | FX, tax, Connect account country matrix. |
| **Saved payment methods / wallet** | MIT compliance, mandate storage, stronger vault UX. |
| **In-person / Tap to Pay** | Different Stripe products; hardware scope. |
| **Marketplace / multi-party splits** | Not Equipify’s core contractor model v1. |
| **Crypto / BNPL** | Policy, processor support, reconciliation complexity. |
| **Blended SaaS + invoice single Checkout** | Confuses MoR and webhooks — explicitly out. |
| **Stripe Tax on invoice pay** | Product + data model extension. |

---

## 19. Recommended build order

1. **Phase 2** (all critical sub-phases through **allocation on success** + webhook expansion).  
2. **Phase 3** (customer + staff pay UX on top).  
3. **Phase 5** (refunds/failures — before heavy dashboard polish if real money live).  
4. **Phase 10** (support tools — parallel once Phase 2 webhooks exist).  
5. **Phase 4** (tenant dashboard).  
6. **Phase 13** (scale hardening — mandatory before large marketing push or high webhook volume).  
7. **Phase 6** → **7** → **8** → **9** as product priority dictates.  
8. **Phase 11** when packaging is commercially ready.  
9. **Phase 12** after core flows stable.  
10. **Phase 14** continuous improvement.  
11. **Phase 15** opportunistic.

---

## 20. “Do not skip” checklist

- [ ] **Separate webhook** from SaaS for all Connect payment events (`/api/blitzpay/webhook`).  
- [ ] **Idempotency** on `evt_*` and on **PI create** (Stripe + DB).  
- [ ] **Metadata** includes `organization_id` + `org_invoice_id` for every BlitzPay PI/Checkout.  
- [ ] **Invoice balance** updates only through **existing allocation** semantics + tests.  
- [ ] **Kill switch** env flag for BlitzPay pay in production.  
- [ ] **Rate limits** on pay create and portal pay.  
- [ ] **Refund** reverses ledger + invoice balance **atomically** (transaction or compensating pattern).  
- [ ] **Legal review** before convenience fees in production.  
- [ ] **Observability**: structured logs + DLQ visibility before broad rollout.

---

## 21. “Do not touch yet”

- **`/api/stripe/webhook`** dispatch logic for subscriptions — **no** BlitzPay event types routed there.  
- **`organization_subscriptions`** Stripe customer for **SaaS** — never use for **end-customer** invoice Checkout.  
- **QuickBooks** apply rules — coordinate in Phase 5/7 when changing payment rows to avoid double-apply (`apply-inbound-paid` semantics).  
- **Production surcharge defaults** — off until counsel approves.

---

## 22. Risks and open questions

| Risk / question | Mitigation |
|-----------------|------------|
| **Direct vs destination charge** | Locked in **Phase 2** arch as **direct**; revisit only with finance + Stripe rep. |
| **Webhook handler timeout** | Inbox + async worker (**Phase 2/13**). |
| **Double payment application** | Unique constraints + idempotent handlers; tests for reorder. |
| **QB sync** | Which direction for BlitzPay row — document before Phase 7/12. |
| **ACH return windows** | Longer pending states; separate UX in Phase 3/5. |
| **Cross-border Connect** | Phase 15; US-first assumption in v1 unless org already international. |

---

## 23. Appendix — likely files, routes, tables, and docs

### Tables (incremental across phases)

`organizations` (existing Connect cols); **`blitzpay_payment_intents`**, **`blitzpay_invoice_payment_attempts`**, **`blitzpay_fee_snapshots`**, **`blitzpay_ledger_entries`**, **`blitzpay_stripe_webhook_events`** (existing), optional **`blitzpay_webhook_inbox`**, **`blitzpay_org_settings`**; Phase 5+ **`blitzpay_refunds`**, **`blitzpay_disputes`**, optional **`blitzpay_payout_snapshots`**, **`blitzpay_automation_rules`** / reuse workflow tables; optional support **`blitzpay_support_actions`**.

### Routes / files (recurring)

- **Webhook:** `app/api/blitzpay/webhook/route.ts`  
- **BlitzPay lib:** `lib/blitzpay/*` (+ new `fees.ts`, `invoice-pay.ts`, `webhook-dispatch.ts`, `refunds.ts`, …)  
- **Org APIs:** `app/api/organizations/[organizationId]/blitzpay/**`  
- **Portal:** `app/api/portal/**` (invoice pay, history)  
- **Invoice UI:** `components/drawers/invoice-detail-view.tsx`, `PaymentModal`, `app/(dashboard)/invoices/page.tsx`  
- **Settings:** `app/(dashboard)/settings/payments/**`, `app/(dashboard)/settings/layout.tsx`  
- **Billing allocation:** `lib/billing/invoice-payment-allocation.ts`, `org_invoice_payments` migrations if new columns  
- **Admin:** `app/admin/**`, `app/api/platform/**`  
- **Docs:** `docs/BLITZPAY_ARCHITECTURE.md`, `docs/BLITZPAY_PHASE_1.md`, `docs/BLITZPAY_PHASE_2_ARCHITECTURE.md`, **`docs/BLITZPAY_REMAINING_PHASES_ROADMAP.md`**, `docs/SCALE_READINESS_AUDIT.md`, `docs/STRIPE_PRODUCTION_READINESS.md`, `docs/BLITZPAY_AUDIT.md`  
- **Env:** `.env.local.example` — BlitzPay flags and webhook secrets (distinct from SaaS).

---

## Related documents

- **`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md`** — technical schema and Phase 2.0–2.9 implementation checkpoints.  
- **`docs/BLITZPAY_ARCHITECTURE.md`** — north star and non-goals.  
- **`docs/BLITZPAY_PHASE_1.md`** — shipped onboarding scope.  
- **`docs/SCALE_READINESS_AUDIT.md`** — platform scale concerns affecting BlitzPay.

---

*Planning document only — no code or migrations included.*
