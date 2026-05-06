import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { qbFetchJson, qbSqlEscape } from "@/lib/integrations/quickbooks/api"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"
import { upsertExternalMapping } from "@/lib/integrations/quickbooks/mappings"
import { resolveDefaultIncomeAccountId } from "@/lib/integrations/quickbooks/accounts"
import type { SyncPhaseResult } from "@/lib/integrations/quickbooks/customer-sync"

type QbItem = {
  Id?: string
  SyncToken?: string
  Name?: string
  Type?: string
  sparse?: boolean
  Sku?: string
  Description?: string
  UnitPrice?: number
  Taxable?: boolean
  IncomeAccountRef?: { value?: string }
}

type QueryResp = {
  QueryResponse?: {
    Item?: QbItem[]
  }
}

function qbItemTypeFromEquipify(itemType: string): "Service" | "NonInventory" {
  const t = itemType.trim().toLowerCase()
  if (t === "service" || t === "labor") return "Service"
  return "NonInventory"
}

async function findItemIdByName(params: {
  realmId: string
  accessToken: string
  name: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<string | null> {
  const n = qbSqlEscape(params.name.trim())
  const r = await qbFetchJson<QueryResp>({
    realmId: params.realmId,
    accessToken: params.accessToken,
    method: "GET",
    resourcePath: "query",
    searchParams: { query: `SELECT Id FROM Item WHERE Name = '${n}'` },
    onUnauthorized: params.onUnauthorized,
  })
  if (readQuickBooksFaultMessage(r.data)) return null
  const id = r.data?.QueryResponse?.Item?.[0]?.Id
  return id ? String(id) : null
}

async function findItemIdBySku(params: {
  realmId: string
  accessToken: string
  sku: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<string | null> {
  const s = qbSqlEscape(params.sku.trim())
  if (!s) return null
  const r = await qbFetchJson<QueryResp>({
    realmId: params.realmId,
    accessToken: params.accessToken,
    method: "GET",
    resourcePath: "query",
    searchParams: { query: `SELECT Id FROM Item WHERE Sku = '${s}'` },
    onUnauthorized: params.onUnauthorized,
  })
  if (readQuickBooksFaultMessage(r.data)) return null
  const id = r.data?.QueryResponse?.Item?.[0]?.Id
  return id ? String(id) : null
}

export async function syncCatalogItemsToQuickBooks(params: {
  svc: SupabaseClient
  organizationId: string
  realmId: string
  accessToken: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<SyncPhaseResult> {
  const errors: Array<{ internalId: string; message: string }> = []
  let attempted = 0
  let succeeded = 0

  const incomeId = await resolveDefaultIncomeAccountId({
    realmId: params.realmId,
    accessToken: params.accessToken,
    onUnauthorized: params.onUnauthorized,
  })

  if (!incomeId) {
    return {
      attempted: 0,
      succeeded: 0,
      errors: [{ internalId: "_", message: "No Income/Revenue account found in QuickBooks for Items." }],
    }
  }

  const { data: rows, error: qErr } = await params.svc
    .from("catalog_items")
    .select(
      "id, name, sku, part_number, description, sale_price, list_price, taxable, item_type, updated_at",
    )
    .eq("organization_id", params.organizationId)
    .is("archived_at", null)

  if (qErr || !rows?.length) {
    return { attempted: 0, succeeded: 0, errors: qErr ? [{ internalId: "_", message: qErr.message }] : [] }
  }

  const { data: existingMaps } = await params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "catalog_item")

  const mapByCat = new Map((existingMaps ?? []).map((m) => [(m as { internal_id: string }).internal_id, m]))

  for (const raw of rows as Array<{
    id: string
    name: string
    sku: string | null
    part_number: string
    description: string | null
    sale_price: number | null
    list_price: number | null
    taxable: boolean
    item_type: string
    updated_at?: string
  }>) {
    attempted++
    const catId = raw.id
    const baseName = raw.name.trim() || "Catalog item"
    const sku = (raw.sku?.trim() || raw.part_number?.trim() || "").trim() || null
    const price =
      raw.sale_price != null && Number.isFinite(Number(raw.sale_price))
        ? Number(raw.sale_price)
        : raw.list_price != null && Number.isFinite(Number(raw.list_price))
          ? Number(raw.list_price)
          : 0

    const qbType = qbItemTypeFromEquipify(raw.item_type || "other")

    let displayName = baseName
    const mapping = mapByCat.get(catId) as { external_id?: string } | undefined
    let qboId = mapping?.external_id?.trim() ?? ""

    if (!qboId) {
      const bySku = sku
        ? await findItemIdBySku({
            realmId: params.realmId,
            accessToken: params.accessToken,
            sku,
            onUnauthorized: params.onUnauthorized,
          })
        : null
      if (bySku) {
        qboId = bySku
        await upsertExternalMapping({
          svc: params.svc,
          organizationId: params.organizationId,
          entityType: "catalog_item",
          internalId: catId,
          externalId: qboId,
          syncStatus: "synced",
          metadata: { resolved_by: "sku_lookup", sku },
        })
      } else {
        const byName = await findItemIdByName({
          realmId: params.realmId,
          accessToken: params.accessToken,
          name: displayName,
          onUnauthorized: params.onUnauthorized,
        })
        if (byName) {
          qboId = byName
          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "catalog_item",
            internalId: catId,
            externalId: qboId,
            syncStatus: "synced",
            metadata: { resolved_by: "name_lookup" },
          })
        }
      }
    }

    const payloadBase: QbItem = {
      Name: displayName,
      Type: qbType,
      IncomeAccountRef: { value: incomeId },
      UnitPrice: price,
      Taxable: Boolean(raw.taxable),
      ...(raw.description?.trim() ? { Description: raw.description.trim().slice(0, 4000) } : {}),
      ...(sku ? { Sku: sku.slice(0, 100) } : {}),
    }

    try {
      if (qboId) {
        const getOne = await qbFetchJson<{ Item?: QbItem }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "GET",
          resourcePath: `item/${encodeURIComponent(qboId)}`,
          onUnauthorized: params.onUnauthorized,
        })
        const faultGet = readQuickBooksFaultMessage(getOne.data)
        if (!getOne.ok && getOne.status === 404) {
          qboId = ""
        } else if (faultGet || !getOne.ok) {
          errors.push({
            internalId: catId,
            message: faultGet ?? `Load item ${qboId} failed (${getOne.status})`,
          })
          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "catalog_item",
            internalId: catId,
            externalId: qboId,
            syncStatus: "error",
            lastError: faultGet ?? `HTTP ${getOne.status}`,
          })
          continue
        }

        if (qboId) {
          const existing = getOne.data?.Item
          const merged: QbItem = {
            ...existing,
            ...payloadBase,
            Id: qboId,
            SyncToken: existing?.SyncToken,
            Type: existing?.Type ?? payloadBase.Type,
            sparse: true,
          }

          let upd = await qbFetchJson<{ Item?: QbItem }>({
            realmId: params.realmId,
            accessToken: params.accessToken,
            method: "POST",
            resourcePath: "item",
            searchParams: { sparse: "true" },
            body: merged as Record<string, unknown>,
            onUnauthorized: params.onUnauthorized,
          })

          let faultUp = readQuickBooksFaultMessage(upd.data)
          let updOk = Boolean(upd.ok && !faultUp)

          if (
            !updOk &&
            (upd.rawText?.toLowerCase().includes("duplicate") ||
              (faultUp?.toLowerCase().includes("duplicate") ?? false))
          ) {
            const merged2 = {
              ...merged,
              Name: `${baseName} (Equipify)`,
            }
            upd = await qbFetchJson<{ Item?: QbItem }>({
              realmId: params.realmId,
              accessToken: params.accessToken,
              method: "POST",
              resourcePath: "item",
              searchParams: { sparse: "true" },
              body: merged2 as Record<string, unknown>,
              onUnauthorized: params.onUnauthorized,
            })
            faultUp = readQuickBooksFaultMessage(upd.data)
            updOk = Boolean(upd.ok && !faultUp)
          }

          if (!updOk) {
            errors.push({ internalId: catId, message: faultUp ?? `Update item failed (${upd.status})` })
            await upsertExternalMapping({
              svc: params.svc,
              organizationId: params.organizationId,
              entityType: "catalog_item",
              internalId: catId,
              externalId: qboId,
              syncStatus: "error",
              lastError: faultUp ?? `HTTP ${upd.status}`,
            })
            continue
          }

          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "catalog_item",
            internalId: catId,
            externalId: qboId,
            syncStatus: "synced",
          })
          succeeded++
          continue
        }
      }

      let payload = { ...payloadBase }
      const created = await qbFetchJson<{ Item?: QbItem }>({
        realmId: params.realmId,
        accessToken: params.accessToken,
        method: "POST",
        resourcePath: "item",
        body: payload as Record<string, unknown>,
        onUnauthorized: params.onUnauthorized,
      })

      let faultCr = readQuickBooksFaultMessage(created.data)
      let newId = created.data?.Item?.Id

      if (
        (faultCr?.toLowerCase().includes("duplicate") || created.rawText?.toLowerCase().includes("duplicate")) &&
        !newId
      ) {
        payload = { ...payload, Name: `${baseName} (Equipify)` }
        const retry = await qbFetchJson<{ Item?: QbItem }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "POST",
          resourcePath: "item",
          body: payload as Record<string, unknown>,
          onUnauthorized: params.onUnauthorized,
        })
        faultCr = readQuickBooksFaultMessage(retry.data)
        newId = retry.data?.Item?.Id
        if (faultCr || !retry.ok || !newId) {
          errors.push({
            internalId: catId,
            message: faultCr ?? "Create catalog item failed after duplicate retry.",
          })
          continue
        }
      } else if (faultCr || !created.ok || !newId) {
        errors.push({
          internalId: catId,
          message: faultCr ?? `Create catalog item failed (${created.status})`,
        })
        continue
      }

      await upsertExternalMapping({
        svc: params.svc,
        organizationId: params.organizationId,
        entityType: "catalog_item",
        internalId: catId,
        externalId: String(newId),
        syncStatus: "synced",
      })
      succeeded++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ internalId: catId, message: msg })
    }
  }

  return { attempted, succeeded, errors }
}
