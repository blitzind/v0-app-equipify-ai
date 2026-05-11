import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { summarizeBlitzpayBalanceTransactions } from "@/lib/blitzpay/blitzpay-reconciliation-math"
import { refreshBlitzpayOrgTreasuryState } from "@/lib/blitzpay/blitzpay-contractor-treasury"

export type ResolveConnectAccountOrgResult =
  | { ok: true; organizationId: string }
  | { ok: false; reason: "none" | "ambiguous" }

export async function resolveBlitzpayOrganizationForConnectAccount(
  admin: SupabaseClient,
  stripeConnectAccountId: string,
): Promise<ResolveConnectAccountOrgResult> {
  const acct = stripeConnectAccountId.trim()
  if (!acct) return { ok: false, reason: "none" }
  const { data, error } = await admin.from("organizations").select("id").eq("stripe_connect_account_id", acct)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ id: string }>
  if (rows.length === 0) return { ok: false, reason: "none" }
  if (rows.length > 1) return { ok: false, reason: "ambiguous" }
  return { ok: true, organizationId: rows[0].id }
}

function payoutArrivalDate(payout: Stripe.Payout): string | null {
  const n = payout.arrival_date
  if (typeof n === "number" && Number.isFinite(n)) {
    return new Date(n * 1000).toISOString().slice(0, 10)
  }
  return null
}

function isoFromUnixSeconds(sec: number | undefined | null): string {
  if (typeof sec !== "number" || !Number.isFinite(sec)) return new Date().toISOString()
  return new Date(sec * 1000).toISOString()
}

export async function upsertBlitzpayPayoutRow(
  admin: SupabaseClient,
  organizationId: string,
  stripeConnectAccountId: string,
  payout: Stripe.Payout,
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  const acct = stripeConnectAccountId.trim()
  const row = {
    organization_id: organizationId,
    stripe_connect_account_id: acct,
    stripe_payout_id: payout.id,
    status: payout.status,
    amount_cents: payout.amount,
    currency: String(payout.currency || "usd").toLowerCase(),
    arrival_date: payoutArrivalDate(payout),
    stripe_created_at: isoFromUnixSeconds(payout.created),
    livemode: Boolean(payout.livemode),
    method: payout.method ?? null,
    description: payout.description ?? null,
    failure_message: payout.failure_message ?? null,
    failure_code: payout.failure_code ?? null,
    automatic: typeof payout.automatic === "boolean" ? payout.automatic : null,
    metadata: (payout.metadata as Record<string, unknown>) ?? {},
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from("blitzpay_payouts")
    .upsert(row, { onConflict: "stripe_payout_id" })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id }
}

async function resolveBlitzpayPaymentIntentIdForCharge(
  admin: SupabaseClient,
  organizationId: string,
  chargeId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("blitzpay_ledger_entries")
    .select("blitzpay_payment_intent_id")
    .eq("organization_id", organizationId)
    .eq("entry_type", "payment_captured")
    .eq("stripe_object_id", chargeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const id = (data as { blitzpay_payment_intent_id?: string | null } | null)?.blitzpay_payment_intent_id ?? null
  return id && id.length > 0 ? id : null
}

function stripeSourceId(bt: Stripe.BalanceTransaction): string | null {
  const s = bt.source
  if (typeof s === "string" && s.length > 0) return s
  if (s && typeof s === "object" && "id" in s && typeof (s as { id?: string }).id === "string") {
    return (s as { id: string }).id
  }
  return null
}

export async function upsertBlitzpayBalanceTransactionRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    stripeConnectAccountId: string
    blitzpayPayoutId: string
    stripePayoutId: string
    bt: Stripe.BalanceTransaction
    blitzpayPaymentIntentId: string | null
  },
): Promise<void> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.blitzpayPayoutId, "blitzpayPayoutId")
  const bt = input.bt
  const availableOn =
    typeof bt.available_on === "number" && Number.isFinite(bt.available_on)
      ? new Date(bt.available_on * 1000).toISOString().slice(0, 10)
      : null

  const row = {
    organization_id: input.organizationId,
    stripe_connect_account_id: input.stripeConnectAccountId.trim(),
    blitzpay_payout_id: input.blitzpayPayoutId,
    stripe_payout_id: input.stripePayoutId,
    stripe_balance_transaction_id: bt.id,
    balance_type: bt.type,
    reporting_category: bt.reporting_category ?? null,
    stripe_source_id: stripeSourceId(bt),
    blitzpay_payment_intent_id: input.blitzpayPaymentIntentId,
    gross_cents: bt.amount,
    fee_cents: bt.fee,
    net_cents: bt.net,
    currency: String(bt.currency || "usd").toLowerCase(),
    stripe_created_at: isoFromUnixSeconds(bt.created),
    livemode: Boolean(bt.livemode),
    available_on: availableOn,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
  }

  const { error } = await admin
    .from("blitzpay_balance_transactions")
    .upsert(row, { onConflict: "organization_id,stripe_balance_transaction_id" })

  if (error) throw new Error(error.message)
}

/**
 * Lists balance transactions allocated to a payout on the connected account and upserts them.
 * Idempotent per (organization_id, stripe_balance_transaction_id).
 */
export async function syncBlitzpayPayoutBalanceTransactions(
  admin: SupabaseClient,
  organizationId: string,
  stripeConnectAccountId: string,
  stripePayoutId: string,
  blitzpayPayoutUuid: string,
): Promise<{ upserted: number }> {
  const stripe = getStripe()
  let upserted = 0
  let startingAfter: string | undefined
  while (true) {
    const page = await stripe.balanceTransactions.list(
      { payout: stripePayoutId, limit: 100, starting_after: startingAfter },
      { stripeAccount: stripeConnectAccountId },
    )
    for (const bt of page.data) {
      let internalPi: string | null = null
      const payLike = bt.type === "payment" || bt.type === "charge"
      if (payLike) {
        const src = stripeSourceId(bt)
        if (src && src.startsWith("ch_")) {
          internalPi = await resolveBlitzpayPaymentIntentIdForCharge(admin, organizationId, src)
        }
      }
      await upsertBlitzpayBalanceTransactionRow(admin, {
        organizationId,
        stripeConnectAccountId,
        blitzpayPayoutId: blitzpayPayoutUuid,
        stripePayoutId,
        bt,
        blitzpayPaymentIntentId: internalPi,
      })
      upserted += 1
    }
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }

  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from("blitzpay_payouts")
    .update({
      balance_transaction_synced_at: now,
      balance_transaction_count: upserted,
      updated_at: now,
    })
    .eq("id", blitzpayPayoutUuid)

  if (upErr) throw new Error(upErr.message)
  return { upserted }
}

export async function dispatchBlitzpayPayoutWebhook(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const acct = typeof event.account === "string" && event.account.length > 0 ? event.account : null
  if (!acct) {
    console.info(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "payout event missing connected account — skipping",
        eventId: event.id,
        eventType: event.type,
      }),
    )
    return
  }

  const resolved = await resolveBlitzpayOrganizationForConnectAccount(admin, acct)
  if (!resolved.ok) {
    console.info(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: `payout event org resolve ${resolved.reason}`,
        eventId: event.id,
        eventType: event.type,
        connectAccount: acct,
      }),
    )
    return
  }

  const payout = event.data.object as Stripe.Payout
  const { id: blitzpayPayoutUuid } = await upsertBlitzpayPayoutRow(admin, resolved.organizationId, acct, payout)

  let btCount = 0
  try {
    const r = await syncBlitzpayPayoutBalanceTransactions(
      admin,
      resolved.organizationId,
      acct,
      payout.id,
      blitzpayPayoutUuid,
    )
    btCount = r.upserted
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "payout balance transaction sync failed (payout row still saved)",
        eventId: event.id,
        detail: msg.slice(0, 400),
        stripePayoutId: payout.id,
      }),
    )
  }

  try {
    await refreshBlitzpayOrgTreasuryState(admin, resolved.organizationId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "treasury refresh after payout failed (non-fatal)",
        eventId: event.id,
        detail: msg.slice(0, 400),
      }),
    )
  }

  if (event.type === "payout.paid") {
    const { error: runErr } = await admin.from("blitzpay_reconciliation_runs").insert({
      organization_id: resolved.organizationId,
      trigger: "webhook_payout",
      status: "success",
      stripe_connect_account_id: acct,
      stripe_payout_id: payout.id,
      payouts_touched: 1,
      balance_transactions_upserted: btCount,
      summary: { event_type: event.type, stripe_event_id: event.id },
      finished_at: new Date().toISOString(),
    })
    if (runErr) {
      console.warn(
        JSON.stringify({
          source: "blitzpay-webhook",
          message: "reconciliation run insert failed",
          detail: runErr.message,
        }),
      )
    }
  }
}

export type ManualPayoutSyncResult = {
  payoutsSynced: number
  balanceTransactionsUpserted: number
  reconciliationRunId: string
}

export async function runManualBlitzpayPayoutLedgerSync(
  admin: SupabaseClient,
  organizationId: string,
  stripeConnectAccountId: string,
  createdByUserId: string | null,
  options?: { payoutLimit?: number },
): Promise<ManualPayoutSyncResult> {
  assertUuid(organizationId, "organizationId")
  const acct = stripeConnectAccountId.trim()
  const stripe = getStripe()
  const limit = Math.min(100, Math.max(1, options?.payoutLimit ?? 25))

  const { data: runRow, error: runInsErr } = await admin
    .from("blitzpay_reconciliation_runs")
    .insert({
      organization_id: organizationId,
      trigger: "manual_api",
      status: "started",
      stripe_connect_account_id: acct,
      created_by_user_id: createdByUserId,
    })
    .select("id")
    .single()

  if (runInsErr) throw new Error(runInsErr.message)
  const reconciliationRunId = (runRow as { id: string }).id

  let payoutsSynced = 0
  let balanceTransactionsUpserted = 0

  try {
    let payoutCursor: string | undefined
    let pages = 0
    while (payoutsSynced < limit) {
      const page = await stripe.payouts.list(
        { limit: Math.min(100, limit - payoutsSynced), starting_after: payoutCursor },
        { stripeAccount: acct },
      )
      if (page.data.length === 0) break
      for (const payout of page.data) {
        if (payoutsSynced >= limit) break
        const { id: blitzpayPayoutUuid } = await upsertBlitzpayPayoutRow(admin, organizationId, acct, payout)
        const r = await syncBlitzpayPayoutBalanceTransactions(
          admin,
          organizationId,
          acct,
          payout.id,
          blitzpayPayoutUuid,
        )
        payoutsSynced += 1
        balanceTransactionsUpserted += r.upserted
      }
      if (!page.has_more) break
      payoutCursor = page.data[page.data.length - 1].id
      pages += 1
      if (pages > 50) break
    }

    const now = new Date().toISOString()
    const { error: finErr } = await admin
      .from("blitzpay_reconciliation_runs")
      .update({
        status: "success",
        payouts_touched: payoutsSynced,
        balance_transactions_upserted: balanceTransactionsUpserted,
        summary: { payoutLimit: limit },
        finished_at: now,
      })
      .eq("id", reconciliationRunId)

    if (finErr) throw new Error(finErr.message)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin
      .from("blitzpay_reconciliation_runs")
      .update({
        status: "failed",
        error: msg.slice(0, 2000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", reconciliationRunId)
    throw e
  }

  try {
    await refreshBlitzpayOrgTreasuryState(admin, organizationId)
  } catch {
    /* non-fatal — treasury tables may lag migrations */
  }

  return { payoutsSynced, balanceTransactionsUpserted, reconciliationRunId }
}

export type BlitzpayPayoutLedgerPanelPayout = {
  id: string
  stripePayoutIdTail: string
  status: string
  amountCents: number
  currency: string
  arrivalDate: string | null
  stripeCreatedAt: string
  balanceTransactionCount: number
  balanceTransactionSyncedAt: string | null
}

export type BlitzpayPayoutLedgerPanelRun = {
  id: string
  trigger: string
  status: string
  payoutsTouched: number
  balanceTransactionsUpserted: number
  createdAt: string
  finishedAt: string | null
  error: string | null
}

export type BlitzpayPayoutLedgerPanelData = {
  payouts: BlitzpayPayoutLedgerPanelPayout[]
  recentRuns: BlitzpayPayoutLedgerPanelRun[]
  sinceIso: string
  balanceTransactionTotals: ReturnType<typeof summarizeBlitzpayBalanceTransactions>
  paidOutToBankCents: number
}

export async function fetchBlitzpayPayoutLedgerPanelData(
  admin: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string | null; payoutLimit?: number; runLimit?: number },
): Promise<BlitzpayPayoutLedgerPanelData> {
  assertUuid(organizationId, "organizationId")
  const sinceIso =
    options?.sinceIso?.trim() ? options.sinceIso.trim() : new Date(Date.now() - 30 * 864e5 * 1000).toISOString()
  const payoutLimit = options?.payoutLimit ?? 15
  const runLimit = options?.runLimit ?? 10

  const { data: payoutRows, error: pErr } = await admin
    .from("blitzpay_payouts")
    .select(
      "id, stripe_payout_id, status, amount_cents, currency, arrival_date, stripe_created_at, balance_transaction_count, balance_transaction_synced_at",
    )
    .eq("organization_id", organizationId)
    .order("stripe_created_at", { ascending: false })
    .limit(payoutLimit)
  if (pErr) throw new Error(pErr.message)

  const { data: runRows, error: rErr } = await admin
    .from("blitzpay_reconciliation_runs")
    .select(
      "id, trigger, status, payouts_touched, balance_transactions_upserted, created_at, finished_at, error",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(runLimit)
  if (rErr) throw new Error(rErr.message)

  let qBt = admin
    .from("blitzpay_balance_transactions")
    .select("balance_type, gross_cents, fee_cents, net_cents")
    .eq("organization_id", organizationId)
    .gte("stripe_created_at", sinceIso)
  const { data: btRows, error: btErr } = await qBt
  if (btErr) throw new Error(btErr.message)

  const btTotals = summarizeBlitzpayBalanceTransactions(
    (btRows ?? []) as Array<{ balance_type: string; gross_cents: number; fee_cents: number; net_cents: number }>,
  )

  let paidOutToBankCents = 0
  {
    let q = admin
      .from("blitzpay_payouts")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .gte("stripe_created_at", sinceIso)
    const { data: paidRows, error: poErr } = await q
    if (poErr) throw new Error(poErr.message)
    paidOutToBankCents = (paidRows ?? []).reduce(
      (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
      0,
    )
  }

  const payouts: BlitzpayPayoutLedgerPanelPayout[] = (payoutRows ?? []).map((raw) => {
    const p = raw as {
      id: string
      stripe_payout_id: string
      status: string
      amount_cents: number
      currency: string
      arrival_date: string | null
      stripe_created_at: string
      balance_transaction_count: number
      balance_transaction_synced_at: string | null
    }
    const sid = String(p.stripe_payout_id ?? "")
    return {
      id: p.id,
      stripePayoutIdTail: sid.length > 8 ? sid.slice(-8) : sid,
      status: p.status,
      amountCents: Math.round(Number(p.amount_cents)),
      currency: String(p.currency || "usd").toLowerCase(),
      arrivalDate: p.arrival_date,
      stripeCreatedAt: p.stripe_created_at,
      balanceTransactionCount: Math.round(Number(p.balance_transaction_count ?? 0)),
      balanceTransactionSyncedAt: p.balance_transaction_synced_at,
    }
  })

  const recentRuns: BlitzpayPayoutLedgerPanelRun[] = (runRows ?? []).map((raw) => {
    const r = raw as {
      id: string
      trigger: string
      status: string
      payouts_touched: number
      balance_transactions_upserted: number
      created_at: string
      finished_at: string | null
      error: string | null
    }
    return {
      id: r.id,
      trigger: r.trigger,
      status: r.status,
      payoutsTouched: Math.round(Number(r.payouts_touched ?? 0)),
      balanceTransactionsUpserted: Math.round(Number(r.balance_transactions_upserted ?? 0)),
      createdAt: r.created_at,
      finishedAt: r.finished_at,
      error: r.error,
    }
  })

  return {
    payouts,
    recentRuns,
    sinceIso,
    balanceTransactionTotals: btTotals,
    paidOutToBankCents,
  }
}
