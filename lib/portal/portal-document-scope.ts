/**
 * Customer Portal Document Access — Phase 2
 *
 * Resolves the portal customer "scope" — the set of customer ids a
 * portal session may pull documents for — without weakening any
 * existing release rules.
 *
 * Default behavior: a portal user only sees their own customer
 * (`rollupEnabled=false`, `customerIds=[rootCustomerId]`).
 *
 * Consolidated rollup: when the organization's default flag *or* the
 * explicit per-customer override enables it, the scope walks down the
 * customer hierarchy from the root customer and includes every
 * descendant. The walk is BFS, depth + count capped, and uses the
 * existing cycle-prevention trigger from
 * `20260721120000_customer_hierarchy_phase1.sql` as a second line of
 * defense.
 *
 * Strict rules:
 *   - never loosens RLS / customer scoping
 *   - never returns ids outside `organization_id`
 *   - silent fallback to the single-customer scope when the Phase 2
 *     migration has not been applied (`portal_consolidated_documents_*`
 *     columns missing)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_HIERARCHY_DEPTH = 6
const MAX_DESCENDANT_COUNT = 250

export type PortalDocumentScope = {
  rootCustomerId: string
  /** Always includes `rootCustomerId`, never empty. */
  customerIds: string[]
  /** Map from customer_id → company_name (display labels only — no UUIDs). */
  accountLabels: Record<string, string>
  /** True when consolidated rollup is in effect for this session. */
  rollupEnabled: boolean
  /** True when the underlying Phase 2 migration has not been applied yet. */
  schemaMigrationPending: boolean
}

/** Resolve whether consolidated visibility applies given org default + customer override. */
export function resolveConsolidatedDocumentsEnabled(args: {
  orgDefault: boolean | null | undefined
  customerOverride: boolean | null | undefined
}): boolean {
  if (args.customerOverride === true) return true
  if (args.customerOverride === false) return false
  return args.orgDefault === true
}

/** True when the schema-drift fallback should kick in. */
function missingPhase2Columns(message: string | null | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes("portal_consolidated_documents_default") ||
    m.includes("portal_consolidated_documents_enabled")
  )
}

/**
 * Read the org + customer flags. Returns `null` for either when the column
 * is absent (Phase 2 migration not applied), so callers default to the
 * single-customer behavior.
 */
async function readConsolidationFlags(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{
  orgDefault: boolean | null
  customerOverride: boolean | null
  schemaMigrationPending: boolean
}> {
  let schemaMigrationPending = false

  const orgRes = await svc
    .from("organizations")
    .select("portal_consolidated_documents_default")
    .eq("id", organizationId)
    .maybeSingle()

  let orgDefault: boolean | null = null
  if (orgRes.error) {
    if (missingPhase2Columns(orgRes.error.message)) {
      schemaMigrationPending = true
    }
  } else {
    orgDefault =
      ((orgRes.data as { portal_consolidated_documents_default?: boolean | null } | null)
        ?.portal_consolidated_documents_default ?? null) as boolean | null
  }

  let customerOverride: boolean | null = null
  if (!schemaMigrationPending) {
    const custRes = await svc
      .from("customers")
      .select("portal_consolidated_documents_enabled")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle()
    if (custRes.error) {
      if (missingPhase2Columns(custRes.error.message)) {
        schemaMigrationPending = true
      }
    } else {
      customerOverride =
        ((custRes.data as { portal_consolidated_documents_enabled?: boolean | null } | null)
          ?.portal_consolidated_documents_enabled ?? null) as boolean | null
    }
  }

  return { orgDefault, customerOverride, schemaMigrationPending }
}

/**
 * Walk the customer hierarchy DOWN from `rootCustomerId`, gathering all
 * non-archived descendants in the same organization. Hard-capped at
 * `MAX_HIERARCHY_DEPTH` levels and `MAX_DESCENDANT_COUNT` rows so a
 * misconfigured hierarchy can't fan out unbounded.
 */
async function loadDescendantCustomerIds(
  svc: SupabaseClient,
  organizationId: string,
  rootCustomerId: string,
): Promise<{ ids: string[]; labels: Record<string, string> }> {
  const visited = new Set<string>([rootCustomerId])
  const collectedLabels: Record<string, string> = {}
  let frontier: string[] = [rootCustomerId]
  let depth = 0

  while (frontier.length > 0 && depth < MAX_HIERARCHY_DEPTH) {
    const { data, error } = await svc
      .from("customers")
      .select("id, company_name, parent_customer_id")
      .eq("organization_id", organizationId)
      .in("parent_customer_id", frontier)
      .is("archived_at", null)
      .order("company_name", { ascending: true })
      .limit(MAX_DESCENDANT_COUNT)

    if (error) break

    const nextFrontier: string[] = []
    for (const row of (data ?? []) as Array<{
      id: string
      company_name: string | null
      parent_customer_id: string | null
    }>) {
      if (visited.has(row.id)) continue
      visited.add(row.id)
      collectedLabels[row.id] = (row.company_name ?? "").trim() || "Sub-account"
      nextFrontier.push(row.id)
      if (visited.size >= MAX_DESCENDANT_COUNT) break
    }
    if (visited.size >= MAX_DESCENDANT_COUNT) break
    frontier = nextFrontier
    depth += 1
  }

  // Drop the root from the descendant id list — caller layers it back.
  visited.delete(rootCustomerId)
  return { ids: [...visited], labels: collectedLabels }
}

/**
 * Resolve the document scope for a portal session.
 *
 * - Phase 1 default (rollup disabled): returns the single root customer.
 * - Phase 2 enabled: returns the root + all non-archived descendants,
 *   bounded by `MAX_HIERARCHY_DEPTH` / `MAX_DESCENDANT_COUNT`.
 *
 * The function is non-throwing. If anything fails along the way, the
 * scope falls back to the safe single-customer view.
 */
export async function resolvePortalDocumentScope(
  svc: SupabaseClient,
  args: { organizationId: string; rootCustomerId: string },
): Promise<PortalDocumentScope> {
  const { organizationId, rootCustomerId } = args

  // Always look up the root label so the UI can render an account chip
  // even in single-customer mode if it wants to.
  const rootRes = await svc
    .from("customers")
    .select("company_name")
    .eq("organization_id", organizationId)
    .eq("id", rootCustomerId)
    .maybeSingle()
  const rootLabel =
    ((rootRes.data as { company_name?: string | null } | null)?.company_name ?? "").trim() ||
    "Account"

  const flags = await readConsolidationFlags(svc, organizationId, rootCustomerId)
  const rollupEnabled =
    !flags.schemaMigrationPending &&
    resolveConsolidatedDocumentsEnabled({
      orgDefault: flags.orgDefault,
      customerOverride: flags.customerOverride,
    })

  const accountLabels: Record<string, string> = { [rootCustomerId]: rootLabel }

  if (!rollupEnabled) {
    return {
      rootCustomerId,
      customerIds: [rootCustomerId],
      accountLabels,
      rollupEnabled: false,
      schemaMigrationPending: flags.schemaMigrationPending,
    }
  }

  const { ids, labels } = await loadDescendantCustomerIds(
    svc,
    organizationId,
    rootCustomerId,
  )

  for (const [id, name] of Object.entries(labels)) {
    accountLabels[id] = name
  }

  return {
    rootCustomerId,
    customerIds: [rootCustomerId, ...ids],
    accountLabels,
    rollupEnabled: true,
    schemaMigrationPending: false,
  }
}
