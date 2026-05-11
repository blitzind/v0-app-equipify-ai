/**
 * BlitzPay launch readiness checklist (pure; callers supply booleans from env + DB).
 */

export type BlitzpayLaunchCheckItem = {
  id: string
  label: string
  ok: boolean
  detail: string
  /** Platform-admin-only rows (hidden on org checklist UIs). */
  platformOnly?: boolean
}

export type BlitzpayLaunchReadinessArgs = {
  audience: "platform" | "organization"
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
  /** Optional: set when org has at least one succeeded BlitzPay capture in DB. */
  hasSuccessfulTestCapture?: boolean
}

export function buildBlitzpayLaunchReadinessChecklist(input: BlitzpayLaunchReadinessArgs): BlitzpayLaunchCheckItem[] {
  const items: BlitzpayLaunchCheckItem[] = []

  if (input.audience === "platform") {
    items.push({
      id: "env_platform_pay",
      label: "Platform env BLITZPAY_INVOICE_PAY_ENABLED",
      ok: input.platformInvoicePayEnv,
      detail: input.platformInvoicePayEnv ? "Global BlitzPay invoice pay flag is on." : "Set to true to allow hosted invoice pay APIs.",
      platformOnly: true,
    })
    items.push({
      id: "webhook_secret",
      label: "BlitzPay webhook signing secret",
      ok: input.webhookSecretConfigured,
      detail: input.webhookSecretConfigured ? "STRIPE_BLITZPAY_WEBHOOK_SECRET appears configured." : "Configure STRIPE_BLITZPAY_WEBHOOK_SECRET for /api/blitzpay/webhook.",
      platformOnly: true,
    })
    items.push({
      id: "cron_secret",
      label: "Cron secret for reminder / scheduled jobs",
      ok: input.cronSecretConfigured,
      detail: input.cronSecretConfigured ? "CRON_SECRET is set (manual platform runs still work without cron)." : "Set CRON_SECRET for automated cron routes.",
      platformOnly: true,
    })
  }

  items.push({
    id: "schema",
    label: "Database schema (migrations)",
    ok: input.schemaHealthy,
    detail: input.schemaHealthy ? "BlitzPay schema health probe passed." : "Apply pending Supabase migrations; see BlitzPay schema health.",
  })

  items.push({
    id: "connect_ready",
    label: "Stripe Connect account ready",
    ok: input.stripeConnectAccountPresent && input.stripeChargesEnabled,
    detail:
      input.stripeConnectAccountPresent && input.stripeChargesEnabled ?
        "Connected account exists and charges are enabled."
      : "Finish Connect onboarding until charges_enabled is true.",
  })

  items.push({
    id: "hosted_pay",
    label: "Hosted invoice payments enabled (org)",
    ok: input.orgBlitzpayInvoicePayEnabled && input.platformInvoicePayEnv,
    detail:
      input.orgBlitzpayInvoicePayEnabled && input.platformInvoicePayEnv ?
        "Workspace online invoice pay is on and platform gate allows it."
      : "Enable BlitzPay invoice pay in workspace settings (and platform env for production).",
  })

  items.push({
    id: "payment_methods",
    label: "At least one pay method (card or ACH)",
    ok: input.orgCardOrAchEnabled,
    detail: input.orgCardOrAchEnabled ? "Card and/or ACH is enabled for this workspace." : "Enable card or ACH in BlitzPay settings.",
  })

  items.push({
    id: "receipt_email",
    label: "Receipt email path",
    ok: input.outboundEmailConfigured && input.orgReceiptEmailsEnabled,
    detail:
      input.outboundEmailConfigured && input.orgReceiptEmailsEnabled ?
        "Outbound mail is configured and automatic receipts are allowed for this org."
      : "Configure Resend/email env and enable receipt emails in BlitzPay settings.",
  })

  items.push({
    id: "reminders",
    label: "Collections reminders",
    ok: input.orgRemindersEnabled,
    detail: input.orgRemindersEnabled ? "Automated reminders are enabled for this workspace." : "Turn on reminder automation in BlitzPay settings when ready.",
  })

  items.push({
    id: "test_capture",
    label: "Successful test payment recorded",
    ok: input.hasSuccessfulTestCapture === true,
    detail:
      input.hasSuccessfulTestCapture === true ?
        "At least one succeeded BlitzPay capture is on file."
      : input.hasSuccessfulTestCapture === false ?
        "No succeeded BlitzPay captures found yet — run a small test payment."
      : "Run a test payment and confirm webhook booking (optional check).",
  })

  if (input.audience === "organization") {
    return items.filter((x) => !x.platformOnly)
  }
  return items
}

export function blitzpayLaunchReadinessScore(items: BlitzpayLaunchCheckItem[]): { passed: number; total: number } {
  const total = items.length
  const passed = items.filter((i) => i.ok).length
  return { passed, total }
}
