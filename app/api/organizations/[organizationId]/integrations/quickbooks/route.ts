import { NextResponse } from "next/server"
import { requireOrgIntegrationAdmin } from "@/lib/integrations/require-org-integration-admin"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { getQuickBooksApiEnvironment, quickBooksOAuthConfigured } from "@/lib/integrations/quickbooks-env"
import { sanitizeQuickBooksClientMessage } from "@/lib/integrations/quickbooks/safe-log"
import {
  runQuickBooksExportSync,
  runQuickBooksPaymentStatusImportSync,
} from "@/lib/integrations/quickbooks/sync-runner"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SYNC_KINDS = new Set(["customers", "invoices", "payments", "catalog_items", "full_initial"])

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const financialGate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials"])
  const showFinancialSyncDetail = !("error" in financialGate)

  const { data: integration, error: intErr } = await gate.svc
    .from("organization_integrations")
    .select(
      "id, connection_status, realm_id, company_name, connected_by_user_id, last_successful_sync_at, last_sync_attempt_at, sync_health, last_sync_error, sync_settings, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  if (intErr) {
    return NextResponse.json({ error: intErr.message }, { status: 500 })
  }

  const { data: logs, error: logErr } = await gate.svc
    .from("quickbooks_sync_logs")
    .select(
      "id, sync_kind, direction, status, records_attempted, records_succeeded, error_message, detail, started_at, completed_at",
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(30)

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 })
  }

  const { data: mappingRows } = await gate.svc
    .from("external_sync_mappings")
    .select("entity_type, sync_status")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")

  const mappingCounts: Record<string, number> = {}
  const syncStatusCounts: Record<string, Record<string, number>> = {}

  for (const row of mappingRows ?? []) {
    const t = (row as { entity_type?: string }).entity_type ?? "unknown"
    if (!showFinancialSyncDetail && (t === "invoice" || t === "payment")) continue
    const ss = (row as { sync_status?: string }).sync_status ?? "unknown"
    mappingCounts[t] = (mappingCounts[t] ?? 0) + 1
    if (!syncStatusCounts[t]) syncStatusCounts[t] = {}
    syncStatusCounts[t][ss] = (syncStatusCounts[t][ss] ?? 0) + 1
  }

  const integrationOut = integration
    ? formatQuickBooksIntegrationForClient(integration as Record<string, unknown>, showFinancialSyncDetail)
    : null

  const logsOut = showFinancialSyncDetail
    ? (logs ?? [])
    : (logs ?? []).map((row) => {
        const r = row as Record<string, unknown>
        const { detail, error_message: _em, ...rest } = r
        return { ...rest, detail: null, error_message: null }
      })

  return NextResponse.json({
    oauthEnvironmentConfigured: quickBooksOAuthConfigured(),
    quickBooksApiEnvironment: getQuickBooksApiEnvironment(),
    quickBooksOAuthCallbackPath: "/api/integrations/quickbooks/callback",
    integration: integrationOut,
    recentSyncLogs: logsOut,
    mappingCounts,
    syncStatusByEntity: syncStatusCounts,
    financialSyncDetailVisible: showFinancialSyncDetail,
  })
}

/** Never expose realm_id or raw tokens to the browser. */
function formatQuickBooksIntegrationForClient(
  row: Record<string, unknown>,
  showFinancialSyncDetail: boolean,
): Record<string, unknown> {
  const { realm_id: _realm, last_sync_error: lastErr, ...rest } = row
  const safeLastError =
    typeof lastErr === "string" ? sanitizeQuickBooksClientMessage(lastErr, 500) : null
  return {
    ...rest,
    quickbooks_company_linked: Boolean(String(_realm ?? "").trim()),
    last_sync_error: showFinancialSyncDetail ? safeLastError : null,
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => ({}))) as {
    sync_settings?: { auto_sync_invoices?: boolean }
  }

  const { data: row } = await gate.svc
    .from("organization_integrations")
    .select("id, sync_settings")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  if (!row?.id) {
    return NextResponse.json({ error: "not_connected", message: "Connect QuickBooks first." }, { status: 409 })
  }

  const prev = (row.sync_settings ?? {}) as Record<string, unknown>
  const next = { ...prev }

  if (typeof body.sync_settings?.auto_sync_invoices === "boolean") {
    next.auto_sync_invoices = body.sync_settings.auto_sync_invoices
  }

  const { error: upErr } = await gate.svc
    .from("organization_integrations")
    .update({
      sync_settings: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id as string)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sync_settings: next })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const { data: row } = await gate.svc
    .from("organization_integrations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  const id = row?.id as string | undefined
  if (id) {
    await gate.svc.from("organization_integration_oauth_tokens").delete().eq("organization_integration_id", id)
    const { error } = await gate.svc
      .from("organization_integrations")
      .update({
        connection_status: "disconnected",
        realm_id: null,
        company_name: null,
        connected_by_user_id: null,
        last_successful_sync_at: null,
        last_sync_attempt_at: null,
        sync_health: "unknown",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string
    invoiceIds?: string[]
  }
  const kind = typeof body.kind === "string" && SYNC_KINDS.has(body.kind) ? body.kind : "full_initial"

  const { data: integration } = await gate.svc
    .from("organization_integrations")
    .select("id, connection_status")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  if (!integration || (integration as { connection_status?: string }).connection_status !== "connected") {
    return NextResponse.json(
      { error: "not_connected", message: "Connect QuickBooks before running a sync." },
      { status: 409 },
    )
  }

  if (kind === "payments") {
    const fin = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials"])
    if ("error" in fin) return fin.error

    const ids = Array.isArray(body.invoiceIds)
      ? body.invoiceIds.filter((x): x is string => typeof x === "string" && UUID_RE.test(x))
      : undefined

    const result = await runQuickBooksPaymentStatusImportSync({
      svc: gate.svc,
      organizationId,
      onlyInvoiceIds: ids?.length ? ids : undefined,
    })

    if (!result.ok) {
      const status =
        result.code === "not_connected" ||
        result.code === "missing_realm" ||
        result.code === "missing_tokens" ||
        result.code === "connection_error"
          ? 409
          : 502
      return NextResponse.json(
        { error: result.error, code: result.code ?? "sync_failed" },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      syncLogId: result.syncLogId,
      status: result.status,
      recordsAttempted: result.recordsAttempted,
      recordsSucceeded: result.recordsSucceeded,
      errorMessage: result.errorMessage,
      detail: result.detail,
    })
  }

  const mappedKind: "customers" | "catalog_items" | "invoices" | "full_initial" =
    kind === "customers"
      ? "customers"
      : kind === "catalog_items"
        ? "catalog_items"
        : kind === "invoices"
          ? "invoices"
          : "full_initial"

  const result = await runQuickBooksExportSync({
    svc: gate.svc,
    organizationId,
    kind: mappedKind,
  })

  if (!result.ok) {
    const status =
      result.code === "not_connected" ||
      result.code === "missing_realm" ||
      result.code === "missing_tokens" ||
      result.code === "connection_error"
        ? 409
        : 502
    return NextResponse.json(
      { error: result.error, code: result.code ?? "sync_failed" },
      { status },
    )
  }

  return NextResponse.json({
    ok: true,
    syncLogId: result.syncLogId,
    status: result.status,
    recordsAttempted: result.recordsAttempted,
    recordsSucceeded: result.recordsSucceeded,
    errorMessage: result.errorMessage,
    detail: result.detail,
  })
}
