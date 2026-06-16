import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"
import { probeGrowthSharePageTemplatesSchema } from "@/lib/growth/share-pages/share-page-template-schema-health"

export async function executeGrowthSharePageTemplatesProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const schemaProbe = await probeGrowthSharePageTemplatesSchema(admin)
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = schemaProbe.tables.map((entry) => ({
    name: entry.table,
    ok: entry.ok,
    error: entry.error,
  }))

  if (schemaProbe.ready) {
    const statusProbe = await admin
      .schema("growth")
      .from("share_page_templates")
      .select("status")
      .in("status", ["draft", "published", "archived"])
      .limit(1)
    checks.push({
      name: "share_page_templates.status.check",
      ok: !statusProbe.error,
      error: statusProbe.error?.message ?? null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const schemaReady = failedChecks.length === 0

  if (!schemaReady) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
      schema_ready: false,
      live_schema_verified: false,
      production_read_only: true,
      migration: GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
      error: "schema_drift",
      failed_checks: failedChecks.map((check) => check.name),
      checks,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    migration: GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
    checks,
  }
}
