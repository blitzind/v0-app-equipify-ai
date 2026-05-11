import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin, isOutboundEmailConfigured } from "@/lib/email/config"
import { sendEmail } from "@/lib/email/resend"
import { isValidEmail } from "@/lib/email/format"
import { buildInvoicePaymentReceiptShape } from "@/lib/blitzpay/invoice-payment-receipt"
import { buildBlitzPayPaymentReceiptViewModel } from "@/lib/blitzpay/blitzpay-payment-receipt-view-model"
import {
  buildBlitzpayCustomerReceiptEmailContent,
  buildBlitzpayStaffPaymentReceivedEmailContent,
} from "@/lib/email/templates/blitzpay-payment-receipt-content"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { blitzpayAutomaticCustomerReceiptBlockedByInvoicePreference } from "@/lib/blitzpay/blitzpay-receipt-email-policy"

type DispatchTarget = "customer_receipt" | "staff_alert"
type DispatchSource = "webhook_auto" | "staff_resend"
type SendStatus =
  | "queued"
  | "sent"
  | "skipped_no_email"
  | "skipped_unconfigured"
  | "skipped_preference"
  | "skipped_org_disabled"
  | "failed"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

async function insertDispatchRow(
  admin: SupabaseClient,
  row: {
    organization_id: string
    org_invoice_id: string
    blitzpay_payment_intent_id: string
    source_kind: DispatchSource
    target_channel: DispatchTarget
    send_status: SendStatus
    provider_message_id?: string | null
    error_detail?: string | null
  },
): Promise<{ id: string | null; duplicate: boolean }> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("blitzpay_payment_receipt_dispatches")
    .insert({
      organization_id: row.organization_id,
      org_invoice_id: row.org_invoice_id,
      blitzpay_payment_intent_id: row.blitzpay_payment_intent_id,
      source_kind: row.source_kind,
      target_channel: row.target_channel,
      send_status: row.send_status,
      provider_message_id: row.provider_message_id ?? null,
      error_detail: row.error_detail ?? null,
      updated_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (isUniqueViolation(error)) return { id: null, duplicate: true }
    throw new Error(error.message)
  }
  const id = (data as { id?: string } | null)?.id ?? null
  return { id, duplicate: false }
}

async function updateDispatchRow(
  admin: SupabaseClient,
  id: string,
  patch: { send_status: SendStatus; provider_message_id?: string | null; error_detail?: string | null },
): Promise<void> {
  const { error } = await admin
    .from("blitzpay_payment_receipt_dispatches")
    .update({
      send_status: patch.send_status,
      provider_message_id: patch.provider_message_id ?? null,
      error_detail: patch.error_detail ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) throw new Error(error.message)
}

async function fetchReceiptContext(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
  internalBlitzpayPaymentIntentId: string,
  stripePaymentIntentIdForRef: string,
  invoicePortionCents: number,
  paidOnYyyyMmDd: string,
  currency: string,
): Promise<{
  viewModel: ReturnType<typeof buildBlitzPayPaymentReceiptViewModel>
  customerTo: string | null
  customerId: string | null
  invoiceDeliveryPreference: string | null
} | null> {
  const [{ data: org }, { data: inv }, { data: piRow }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    admin
      .from("org_invoices")
      .select("invoice_number, title, billing_contact_email, customer_id")
      .eq("organization_id", organizationId)
      .eq("id", orgInvoiceId)
      .maybeSingle(),
    admin
      .from("blitzpay_payment_intents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", internalBlitzpayPaymentIntentId)
      .maybeSingle(),
  ])

  if (!piRow) return null
  if (!inv) return null

  const invRow = inv as {
    invoice_number?: string | null
    title?: string | null
    billing_contact_email?: string | null
    customer_id: string | null
  }
  const custId = invRow.customer_id
  let customerName = "Customer"
  let billingEmail: string | null = null
  let invoiceDeliveryPreference: string | null = null
  if (custId) {
    const { data: cust } = await admin
      .from("customers")
      .select("company_name, billing_email, invoice_delivery_preference")
      .eq("organization_id", organizationId)
      .eq("id", custId)
      .maybeSingle()
    const c = cust as {
      company_name?: string | null
      billing_email?: string | null
      invoice_delivery_preference?: string | null
    } | null
    if (c) {
      customerName = (c.company_name ?? "").trim() || customerName
      billingEmail = (c.billing_email ?? "").trim() || null
      invoiceDeliveryPreference = (c.invoice_delivery_preference ?? "").trim() || null
    }
  }

  const invEmail = (invRow.billing_contact_email ?? "").trim()
  const customerTo =
    invEmail && isValidEmail(invEmail) ? invEmail : billingEmail && isValidEmail(billingEmail) ? billingEmail : null

  const orgName = String((org as { name?: string | null } | null)?.name ?? "").trim() || "Organization"
  const invNum = String(invRow.invoice_number ?? "").trim() || String(orgInvoiceId).slice(0, 8)

  const shape = buildInvoicePaymentReceiptShape({
    organizationName: orgName,
    customerName,
    invoiceNumber: invNum,
    amountPaidCents: invoicePortionCents,
    paidOnYyyyMmDd,
    referenceRaw: `blitzpay_pi:${stripePaymentIntentIdForRef}`,
  })

  const origin = getPublicAppOrigin()
  const portalUrl = `${origin}/portal/invoices/${encodeURIComponent(orgInvoiceId)}`

  const viewModel = buildBlitzPayPaymentReceiptViewModel(shape, {
    currencyCode: currency,
    portalInvoiceAbsoluteUrl: portalUrl,
  })

  return { viewModel, customerTo, customerId: custId, invoiceDeliveryPreference }
}

async function fetchStaffNotifyEmails(admin: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data: members, error: mErr } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])

  if (mErr) throw new Error(mErr.message)
  const userIds = [...new Set((members ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean))]
  if (userIds.length === 0) return []

  const { data: profs, error: pErr } = await admin.from("profiles").select("email").in("id", userIds)
  if (pErr) throw new Error(pErr.message)

  const out: string[] = []
  const seen = new Set<string>()
  for (const p of (profs ?? []) as Array<{ email?: string | null }>) {
    const em = typeof p.email === "string" ? p.email.trim() : ""
    if (em && isValidEmail(em) && !seen.has(em.toLowerCase())) {
      seen.add(em.toLowerCase())
      out.push(em)
    }
    if (out.length >= 15) break
  }
  return out
}

export type BlitzpayReceiptDispatchArgs = {
  organizationId: string
  orgInvoiceId: string
  internalBlitzpayPaymentIntentId: string
  stripePaymentIntentId: string
  invoicePortionCents: number
  paidOnYyyyMmDd: string
  currency: string
  /** Webhook path uses `webhook_auto`; staff resend uses `staff_resend`. */
  sourceKind: DispatchSource
}

/**
 * Sends customer receipt + optional staff digest for one BlitzPay capture.
 * Never throws: logs errors; payment booking must not depend on email.
 */
export async function dispatchBlitzpayPaymentReceiptEmails(
  admin: SupabaseClient,
  args: BlitzpayReceiptDispatchArgs,
): Promise<void> {
  assertUuid(args.organizationId, "organizationId")
  assertUuid(args.orgInvoiceId, "orgInvoiceId")
  assertUuid(args.internalBlitzpayPaymentIntentId, "internalBlitzpayPaymentIntentId")

  try {
    await dispatchBlitzpayPaymentReceiptEmailsInner(admin, args)
    return
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "blitzpay-receipt-dispatch",
        message: "dispatch_outer_exception",
        organizationId: args.organizationId,
        detail: msg,
      }),
    )
  }
}

async function dispatchBlitzpayPaymentReceiptEmailsInner(
  admin: SupabaseClient,
  args: BlitzpayReceiptDispatchArgs,
): Promise<{ staffResendCustomerDispatchId?: string }> {
  const ctx = await fetchReceiptContext(
    admin,
    args.organizationId,
    args.orgInvoiceId,
    args.internalBlitzpayPaymentIntentId,
    args.stripePaymentIntentId,
    args.invoicePortionCents,
    args.paidOnYyyyMmDd,
    args.currency,
  )

  if (!ctx) {
    console.warn(
      JSON.stringify({
        source: "blitzpay-receipt-dispatch",
        message: "skip_missing_context",
        organizationId: args.organizationId,
        orgInvoiceId: args.orgInvoiceId,
      }),
    )
    return {}
  }

  const { viewModel, customerTo, customerId, invoiceDeliveryPreference } = ctx
  const emailConfigured = isOutboundEmailConfigured()
  const blockAutoByPreference = blitzpayAutomaticCustomerReceiptBlockedByInvoicePreference(invoiceDeliveryPreference)
  const { data: orgReceiptRow } = await admin
    .from("blitzpay_org_settings")
    .select("blitzpay_receipt_emails_enabled")
    .eq("organization_id", args.organizationId)
    .maybeSingle()
  const orgReceiptEmailsEnabled =
    (orgReceiptRow as { blitzpay_receipt_emails_enabled?: boolean } | null)?.blitzpay_receipt_emails_enabled !== false

  // --- Customer receipt ---
  if (args.sourceKind === "webhook_auto") {
    const claim = await insertDispatchRow(admin, {
      organization_id: args.organizationId,
      org_invoice_id: args.orgInvoiceId,
      blitzpay_payment_intent_id: args.internalBlitzpayPaymentIntentId,
      source_kind: "webhook_auto",
      target_channel: "customer_receipt",
      send_status: "queued",
    })
    if (!claim.duplicate && claim.id) {
      const dispatchId = claim.id
      try {
        if (!orgReceiptEmailsEnabled) {
          await updateDispatchRow(admin, dispatchId, {
            send_status: "skipped_org_disabled",
            error_detail: "blitzpay_receipt_emails_enabled_false",
          })
        } else if (!emailConfigured) {
          await updateDispatchRow(admin, dispatchId, { send_status: "skipped_unconfigured" })
        } else if (blockAutoByPreference) {
          await updateDispatchRow(admin, dispatchId, {
            send_status: "skipped_preference",
            error_detail: "invoice_delivery_preference_not_email",
          })
        } else if (!customerTo) {
          await updateDispatchRow(admin, dispatchId, { send_status: "skipped_no_email" })
        } else {
          const { subject, html, text } = buildBlitzpayCustomerReceiptEmailContent(viewModel)
          const send = await sendEmail({
            to: customerTo,
            subject,
            html,
            text,
            category: "blitzpay_invoice_payment_receipt",
            organizationId: args.organizationId,
          })
          if (!send.ok) {
            await updateDispatchRow(admin, dispatchId, {
              send_status: "failed",
              error_detail: send.error?.slice(0, 500) ?? "send_failed",
            })
            console.warn(
              JSON.stringify({
                source: "blitzpay-receipt-dispatch",
                message: "customer_receipt_send_failed",
                organizationId: args.organizationId,
                orgInvoiceId: args.orgInvoiceId,
                detail: send.error,
              }),
            )
          } else {
            await updateDispatchRow(admin, dispatchId, {
              send_status: "sent",
              provider_message_id: send.id ?? null,
            })
            await logCommunicationEvent(admin, {
              organizationId: args.organizationId,
              channel: "email",
              eventType: "blitzpay_payment_receipt",
              title: `Payment receipt: ${viewModel.invoiceNumber}`,
              summary: `To ${customerTo}`,
              audience: "customer_timeline",
              countsTowardUnread: false,
              deliveryStatus: "sent",
              recipientKind: "customer",
              recipientCustomerId: customerId,
              recipientAddress: customerTo,
              relatedEntityType: "invoice",
              relatedEntityId: args.orgInvoiceId,
              provider: "resend",
              providerMessageId: send.id ?? null,
              sentAt: new Date().toISOString(),
              createdBy: null,
              metadata: { blitzpay: true, auto: true },
            })
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await updateDispatchRow(admin, dispatchId, { send_status: "failed", error_detail: msg.slice(0, 500) }).catch(
          () => {},
        )
        console.error(
          JSON.stringify({
            source: "blitzpay-receipt-dispatch",
            message: "customer_receipt_exception",
            organizationId: args.organizationId,
            detail: msg,
          }),
        )
      }
    }
  } else {
    // staff_resend: new dispatch row each time; intentional duplicate sends allowed.
    if (!emailConfigured) {
      throw new Error("outbound_email_not_configured")
    }
    if (!customerTo) {
      throw new Error("no_customer_email")
    }
    const ins = await insertDispatchRow(admin, {
      organization_id: args.organizationId,
      org_invoice_id: args.orgInvoiceId,
      blitzpay_payment_intent_id: args.internalBlitzpayPaymentIntentId,
      source_kind: "staff_resend",
      target_channel: "customer_receipt",
      send_status: "queued",
    })
    if (!ins.id) {
      throw new Error("dispatch_row_not_created")
    }
    const dispatchId = ins.id
    try {
      const { subject, html, text } = buildBlitzpayCustomerReceiptEmailContent(viewModel)
      const send = await sendEmail({
        to: customerTo,
        subject: `[Copy] ${subject}`,
        html,
        text,
        category: "blitzpay_invoice_payment_receipt_resend",
        organizationId: args.organizationId,
      })
      if (!send.ok) {
        await updateDispatchRow(admin, dispatchId, {
          send_status: "failed",
          error_detail: send.error?.slice(0, 500) ?? "send_failed",
        })
      } else {
        await updateDispatchRow(admin, dispatchId, {
          send_status: "sent",
          provider_message_id: send.id ?? null,
        })
        await logCommunicationEvent(admin, {
          organizationId: args.organizationId,
          channel: "email",
          eventType: "blitzpay_payment_receipt_resend",
          title: `Payment receipt (resent): ${viewModel.invoiceNumber}`,
          summary: `To ${customerTo}`,
          audience: "customer_timeline",
          countsTowardUnread: false,
          deliveryStatus: "sent",
          recipientKind: "customer",
          recipientCustomerId: customerId,
          recipientAddress: customerTo,
          relatedEntityType: "invoice",
          relatedEntityId: args.orgInvoiceId,
          provider: "resend",
          providerMessageId: send.id ?? null,
          sentAt: new Date().toISOString(),
          createdBy: null,
          metadata: { blitzpay: true, staffResend: true },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await updateDispatchRow(admin, dispatchId, { send_status: "failed", error_detail: msg.slice(0, 500) }).catch(
        () => {},
      )
      throw e
    }
    return { staffResendCustomerDispatchId: dispatchId }
  }

  // --- Staff alert (webhook_auto only; resend does not re-spam staff) ---
  if (args.sourceKind === "webhook_auto") {
    const claim = await insertDispatchRow(admin, {
      organization_id: args.organizationId,
      org_invoice_id: args.orgInvoiceId,
      blitzpay_payment_intent_id: args.internalBlitzpayPaymentIntentId,
      source_kind: "webhook_auto",
      target_channel: "staff_alert",
      send_status: "queued",
    })
    if (claim.duplicate || !claim.id) {
      return {}
    }
    const dispatchId = claim.id
    try {
      if (!emailConfigured) {
        await updateDispatchRow(admin, dispatchId, { send_status: "skipped_unconfigured" })
        return {}
      }
      const staffEmails = await fetchStaffNotifyEmails(admin, args.organizationId)
      if (staffEmails.length === 0) {
        await updateDispatchRow(admin, dispatchId, { send_status: "skipped_no_email" })
        return {}
      }
      const { subject, html, text } = buildBlitzpayStaffPaymentReceivedEmailContent(viewModel)
      const send = await sendEmail({
        to: staffEmails,
        subject,
        html,
        text,
        category: "blitzpay_staff_payment_received",
        organizationId: args.organizationId,
      })
      if (!send.ok) {
        await updateDispatchRow(admin, dispatchId, {
          send_status: "failed",
          error_detail: send.error?.slice(0, 500) ?? "send_failed",
        })
        console.warn(
          JSON.stringify({
            source: "blitzpay-receipt-dispatch",
            message: "staff_alert_send_failed",
            organizationId: args.organizationId,
            detail: send.error,
          }),
        )
      } else {
        await updateDispatchRow(admin, dispatchId, {
          send_status: "sent",
          provider_message_id: send.id ?? null,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await updateDispatchRow(admin, dispatchId, { send_status: "failed", error_detail: msg.slice(0, 500) }).catch(
        () => {},
      )
      console.error(
        JSON.stringify({
          source: "blitzpay-receipt-dispatch",
          message: "staff_alert_exception",
          organizationId: args.organizationId,
          detail: msg,
        }),
      )
    }
  }
  return {}
}

export type StaffBlitzpayReceiptResendResult =
  | { ok: true; dispatchId: string }
  | { ok: false; code: "bad_request" | "not_found" | "not_configured" | "no_customer_email" | "send_failed"; message: string }

/**
 * Staff-only resend of the customer-safe receipt email. Does not honor invoice_delivery_preference
 * (operator explicitly chose to send). Throws only on unexpected DB errors; map to result in route.
 */
export async function executeStaffBlitzpayReceiptResend(
  admin: SupabaseClient,
  args: {
    organizationId: string
    orgInvoiceId: string
    internalBlitzpayPaymentIntentId: string
  },
): Promise<StaffBlitzpayReceiptResendResult> {
  assertUuid(args.organizationId, "organizationId")
  assertUuid(args.orgInvoiceId, "orgInvoiceId")
  assertUuid(args.internalBlitzpayPaymentIntentId, "internalBlitzpayPaymentIntentId")

  if (!isOutboundEmailConfigured()) {
    return { ok: false, code: "not_configured", message: "Outbound email is not configured for this environment." }
  }

  const { data: pi, error: pErr } = await admin
    .from("blitzpay_payment_intents")
    .select("id, organization_id, org_invoice_id, stripe_payment_intent_id, currency")
    .eq("id", args.internalBlitzpayPaymentIntentId)
    .maybeSingle()

  if (pErr) throw new Error(pErr.message)
  const prow = pi as {
    id: string
    organization_id: string
    org_invoice_id: string | null
    stripe_payment_intent_id: string
    currency: string | null
  } | null
  if (!prow || prow.organization_id !== args.organizationId || prow.org_invoice_id !== args.orgInvoiceId) {
    return { ok: false, code: "not_found", message: "BlitzPay payment intent not found for this invoice." }
  }

  const ref = `blitzpay_pi:${prow.stripe_payment_intent_id}`
  const { data: pay, error: payErr } = await admin
    .from("org_invoice_payments")
    .select("id, amount_cents, paid_on")
    .eq("organization_id", args.organizationId)
    .eq("invoice_id", args.orgInvoiceId)
    .eq("reference", ref)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (payErr) throw new Error(payErr.message)
  const payRow = pay as { amount_cents: number; paid_on: string } | null
  if (!payRow) {
    return { ok: false, code: "bad_request", message: "No booked invoice payment found for this BlitzPay intent yet." }
  }

  const paidOn = String(payRow.paid_on ?? "").slice(0, 10)
  const cents = Math.round(Number(payRow.amount_cents))

  let resendDispatchId: string | undefined
  try {
    const inner = await dispatchBlitzpayPaymentReceiptEmailsInner(admin, {
      organizationId: args.organizationId,
      orgInvoiceId: args.orgInvoiceId,
      internalBlitzpayPaymentIntentId: prow.id,
      stripePaymentIntentId: prow.stripe_payment_intent_id,
      invoicePortionCents: cents,
      paidOnYyyyMmDd: paidOn,
      currency: (prow.currency ?? "usd").trim().toLowerCase() || "usd",
      sourceKind: "staff_resend",
    })
    resendDispatchId = inner.staffResendCustomerDispatchId
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "outbound_email_not_configured") {
      return { ok: false, code: "not_configured", message: "Outbound email is not configured for this environment." }
    }
    if (msg === "no_customer_email") {
      return { ok: false, code: "no_customer_email", message: "No billing email on file for this invoice or customer." }
    }
    if (msg === "dispatch_row_not_created") {
      return { ok: false, code: "send_failed", message: "Could not record receipt dispatch." }
    }
    return { ok: false, code: "send_failed", message: msg || "Receipt email could not be sent." }
  }

  if (!resendDispatchId) {
    return { ok: false, code: "send_failed", message: "Receipt dispatch did not complete." }
  }

  const { data: rowData, error: rowErr } = await admin
    .from("blitzpay_payment_receipt_dispatches")
    .select("send_status, error_detail")
    .eq("id", resendDispatchId)
    .maybeSingle()

  if (rowErr) throw new Error(rowErr.message)
  const row = rowData as { send_status: string; error_detail: string | null } | null
  if (!row || row.send_status !== "sent") {
    return {
      ok: false,
      code: "send_failed",
      message: row?.error_detail?.trim() || "Receipt email could not be sent.",
    }
  }
  return { ok: true, dispatchId: resendDispatchId }
}
