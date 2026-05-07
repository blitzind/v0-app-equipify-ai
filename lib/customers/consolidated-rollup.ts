/**
 * Customer Hierarchy + Billing/Service Address — Phase 1
 *
 * Read-only helpers that prepare the structure for *future* consolidated
 * reporting by parent account. These helpers walk the parent/child adjacency
 * chain (depth-limited to match the migration's cycle guard) and return the
 * full set of customer ids that roll up under a given parent.
 *
 * Phase 1 scope:
 *   - resolve a customer's tree (self + descendants)
 *   - resolve a customer's roll-up root (top-most ancestor)
 * Future phases will use this to aggregate work order counts, equipment
 * counts, invoiced revenue, etc. across a parent organization.
 *
 * Strict rules:
 *   - never expose raw UUIDs in display strings
 *   - always filter by organization_id (RLS-safe)
 *   - non-throwing: degrade to a single-row tree when the migration is missing
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  missingCustomerHierarchyColumns,
} from "@/lib/customers/postgrest-fallback"

export type CustomerTreeNode = {
  id: string
  organizationId: string
  companyName: string
  parentCustomerId: string | null
  /** 0 = self, 1 = direct child, 2 = grand-child, … */
  depth: number
}

const MAX_DEPTH = 6 // matches `customers_prevent_parent_cycle()` hop limit

const TREE_SELECT = "id, organization_id, company_name, parent_customer_id"

/**
 * Resolve the rollup tree starting at `rootCustomerId` (inclusive). The
 * returned list is BFS-ordered (root first, then direct children, then
 * grand-children, etc.) and capped at MAX_DEPTH levels.
 *
 * Returns `[]` when the root customer cannot be loaded (no rows / RLS deny).
 * Returns just the root when the Phase 1 migration has not been applied.
 */
export async function loadCustomerRollupTree(
  supabase: SupabaseClient,
  args: { organizationId: string; rootCustomerId: string },
): Promise<CustomerTreeNode[]> {
  const { organizationId, rootCustomerId } = args

  const rootRes = await supabase
    .from("customers")
    .select(TREE_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", rootCustomerId)
    .maybeSingle()

  if (rootRes.error && missingCustomerHierarchyColumns(rootRes.error)) {
    // Legacy DB: no parent_customer_id column means there are no children to
    // walk. Return the bare root fetched via a legacy select.
    const legacyRes = await supabase
      .from("customers")
      .select("id, organization_id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", rootCustomerId)
      .maybeSingle()
    if (legacyRes.error || !legacyRes.data) return []
    const r = legacyRes.data as { id: string; organization_id: string; company_name: string }
    return [
      { id: r.id, organizationId: r.organization_id, companyName: r.company_name, parentCustomerId: null, depth: 0 },
    ]
  }
  if (rootRes.error || !rootRes.data) return []

  const root = rootRes.data as {
    id: string
    organization_id: string
    company_name: string
    parent_customer_id: string | null
  }

  const out: CustomerTreeNode[] = [
    {
      id: root.id,
      organizationId: root.organization_id,
      companyName: root.company_name,
      parentCustomerId: root.parent_customer_id,
      depth: 0,
    },
  ]

  let frontier: string[] = [root.id]
  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    if (frontier.length === 0) break
    const childRes = await supabase
      .from("customers")
      .select(TREE_SELECT)
      .eq("organization_id", organizationId)
      .in("parent_customer_id", frontier)
      .is("archived_at", null)
    if (childRes.error || !childRes.data) break
    const children = childRes.data as Array<{
      id: string
      organization_id: string
      company_name: string
      parent_customer_id: string | null
    }>
    if (children.length === 0) break
    const nextFrontier: string[] = []
    for (const c of children) {
      out.push({
        id: c.id,
        organizationId: c.organization_id,
        companyName: c.company_name,
        parentCustomerId: c.parent_customer_id,
        depth,
      })
      nextFrontier.push(c.id)
    }
    frontier = nextFrontier
  }

  return out
}

/**
 * Resolve the top-most ancestor of `customerId` (i.e. the row whose
 * parent_customer_id is null). When the customer is itself a root, returns
 * the same id. Cycle/depth-safe via MAX_DEPTH.
 */
export async function resolveCustomerRollupRoot(
  supabase: SupabaseClient,
  args: { organizationId: string; customerId: string },
): Promise<{ id: string; companyName: string } | null> {
  const { organizationId, customerId } = args
  let currentId = customerId
  let currentName: string | null = null

  for (let i = 0; i <= MAX_DEPTH; i += 1) {
    const res = await supabase
      .from("customers")
      .select("id, company_name, parent_customer_id")
      .eq("organization_id", organizationId)
      .eq("id", currentId)
      .maybeSingle()

    if (res.error && missingCustomerHierarchyColumns(res.error)) {
      // Legacy DB: no hierarchy means this row is its own root.
      if (currentName !== null) return { id: currentId, companyName: currentName }
      const legacy = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .eq("id", currentId)
        .maybeSingle()
      if (legacy.error || !legacy.data) return null
      const lr = legacy.data as { id: string; company_name: string }
      return { id: lr.id, companyName: lr.company_name }
    }
    if (res.error || !res.data) return null

    const row = res.data as { id: string; company_name: string; parent_customer_id: string | null }
    currentName = row.company_name
    if (!row.parent_customer_id) {
      return { id: row.id, companyName: row.company_name }
    }
    currentId = row.parent_customer_id
  }

  // Should never happen — the DB trigger forbids cycles. Fall back gracefully.
  if (currentName !== null) return { id: currentId, companyName: currentName }
  return null
}
