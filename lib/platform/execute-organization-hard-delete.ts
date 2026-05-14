import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import {
  FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS,
  FIRST_RUN_WELCOME_ACK_ORG_IDS,
  parseOrgIdList,
  withOrgIdRemoved,
} from "@/lib/first-run/user-metadata"
import { getOrganizationLogosBucket } from "@/lib/organization/logo-storage"
import { ORGANIZATION_IMPORTS_BUCKET } from "@/lib/migration-imports/constants"
import { SIGNATURES_BUCKET } from "@/lib/technicians/signature-storage"
import { WORK_ORDER_ATTACHMENTS_BUCKET } from "@/lib/work-orders/work-order-tab-data"

const CATALOG_ITEM_FILES_BUCKET = "catalog-item-files" as const

const STORAGE_REMOVE_CHUNK = 100

export type OrganizationHardDeleteResult =
  | { ok: true; alreadyDeleted?: boolean }
  | { ok: false; message: string }

function isStorageFileEntry(entry: { metadata?: Record<string, unknown> | null }): boolean {
  return entry.metadata != null && typeof entry.metadata === "object" && "size" in entry.metadata
}

/**
 * Recursively collects object paths (not “folder” placeholders) under `prefix`.
 * `prefix` is the first path segment (e.g. organization UUID).
 */
async function collectStorageObjectPaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  out: string[],
): Promise<void> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !data?.length) return

  for (const item of data) {
    const path = `${prefix}/${item.name}`
    if (isStorageFileEntry(item)) {
      out.push(path)
    } else {
      await collectStorageObjectPaths(admin, bucket, path, out)
    }
  }
}

async function removePathsInChunks(admin: SupabaseClient, bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_REMOVE_CHUNK)
    const { error } = await admin.storage.from(bucket).remove(chunk)
    if (error) {
      try {
        console.warn(`[organization-hard-delete] storage remove failed bucket=${bucket}`, error.message)
      } catch {
        /* */
      }
    }
  }
}

/**
 * Best-effort removal of known org-scoped storage prefixes (`{organizationId}/…`).
 * Does not block DB delete on failure (avoids leaving a tenant stuck without SQL access).
 */
async function purgeOrganizationScopedStorage(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const buckets = [
    WORK_ORDER_ATTACHMENTS_BUCKET,
    getOrganizationLogosBucket(),
    ORGANIZATION_IMPORTS_BUCKET,
    PRICE_LIST_IMPORTS_BUCKET,
    SIGNATURES_BUCKET,
    CATALOG_ITEM_FILES_BUCKET,
  ]
  const uniqueBuckets = [...new Set(buckets)]

  for (const bucket of uniqueBuckets) {
    try {
      const paths: string[] = []
      await collectStorageObjectPaths(admin, bucket, organizationId, paths)
      if (paths.length > 0) {
        await removePathsInChunks(admin, bucket, paths)
      }
    } catch (err) {
      try {
        console.warn(`[organization-hard-delete] storage purge bucket=${bucket}`, err)
      } catch {
        /* */
      }
    }
  }
}

async function stripDeletedOrgFromMemberAuthMetadata(
  admin: SupabaseClient,
  organizationId: string,
  memberUserIds: string[],
): Promise<void> {
  const ids = [...new Set(memberUserIds.filter(Boolean))]
  for (const userId of ids) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error || !data?.user) continue

      const meta = { ...(data.user.user_metadata as Record<string, unknown> | null | undefined) }
      const welcomeBefore = parseOrgIdList(meta, FIRST_RUN_WELCOME_ACK_ORG_IDS)
      const launchpadBefore = parseOrgIdList(meta, FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS)
      const welcome = withOrgIdRemoved(welcomeBefore, organizationId)
      const launchpad = withOrgIdRemoved(launchpadBefore, organizationId)

      if (welcome.length === welcomeBefore.length && launchpad.length === launchpadBefore.length) {
        continue
      }

      meta[FIRST_RUN_WELCOME_ACK_ORG_IDS] = welcome
      meta[FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS] = launchpad

      await admin.auth.admin.updateUserById(userId, { user_metadata: meta })
    } catch (err) {
      try {
        console.warn(`[organization-hard-delete] auth metadata cleanup user=${userId}`, err)
      } catch {
        /* */
      }
    }
  }
}

/**
 * Platform-admin hard delete after billing/compliance guards pass.
 *
 * - Purges known Supabase Storage prefixes for this org (best-effort).
 * - Removes this org id from members’ Auth `user_metadata` launchpad keys (profiles.default_organization_id
 *   is cleared automatically via FK `on delete set null` when the org row is removed).
 * - Deletes the `organizations` row; almost all tenant tables use `on delete cascade` from organizations.
 *
 * Idempotent: if the organization row is already gone, returns `{ ok: true, alreadyDeleted: true }`.
 *
 * Note: Stripe objects (subscription/customer) are not canceled here; trialing orgs pass guards without
 * a blocking subscription status. Production ops may still cancel Stripe separately if needed.
 */
export async function executeOrganizationHardDelete(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationHardDeleteResult> {
  const { data: orgRow, error: orgReadErr } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgReadErr) {
    return { ok: false, message: orgReadErr.message }
  }
  if (!orgRow) {
    return { ok: true, alreadyDeleted: true }
  }

  const { data: members, error: memErr } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)

  if (memErr) {
    return { ok: false, message: memErr.message }
  }

  const memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean)

  await purgeOrganizationScopedStorage(admin, organizationId)
  await stripDeletedOrgFromMemberAuthMetadata(admin, organizationId, memberUserIds)

  const { error: delErr } = await admin.from("organizations").delete().eq("id", organizationId)

  if (delErr) {
    return { ok: false, message: delErr.message }
  }

  return { ok: true }
}
