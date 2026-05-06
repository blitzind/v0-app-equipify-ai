import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { qbFetchJson, qbSqlEscape } from "@/lib/integrations/quickbooks/api"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"

const MISC_ITEM_NAME = "Equipify — Miscellaneous line"

type ItemResp = { Item?: { Id?: string; SyncToken?: string } }

async function queryItemIdByName(params: {
  realmId: string
  accessToken: string
  name: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<string | null> {
  const name = qbSqlEscape(params.name.trim())
  const r = await qbFetchJson<{
    QueryResponse?: { Item?: Array<{ Id?: string }> }
  }>({
    realmId: params.realmId,
    accessToken: params.accessToken,
    method: "GET",
    resourcePath: "query",
    searchParams: { query: `SELECT Id FROM Item WHERE Name = '${name}'` },
    onUnauthorized: params.onUnauthorized,
  })
  const fault = readQuickBooksFaultMessage(r.data)
  if (fault) return null
  const id = r.data?.QueryResponse?.Item?.[0]?.Id
  return id ? String(id) : null
}

/**
 * Ensures a generic Service item exists for invoice lines without a catalog mapping.
 * Persists its QuickBooks Id under integration sync_settings.misc_qb_item_id.
 */
export async function ensureMiscLineItemId(params: {
  svc: SupabaseClient
  organizationId: string
  integrationId: string
  realmId: string
  accessToken: string
  incomeAccountId: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<{ itemId: string } | { error: string }> {
  const { data: intRow } = await params.svc
    .from("organization_integrations")
    .select("sync_settings")
    .eq("id", params.integrationId)
    .maybeSingle()

  const settings = (intRow?.sync_settings ?? {}) as Record<string, unknown>
  const cached = typeof settings.misc_qb_item_id === "string" ? settings.misc_qb_item_id.trim() : ""
  if (cached) {
    const probe = await qbFetchJson<ItemResp>({
      realmId: params.realmId,
      accessToken: params.accessToken,
      method: "GET",
      resourcePath: `item/${encodeURIComponent(cached)}`,
      onUnauthorized: params.onUnauthorized,
    })
    if (probe.ok && !readQuickBooksFaultMessage(probe.data)) {
      return { itemId: cached }
    }
  }

  const found = await queryItemIdByName({
    realmId: params.realmId,
    accessToken: params.accessToken,
    name: MISC_ITEM_NAME,
    onUnauthorized: params.onUnauthorized,
  })
  if (found) {
    await persistMiscId(params.svc, params.integrationId, settings, found)
    return { itemId: found }
  }

  const created = await qbFetchJson<ItemResp>({
    realmId: params.realmId,
    accessToken: params.accessToken,
    method: "POST",
    resourcePath: "item",
    body: {
      Name: MISC_ITEM_NAME,
      Type: "Service",
      IncomeAccountRef: { value: params.incomeAccountId },
      UnitPrice: 0,
      Taxable: true,
    },
    onUnauthorized: params.onUnauthorized,
  })

  const fault = readQuickBooksFaultMessage(created.data)
  const newId = created.data?.Item?.Id
  if (fault || !created.ok || !newId) {
    return { error: fault ?? `Could not create miscellaneous QuickBooks item (${created.status})` }
  }

  await persistMiscId(params.svc, params.integrationId, settings, String(newId))
  return { itemId: String(newId) }
}

async function persistMiscId(
  svc: SupabaseClient,
  integrationId: string,
  settings: Record<string, unknown>,
  itemId: string,
): Promise<void> {
  const next = { ...settings, misc_qb_item_id: itemId }
  await svc
    .from("organization_integrations")
    .update({
      sync_settings: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
}
