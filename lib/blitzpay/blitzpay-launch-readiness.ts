/**
 * BlitzPay launch readiness — workspace-facing checklist (product copy) plus
 * optional platform-admin technical diagnostics (env keys, schema probe text).
 */

export type BlitzpayLaunchCheckItem = {
  id: string
  label: string
  ok: boolean
  detail: string
}

export type BlitzpayLaunchReadinessWorkspaceArgs = {
  platformInvoicePayEnv: boolean
  schemaHealthy: boolean
  webhookSecretConfigured: boolean
  cronSecretConfigured: boolean
  stripeConnectAccountPresent: boolean
  stripeChargesEnabled: boolean
  orgBlitzpayInvoicePayEnabled: boolean
  orgCardOrAchEnabled: boolean
  orgRemindersEnabled: boolean
  orgReceiptEmailsEnabled: boolean
  outboundEmailConfigured: boolean
  /** Optional: at least one succeeded BlitzPay capture for this org. */
  hasSuccessfulTestCapture?: boolean
}

/**
 * Product-friendly checklist shown to workspace owners/admins and platform admins
 * on Settings → Payments. No raw env var names.
 */
export function buildBlitzpayLaunchWorkspaceChecklist(input: BlitzpayLaunchReadinessWorkspaceArgs): BlitzpayLaunchCheckItem[] {
  const items: BlitzpayLaunchCheckItem[] = []

  items.push({
    id: "platform_online_pay",
    label: "Online payment platform is enabled",
    ok: input.platformInvoicePayEnv,
    detail: input.platformInvoicePayEnv
      ? "This Equipify environment allows online customer payments for workspaces."
      : "Online customer payments are not enabled for this Equipify environment yet. Contact Equipify support if they should be on.",
  })

  items.push({
    id: "payment_webhooks",
    label: "Secure payment webhooks are connected",
    ok: input.webhookSecretConfigured,
    detail: input.webhookSecretConfigured
      ? "Payment events from Stripe can be received securely."
      : "Payment webhooks are not fully configured on the host — charges may not finalize. Contact Equipify support.",
  })

  items.push({
    id: "automated_payment_jobs",
    label: "Automated payment jobs are configured",
    ok: input.cronSecretConfigured,
    detail: input.cronSecretConfigured
      ? "Scheduled payment jobs (reminders, autopay runs) can run on a schedule."
      : "Scheduled payment jobs are not fully configured on the host — reminders and scheduled runs may not run automatically. Contact Equipify support.",
  })

  items.push({
    id: "database_setup",
    label: "BlitzPay database setup is complete",
    ok: input.schemaHealthy,
    detail: input.schemaHealthy
      ? "Payment data is stored in the expected database tables."
      : "Some payment database setup is incomplete. Contact Equipify support to apply pending updates.",
  })

  items.push({
    id: "stripe_account_ready",
    label: "Stripe account is ready",
    ok: input.stripeConnectAccountPresent && input.stripeChargesEnabled,
    detail:
      input.stripeConnectAccountPresent && input.stripeChargesEnabled
        ? "Your connected Stripe account can accept charges."
        : "Finish Stripe Connect onboarding above until your account can accept charges.",
  })

  items.push({
    id: "online_invoice_payments",
    label: "Online invoice payments are enabled",
    ok: input.orgBlitzpayInvoicePayEnabled && input.platformInvoicePayEnv,
    detail:
      input.orgBlitzpayInvoicePayEnabled && input.platformInvoicePayEnv
        ? "Your workspace accepts hosted invoice payments."
      : !input.platformInvoicePayEnv
        ? "Hosted invoice pay also requires the online payment platform to be enabled for this environment."
        : "Turn on online invoice payments in the BlitzPay settings above.",
  })

  items.push({
    id: "payment_methods",
    label: "Payment methods are enabled",
    ok: input.orgCardOrAchEnabled,
    detail: input.orgCardOrAchEnabled
      ? "Customers can pay with card and/or bank (ACH), based on your settings."
      : "Enable card or bank (ACH) in BlitzPay payment settings above.",
  })

  items.push({
    id: "receipt_emails",
    label: "Receipt emails are ready",
    ok: input.outboundEmailConfigured && input.orgReceiptEmailsEnabled,
    detail:
      input.outboundEmailConfigured && input.orgReceiptEmailsEnabled
        ? "Outbound email is configured and receipt emails are allowed for this workspace."
      : !input.outboundEmailConfigured
        ? "Outbound email is not configured on the host — receipt emails cannot be sent. Contact Equipify support."
        : "Turn on automatic receipt emails in BlitzPay settings above, or confirm outbound email with support.",
  })

  items.push({
    id: "reminders",
    label: "Payment reminders are enabled",
    ok: input.orgRemindersEnabled,
    detail: input.orgRemindersEnabled
      ? "Automated payment reminders are on for this workspace."
      : "Turn on payment reminders in BlitzPay settings when you want automated follow-ups.",
  })

  items.push({
    id: "test_capture",
    label: "Test payment completed",
    ok: input.hasSuccessfulTestCapture === true,
    detail:
      input.hasSuccessfulTestCapture === true
        ? "At least one successful online payment has been recorded for this workspace."
        : "Run a small test payment to confirm the full payment flow.",
  })

  return items
}

/** Platform admin only — raw keys and probe text for Admin / support. */
export function buildBlitzpayLaunchTechnicalDiagnostics(input: {
  platformInvoicePayEnv: boolean
  webhookSecretConfigured: boolean
  cronSecretConfigured: boolean
  schemaHealthy: boolean
  schemaDiagnosticDetail: string
}): BlitzpayLaunchCheckItem[] {
  return [
    {
      id: "tech_BLITZPAY_INVOICE_PAY_ENABLED",
      label: "BLITZPAY_INVOICE_PAY_ENABLED",
      ok: input.platformInvoicePayEnv,
      detail: input.platformInvoicePayEnv ? "Env flag is true (hosted invoice pay allowed globally)." : "Set to true to allow hosted invoice pay APIs.",
    },
    {
      id: "tech_STRIPE_BLITZPAY_WEBHOOK_SECRET",
      label: "STRIPE_BLITZPAY_WEBHOOK_SECRET",
      ok: input.webhookSecretConfigured,
      detail: input.webhookSecretConfigured ? "Signing secret is present for POST /api/blitzpay/webhook." : "Configure the Connect / BlitzPay webhook signing secret for /api/blitzpay/webhook.",
    },
    {
      id: "tech_CRON_SECRET",
      label: "CRON_SECRET",
      ok: input.cronSecretConfigured,
      detail: input.cronSecretConfigured ? "Cron routes can authenticate (reminders, scheduled payments, etc.)." : "Set CRON_SECRET so automated cron routes can run.",
    },
    {
      id: "tech_schema_probe",
      label: "Schema health probe",
      ok: input.schemaHealthy,
      detail: input.schemaDiagnosticDetail,
    },
  ]
}

export function blitzpayLaunchReadinessScore(items: BlitzpayLaunchCheckItem[]): { passed: number; total: number } {
  const total = items.length
  const passed = items.filter((i) => i.ok).length
  return { passed, total }
}

/**
 * Short status phrase after "Launch readiness:" — no env jargon.
 */
export function blitzpayLaunchReadinessStatusPhrase(items: BlitzpayLaunchCheckItem[]): string {
  const { passed, total } = blitzpayLaunchReadinessScore(items)
  if (total === 0) return "No checks"
  if (passed === total) return "Ready to go"
  if (passed >= total - 1) return "Almost ready"
  if (passed > 0) return "In progress"
  return "Needs attention"
}

export function blitzpayLaunchReadinessSubline(items: BlitzpayLaunchCheckItem[]): string {
  const { passed, total } = blitzpayLaunchReadinessScore(items)
  if (total === 0) return ""
  return `${passed} of ${total} checks complete.`
}
