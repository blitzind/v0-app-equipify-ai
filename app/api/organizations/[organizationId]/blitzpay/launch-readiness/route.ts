import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import {
  blitzpaySchemaGuardNextResponse,
  runBlitzpaySchemaHealthCheckCached,
  type BlitzpaySchemaHealthResult,
} from "@/lib/blitzpay/blitzpay-schema-health"
import { ensureBlitzPayOrgSettings } from "@/lib/blitzpay/payment-repository"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import { isOutboundEmailConfigured } from "@/lib/email/config"
import {
  buildBlitzpayLaunchTechnicalDiagnostics,
  buildBlitzpayLaunchWorkspaceChecklist,
  blitzpayLaunchReadinessScore,
  blitzpayLaunchReadinessStatusPhrase,
  blitzpayLaunchReadinessSubline,
} from "@/lib/blitzpay/blitzpay-launch-readiness"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function schemaHealthTechnicalDetail(schema: BlitzpaySchemaHealthResult): string {
  if (schema.ok) return "PostgREST probe: organizations BlitzPay columns + critical BlitzPay tables responded."
  if (schema.kind === "schema_incomplete") {
    return `schema_incomplete · missing: ${schema.missing} · ${schema.detail}`
  }
  const code = "code" in schema && schema.code ? ` · code: ${schema.code}` : ""
  return `check_failed · ${schema.detail}${code}`
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const supabase = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  const gate = await gateBlitzPayManagement(supabase, auth.user, organizationId)
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden", message: gate.message }, { status: gate.status })
  }
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/launch-readiness",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  await ensureBlitzPayOrgSettings(admin, organizationId)

  const [{ data: org }, { data: settings }, schemaHealth, { count: successCount }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "stripe_connect_account_id, stripe_charges_enabled, stripe_connect_onboarding_complete, last_stripe_connect_sync_at",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    admin
      .from("blitzpay_org_settings")
      .select(
        [
          "blitzpay_invoice_pay_enabled",
          "blitzpay_payment_method_card_enabled",
          "blitzpay_payment_method_ach_enabled",
          "blitzpay_reminders_enabled",
          "blitzpay_receipt_emails_enabled",
        ].join(", "),
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    runBlitzpaySchemaHealthCheckCached(admin),
    admin
      .from("blitzpay_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "succeeded"),
  ])

  const o = org as {
    stripe_connect_account_id?: string | null
    stripe_charges_enabled?: boolean | null
    stripe_connect_onboarding_complete?: boolean | null
  } | null
  const s = settings as {
    blitzpay_invoice_pay_enabled?: boolean
    blitzpay_payment_method_card_enabled?: boolean
    blitzpay_payment_method_ach_enabled?: boolean
    blitzpay_reminders_enabled?: boolean
    blitzpay_receipt_emails_enabled?: boolean
  } | null

  const card = s?.blitzpay_payment_method_card_enabled !== false
  const ach = Boolean(s?.blitzpay_payment_method_ach_enabled)
  const workspaceArgs = {
    platformInvoicePayEnv: isBlitzPayInvoicePayEnabledEnv(),
    schemaHealthy: schemaHealth.ok,
    webhookSecretConfigured: Boolean(process.env.STRIPE_BLITZPAY_WEBHOOK_SECRET?.trim()),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    stripeConnectAccountPresent: Boolean(String(o?.stripe_connect_account_id ?? "").trim()),
    stripeChargesEnabled: Boolean(o?.stripe_charges_enabled),
    orgBlitzpayInvoicePayEnabled: Boolean(s?.blitzpay_invoice_pay_enabled),
    orgCardOrAchEnabled: card || ach,
    orgRemindersEnabled: s?.blitzpay_reminders_enabled !== false,
    orgReceiptEmailsEnabled: s?.blitzpay_receipt_emails_enabled !== false,
    outboundEmailConfigured: isOutboundEmailConfigured(),
    hasSuccessfulTestCapture: (successCount ?? 0) > 0,
  }
  const checklist = buildBlitzpayLaunchWorkspaceChecklist(workspaceArgs)
  const technicalDiagnostics = gate.platformAdmin
    ? buildBlitzpayLaunchTechnicalDiagnostics({
        platformInvoicePayEnv: workspaceArgs.platformInvoicePayEnv,
        webhookSecretConfigured: workspaceArgs.webhookSecretConfigured,
        cronSecretConfigured: workspaceArgs.cronSecretConfigured,
        schemaHealthy: schemaHealth.ok,
        schemaDiagnosticDetail: schemaHealthTechnicalDetail(schemaHealth),
      })
    : undefined

  return NextResponse.json({
    checklist,
    score: blitzpayLaunchReadinessScore(checklist),
    presentation: {
      statusPhrase: blitzpayLaunchReadinessStatusPhrase(checklist),
      subline: blitzpayLaunchReadinessSubline(checklist),
    },
    technicalDiagnostics,
  })
}
