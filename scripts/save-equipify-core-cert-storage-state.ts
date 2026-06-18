/**
 * EC-6B — save cert-org staff Playwright storage state.
 *
 * Usage:
 *   pnpm save:equipify-core-cert-storage-state:vercel
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapEquipifyCoreCertSupabase } from "@/lib/certification/equipify-core-production-certification"
import {
  EQUIPIFY_CORE_CERT_STORAGE_PATH,
  saveEquipifyCoreCertStaffStorageState,
} from "@/lib/certification/equipify-core-cert-staff-storage-state"
import { resolveCertOrganizationIdFromEnv } from "@/lib/certification/equipify-core-revenue-fixtures"

async function main(): Promise<void> {
  const organizationId = resolveCertOrganizationIdFromEnv()
  const boot = await bootstrapEquipifyCoreCertSupabase()
  if (!boot) {
    console.log(JSON.stringify({ ok: false, error: "supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const quoteId = process.env.EQUIPIFY_CORE_CERT_QUOTE_ID?.trim() || null
  const invoiceId = process.env.EQUIPIFY_CORE_CERT_INVOICE_ID?.trim() || null

  const result = await saveEquipifyCoreCertStaffStorageState({
    admin,
    supabaseUrl: boot.url,
    serviceRoleKey: boot.jwt,
    organizationId,
    quoteId,
    invoiceId,
    outPath: EQUIPIFY_CORE_CERT_STORAGE_PATH,
  })

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        storage_state_created: result.ok,
        path: result.path,
        staff_user: result.staff_user?.email ?? null,
        staff_user_id: result.staff_user?.user_id ?? null,
        staff_role: result.staff_user?.role ?? null,
        accessible_org: result.accessible_org,
        detail: result.detail,
      },
      null,
      2,
    ),
  )
  process.exit(result.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
