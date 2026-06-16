import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_ADMIN_ROUTE_PATHS,
  GROWTH_SHARE_PAGE_TEMPLATE_PLATFORM_ROUTE_PATHS,
  GROWTH_SHARE_PAGE_TEMPLATE_UI_MODULE_PATHS,
} from "@/lib/growth/share-pages/share-page-template-preview-diagnostics"
import {
  GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
  GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"
import { probeGrowthSharePageTemplatesSchema } from "@/lib/growth/share-pages/share-page-template-schema-health"

const SHARE_PAGE_LINEAGE_COLUMNS = [
  "share_page_template_id",
  "share_page_template_version_id",
  "template_blocks_snapshot",
] as const

export async function probeGrowthSharePageTemplateLineageSchema(admin: SupabaseClient): Promise<{
  ready: boolean
  columns: Array<{ column: string; ok: boolean; error: string | null }>
}> {
  const columns = await Promise.all(
    SHARE_PAGE_LINEAGE_COLUMNS.map(async (column) => {
      const { error } = await admin
        .schema("growth")
        .from("share_pages")
        .select(column)
        .limit(1)
      return {
        column,
        ok: !error,
        error: error?.message ?? null,
      }
    }),
  )
  return {
    ready: columns.every((entry) => entry.ok),
    columns,
  }
}

function probeSharePageTemplateRouteFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const routePath of GROWTH_SHARE_PAGE_TEMPLATE_PLATFORM_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({
      name: `route:${routePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  for (const routePath of GROWTH_SHARE_PAGE_TEMPLATE_ADMIN_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({
      name: `admin_route:${routePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  for (const modulePath of GROWTH_SHARE_PAGE_TEMPLATE_UI_MODULE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `ui:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  return checks
}

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

  const lineageProbe = await probeGrowthSharePageTemplateLineageSchema(admin)
  for (const entry of lineageProbe.columns) {
    checks.push({
      name: `growth.share_pages.${entry.column}`,
      ok: entry.ok,
      error: entry.error,
    })
  }

  for (const entry of probeSharePageTemplateRouteFiles()) {
    checks.push({
      name: entry.name,
      ok: entry.ok,
      error: entry.error,
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
      instantiation_migration: GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_MIGRATION,
      error: "schema_drift",
      failed_checks: failedChecks.map((check) => check.name),
      checks,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    preview_qa_marker: GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    route_files_verified: true,
    migration: GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
    instantiation_migration: GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_MIGRATION,
    lineage_schema_ready: lineageProbe.ready,
    checks,
  }
}
