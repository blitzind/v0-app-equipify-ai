import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { qbFetchJson, qbSqlEscape } from "@/lib/integrations/quickbooks/api"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"
import { upsertExternalMapping } from "@/lib/integrations/quickbooks/mappings"

export type SyncPhaseResult = {
  attempted: number
  succeeded: number
  errors: Array<{ internalId: string; message: string }>
}

type QbCustomer = {
  Id?: string
  SyncToken?: string
  DisplayName?: string
  sparse?: boolean
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: { Address?: string }
  PrimaryPhone?: { FreeFormNumber?: string }
  BillAddr?: Record<string, string | undefined>
  ShipAddr?: Record<string, string | undefined>
}

type QueryResp = {
  QueryResponse?: {
    Customer?: QbCustomer[]
  }
}

async function queryCustomers(
  realmId: string,
  accessToken: string,
  sql: string,
  onUnauthorized?: () => Promise<string | null>,
): Promise<QbCustomer[]> {
  const r = await qbFetchJson<QueryResp>({
    realmId,
    accessToken,
    method: "GET",
    resourcePath: "query",
    searchParams: { query: sql },
    onUnauthorized,
  })
  const fault = readQuickBooksFaultMessage(r.data)
  if (fault) return []
  return r.data?.QueryResponse?.Customer ?? []
}

async function findExistingCustomerId(params: {
  realmId: string
  accessToken: string
  displayName: string
  email: string | null
  onUnauthorized?: () => Promise<string | null>
}): Promise<string | null> {
  const dn = qbSqlEscape(params.displayName.trim())
  const byName = await queryCustomers(
    params.realmId,
    params.accessToken,
    `SELECT Id FROM Customer WHERE DisplayName = '${dn}'`,
    params.onUnauthorized,
  )
  if (byName[0]?.Id) return String(byName[0].Id)

  if (params.email?.includes("@")) {
    const em = qbSqlEscape(params.email.trim().toLowerCase())
    const byEmail = await queryCustomers(
      params.realmId,
      params.accessToken,
      `SELECT Id FROM Customer WHERE PrimaryEmailAddr = '${em}'`,
      params.onUnauthorized,
    )
    if (byEmail[0]?.Id) return String(byEmail[0].Id)
  }

  return null
}

function buildAddr(loc: {
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
}): Record<string, string> {
  return {
    Line1: loc.address_line1,
    ...(loc.address_line2?.trim() ? { Line2: loc.address_line2 } : {}),
    City: loc.city,
    CountrySubDivisionCode: loc.state,
    PostalCode: loc.postal_code,
    Country: "US",
  }
}

export async function syncCustomersToQuickBooks(params: {
  svc: SupabaseClient
  organizationId: string
  realmId: string
  accessToken: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<SyncPhaseResult> {
  const errors: Array<{ internalId: string; message: string }> = []
  let attempted = 0
  let succeeded = 0

  const { data: custRows, error: cErr } = await params.svc
    .from("customers")
    .select("id, company_name, updated_at")
    .eq("organization_id", params.organizationId)
    .is("archived_at", null)

  if (cErr || !custRows?.length) {
    return { attempted: 0, succeeded: 0, errors: cErr ? [{ internalId: "_", message: cErr.message }] : [] }
  }

  const ids = custRows.map((c) => (c as { id: string }).id)

  const { data: contacts } = await params.svc
    .from("customer_contacts")
    .select("customer_id, full_name, email, phone, is_primary")
    .eq("organization_id", params.organizationId)
    .in("customer_id", ids)

  const { data: locs } = await params.svc
    .from("customer_locations")
    .select(
      "customer_id, name, address_line1, address_line2, city, state, postal_code, phone, is_default",
    )
    .eq("organization_id", params.organizationId)
    .in("customer_id", ids)
    .is("archived_at", null)

  const contactByCust = new Map<string, typeof contacts>()
  for (const row of contacts ?? []) {
    const cid = (row as { customer_id: string }).customer_id
    const arr = contactByCust.get(cid) ?? []
    arr.push(row as Record<string, unknown>)
    contactByCust.set(cid, arr as typeof contacts)
  }

  const locByCust = new Map<string, typeof locs>()
  for (const row of locs ?? []) {
    const cid = (row as { customer_id: string }).customer_id
    const arr = locByCust.get(cid) ?? []
    arr.push(row as Record<string, unknown>)
    locByCust.set(cid, arr as typeof locs)
  }

  const { data: existingMaps } = await params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id, last_synced_at")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "customer")

  const mapByCustomer = new Map((existingMaps ?? []).map((m) => [(m as { internal_id: string }).internal_id, m]))

  for (const raw of custRows as Array<{ id: string; company_name: string; updated_at?: string }>) {
    attempted++
    const customerId = raw.id
    const displayNameBase = raw.company_name.trim() || "Customer"

    const contactRows = (contactByCust.get(customerId) ?? []) as Array<{
      full_name?: string
      email?: string | null
      phone?: string | null
      is_primary?: boolean
    }>
    contactRows.sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
    const primary = contactRows[0]
    const email = primary?.email?.trim() || null
    const phone = primary?.phone?.trim() || null

    let given = ""
    let family = ""
    if (primary?.full_name?.trim()) {
      const parts = primary.full_name.trim().split(/\s+/)
      given = parts[0] ?? ""
      family = parts.slice(1).join(" ") || ""
    }

    const locRows = (locByCust.get(customerId) ?? []) as Array<{
      is_default?: boolean
      address_line1: string
      address_line2: string | null
      city: string
      state: string
      postal_code: string
    }>
    locRows.sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)))
    const bill = locRows[0]
    const ship = locRows.length > 1 ? locRows.find((l) => !l.is_default) ?? bill : bill

    let displayName = displayNameBase
    const mapping = mapByCustomer.get(customerId) as { external_id?: string } | undefined
    let qboId = mapping?.external_id?.trim() ?? ""

    if (!qboId) {
      const found = await findExistingCustomerId({
        realmId: params.realmId,
        accessToken: params.accessToken,
        displayName,
        email,
        onUnauthorized: params.onUnauthorized,
      })
      if (found) {
        qboId = found
        await upsertExternalMapping({
          svc: params.svc,
          organizationId: params.organizationId,
          entityType: "customer",
          internalId: customerId,
          externalId: qboId,
          syncStatus: "synced",
          metadata: { resolved_by: "lookup" },
        })
      }
    }

    let payload: QbCustomer = {
      DisplayName: displayName,
      CompanyName: displayNameBase,
      ...(given || family ? { GivenName: given || undefined, FamilyName: family || undefined } : {}),
      ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
      ...(phone ? { PrimaryPhone: { FreeFormNumber: phone } } : {}),
      ...(bill ? { BillAddr: buildAddr(bill) } : {}),
      ...(ship && bill && ship !== bill ? { ShipAddr: buildAddr(ship) } : {}),
    }

    try {
      let activeQboId = qboId

      if (activeQboId) {
        const getOne = await qbFetchJson<{ Customer?: QbCustomer }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "GET",
          resourcePath: `customer/${encodeURIComponent(activeQboId)}`,
          onUnauthorized: params.onUnauthorized,
        })
        const faultGet = readQuickBooksFaultMessage(getOne.data)
        if (!getOne.ok && getOne.status === 404) {
          activeQboId = ""
        } else if (faultGet || !getOne.ok) {
          errors.push({
            internalId: customerId,
            message: faultGet ?? `Load customer ${activeQboId} failed (${getOne.status})`,
          })
          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "customer",
            internalId: customerId,
            externalId: activeQboId,
            syncStatus: "error",
            lastError: faultGet ?? `HTTP ${getOne.status}`,
          })
          continue
        }

        if (activeQboId) {
          const existing = getOne.data?.Customer
          const merged: QbCustomer = {
            ...existing,
            ...payload,
            Id: activeQboId,
            SyncToken: existing?.SyncToken,
            sparse: true,
          }

          const postSparseUpdate = async (body: QbCustomer) =>
            qbFetchJson<{ Customer?: QbCustomer }>({
              realmId: params.realmId,
              accessToken: params.accessToken,
              method: "POST",
              resourcePath: "customer",
              searchParams: { sparse: "true" },
              body: body as Record<string, unknown>,
              onUnauthorized: params.onUnauthorized,
            })

          let upd = await postSparseUpdate(merged)
          let faultUp = readQuickBooksFaultMessage(upd.data)
          if (
            (faultUp || !upd.ok) &&
            (upd.rawText?.toLowerCase().includes("duplicate") ||
              (faultUp?.toLowerCase().includes("duplicate") ?? false))
          ) {
            upd = await postSparseUpdate({
              ...merged,
              DisplayName: `${displayNameBase} (Equipify)`,
            })
            faultUp = readQuickBooksFaultMessage(upd.data)
          }

          if (faultUp || !upd.ok) {
            errors.push({ internalId: customerId, message: faultUp ?? `Update failed (${upd.status})` })
            await upsertExternalMapping({
              svc: params.svc,
              organizationId: params.organizationId,
              entityType: "customer",
              internalId: customerId,
              externalId: activeQboId,
              syncStatus: "error",
              lastError: faultUp ?? `HTTP ${upd.status}`,
            })
            continue
          }

          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "customer",
            internalId: customerId,
            externalId: activeQboId,
            syncStatus: "synced",
          })
          succeeded++
          continue
        }
      }

      const created = await qbFetchJson<{ Customer?: QbCustomer }>({
        realmId: params.realmId,
        accessToken: params.accessToken,
        method: "POST",
        resourcePath: "customer",
        body: payload as Record<string, unknown>,
        onUnauthorized: params.onUnauthorized,
      })

      let faultCr = readQuickBooksFaultMessage(created.data)
      let newId = created.data?.Customer?.Id

      if (
        (faultCr?.toLowerCase().includes("duplicate") || created.rawText?.toLowerCase().includes("duplicate")) &&
        !newId
      ) {
        payload = { ...payload, DisplayName: `${displayNameBase} (Equipify)` }
        const retry = await qbFetchJson<{ Customer?: QbCustomer }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "POST",
          resourcePath: "customer",
          body: payload as Record<string, unknown>,
          onUnauthorized: params.onUnauthorized,
        })
        faultCr = readQuickBooksFaultMessage(retry.data)
        newId = retry.data?.Customer?.Id
        if (faultCr || !retry.ok || !newId) {
          errors.push({
            internalId: customerId,
            message: faultCr ?? "Create customer failed after duplicate retry.",
          })
          continue
        }
      } else if (faultCr || !created.ok || !newId) {
        errors.push({
          internalId: customerId,
          message: faultCr ?? `Create customer failed (${created.status})`,
        })
        continue
      }

      await upsertExternalMapping({
        svc: params.svc,
        organizationId: params.organizationId,
        entityType: "customer",
        internalId: customerId,
        externalId: String(newId),
        syncStatus: "synced",
      })
      succeeded++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ internalId: customerId, message: msg })
    }
  }

  return { attempted, succeeded, errors }
}
