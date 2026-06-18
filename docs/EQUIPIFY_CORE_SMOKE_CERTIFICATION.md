# Equipify Core Smoke Certification (EC-7)

**QA marker:** `equipify-core-smoke-ec-7-v1`
**Production host:** https://app.equipify.ai
**Cert org:** fc7e7631-efb8-4e14-9db2-5c4cadfb74f0
**Executed at:** 2026-06-18T14:56:32.689Z
**Overall:** **PASS**

Validation-only smoke certification. No mutations, emails, live payments, or deploys.

## Module matrix

| Module | Pass | Fail | Blocked | Skipped | Status | Notes |
|--------|------|------|---------|---------|--------|-------|
| authentication | 7 | 0 | 0 | 2 | **pass** | auth_org_switcher: skipped; auth_role_switching: skipped |
| customers | 5 | 0 | 0 | 2 | **pass** | customers_edit_mutation: skipped; customers_archive_mutation: skipped |
| prospects | 3 | 0 | 0 | 3 | **pass** | prospects_create_mutation: skipped; prospects_convert_mutation: skipped; prospects_business_card_import: skipped |
| work_orders | 6 | 0 | 0 | 3 | **pass** | work_orders_edit_mutation: skipped; work_orders_status_mutation: skipped; work_orders_archive_mutation: skipped |
| quotes | 5 | 0 | 0 | 1 | **pass** | quotes_create_mutation: skipped |
| invoices | 5 | 0 | 0 | 1 | **pass** | invoices_create_mutation: skipped |
| purchase_orders | 3 | 0 | 0 | 2 | **pass** | purchase_orders_create_mutation: skipped; purchase_orders_email_mutation: skipped |
| blitzpay | 3 | 0 | 0 | 1 | **pass** | blitzpay_live_payment: skipped |
| portal | 10 | 0 | 0 | 1 | **pass** | portal_logout: skipped |
| notifications | 4 | 0 | 0 | 1 | **pass** | email_send_mutation: skipped |
| settings | 7 | 0 | 0 | 0 | **pass** | All exercised checks passed. |
| mobile_apis | 3 | 0 | 0 | 0 | **pass** | All exercised checks passed. |

## Check details

### authentication

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| supabase_bootstrap | **pass** | critical | Supabase bootstrapped (supabase_cli_linked_project). |
| auth_login_page | **pass** | critical | GET /login → HTTP 200 (expected 200). |
| auth_dashboard_redirect_unauthenticated | **pass** | critical | GET / → HTTP 307 (expected 307/302). |
| auth_password_reset_link | **pass** | medium | Forgot password link visible on /login (client-rendered UI). |
| staff_session_active | **pass** | critical | Cert-org staff session active. |
| auth_session_refresh | **pass** | high | Session persisted after page reload. |
| auth_logout_control_visible | **pass** | medium | Account hub control visible (logout not clicked). |
| auth_org_switcher | **skipped** | medium | Org switcher not detected (single-org session may hide control). |
| auth_role_switching | **skipped** | low | Role switching not exercised (requires permission mutation). |

### customers

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| customers_list_read | **pass** | critical | customers readable (5 row(s), limit 5). |
| customers_list_page | **pass** | critical | Customers list page renders. |
| customers_search_control | **pass** | high | Customer search input visible. |
| customers_create_control | **pass** | high | New customer control visible (not clicked). |
| customers_detail_fixture | **pass** | high | EC Test Customer detail page loads. |
| customers_edit_mutation | **skipped** | low | edit customer not exercised (EC-7 validation-only; no mutations/emails/payments). |
| customers_archive_mutation | **skipped** | low | archive customer not exercised (EC-7 validation-only; no mutations/emails/payments). |

### prospects

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| prospects_list_read | **pass** | high | prospects readable (5 row(s), limit 5). |
| prospects_list_page | **pass** | high | Prospects page renders. |
| prospects_create_mutation | **skipped** | low | create prospect not exercised (EC-7 validation-only; no mutations/emails/payments). |
| prospects_convert_mutation | **skipped** | low | convert prospect not exercised (EC-7 validation-only; no mutations/emails/payments). |
| prospects_business_card_import | **skipped** | low | business card import not exercised (EC-7 validation-only; no mutations/emails/payments). |
| api_prospects_list | **pass** | high | /api/organizations/fc7e7631-efb8-4e14-9db2-5c4cadfb74f0/prospects → HTTP 200. |

### work_orders

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| work_orders_list_read | **pass** | critical | work_orders readable (5 row(s), limit 5). |
| work_orders_bounded_client_query | **pass** | high | Client work_orders list query bounded with .limit(100) via WORK_ORDERS_LIST_PAGE_LIMIT. |
| work_orders_list_page | **pass** | critical | Work orders list page renders. |
| work_orders_create_control | **pass** | high | Work order create controls visible (Full Work Order / New Appointment; not clicked). |
| dispatch_page | **pass** | medium | Dispatch page loads for staff session. |
| work_orders_edit_mutation | **skipped** | low | edit work order not exercised (EC-7 validation-only; no mutations/emails/payments). |
| work_orders_status_mutation | **skipped** | low | status transition not exercised (EC-7 validation-only; no mutations/emails/payments). |
| work_orders_archive_mutation | **skipped** | low | archive work order not exercised (EC-7 validation-only; no mutations/emails/payments). |
| api_scheduling_events | **pass** | medium | /api/work-orders/scheduling-events → HTTP 400. |

### quotes

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| quotes_list_read | **pass** | critical | org_quotes readable (1 row(s), limit 5). |
| quotes_list_page | **pass** | critical | Quotes list page renders. |
| quotes_create_mutation | **skipped** | low | create quote not exercised (EC-7 validation-only; no mutations/emails/payments). |
| quotes_fixture_drawer | **pass** | high | EC Test Quote drawer opens. |
| quotes_pdf_prior_cert | **pass** | critical | Quote PDF generation certified in EC-6 (service-role buffer + route defined). |
| quotes_email_modal_prior_cert | **pass** | high | Quote email modal certified in EC-6B (no send). |

### invoices

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| invoices_list_read | **pass** | critical | org_invoices readable (1 row(s), limit 5). |
| invoices_list_page | **pass** | critical | Invoices list page renders. |
| invoices_create_mutation | **skipped** | low | create invoice not exercised (EC-7 validation-only; no mutations/emails/payments). |
| invoices_fixture_drawer | **pass** | high | EC Test Invoice drawer opens. |
| invoices_pdf_prior_cert | **pass** | critical | Invoice PDF generation certified in EC-6 (service-role buffer). |
| invoices_email_modal_prior_cert | **pass** | high | Invoice email modal certified in EC-6B (no send). |

### purchase_orders

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| purchase_orders_list_read | **pass** | medium | org_purchase_orders readable (0 row(s), limit 5). |
| vendors_list_read | **pass** | low | org_vendors readable (5 row(s), limit 5). |
| purchase_orders_list_page | **pass** | medium | Purchase orders page renders. |
| purchase_orders_create_mutation | **skipped** | low | create PO not exercised (EC-7 validation-only; no mutations/emails/payments). |
| purchase_orders_email_mutation | **skipped** | low | email PO not exercised (EC-7 validation-only; no mutations/emails/payments). |

### blitzpay

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| blitzpay_webhook_reachability | **pass** | high | GET /api/blitzpay/webhook → HTTP 405 (expected 400/401/405). |
| blitzpay_settings_page | **pass** | critical | BlitzPay/payments settings page renders. |
| blitzpay_live_payment | **skipped** | low | live payment not exercised (EC-7 validation-only; no mutations/emails/payments). |
| blitzpay_invoice_pay_disabled_ux | **pass** | high | BLITZPAY_INVOICE_PAY_ENABLED off — disabled-state expected on portal/staff pay surfaces. |

### portal

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| portal_login_page | **pass** | critical | GET /portal/login → HTTP 200 (expected 200). |
| portal_bootstrap_unauthenticated | **pass** | high | GET /api/portal/bootstrap → HTTP 401 (expected 401/403). |
| portal_access_exchange_invalid_token | **pass** | medium | GET /api/portal/access/exchange → HTTP 405 (expected 400/401/405). |
| portal_settings_page | **pass** | high | Portal settings page renders. |
| portal_login_token_exchange | **pass** | critical | Portal session restored from storage state. |
| portal_quote_detail | **pass** | critical | Portal quote detail accessible for EC Test Quote. |
| portal_invoice_detail | **pass** | critical | Portal invoice detail accessible for EC Test Invoice. |
| portal_customer_isolation | **pass** | critical | Portal session scoped to EC Test Customer fixture (EC-6 isolation cert). |
| portal_expired_link_handling | **pass** | high | Invalid portal token exchange → HTTP 401 (expected 400/401). |
| portal_logout | **skipped** | low | Portal logout not exercised (would invalidate session for subsequent checks). |
| portal_quote_approval_prior_cert | **pass** | critical | Portal quote approval workflow certified in EC-6. |

### notifications

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| communications_page | **pass** | high | Communications page loads. |
| settings_notifications_page | **pass** | high | Notification preferences page renders. |
| email_send_mutation | **skipped** | low | email send not exercised (EC-7 validation-only; no mutations/emails/payments). |
| api_notification_preferences | **pass** | high | /api/organizations/fc7e7631-efb8-4e14-9db2-5c4cadfb74f0/notification-preferences → HTTP 200. |
| api_communications_feed | **pass** | high | /api/organizations/fc7e7631-efb8-4e14-9db2-5c4cadfb74f0/communications?limit=5 → HTTP 200. |

### settings

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| billing_settings_auth_redirect | **pass** | high | GET /settings/billing → HTTP 307 (expected 307/302). |
| stripe_saas_webhook_reachability | **pass** | high | GET /api/stripe/webhook → HTTP 405 (expected 400/401/405). |
| settings_general_page | **pass** | medium | General settings page loads. |
| settings_team_page | **pass** | high | Team settings page renders. |
| settings_workspace_page | **pass** | high | Workspace branding/settings page loads. |
| settings_billing_page | **pass** | critical | Billing settings page renders. |
| settings_integrations_page | **pass** | medium | Integrations settings page loads. |

### mobile_apis

| Check | Status | Criticality | Detail |
|-------|--------|-------------|--------|
| technicians_today_page | **pass** | medium | Technician today view loads. |
| api_mobile_push_devices | **pass** | high | /api/organizations/fc7e7631-efb8-4e14-9db2-5c4cadfb74f0/mobile/push-devices → HTTP 405. |
| api_blitzpay_mobile_health | **pass** | high | /api/organizations/fc7e7631-efb8-4e14-9db2-5c4cadfb74f0/blitzpay/mobile/health → HTTP 200. |

## Production blockers

No critical/high failures in this smoke run.

## Runtime risks

- Work orders >100 rows: client list bounded (EC-3); server pagination backlog remains.
- Live email send and payment flows intentionally **skipped** in EC-7.
- Mutation paths (create/edit/archive/convert) require a dedicated mutation-cert phase.
- Local Vercel Sensitive secrets may be unavailable outside `vercel env run`.
