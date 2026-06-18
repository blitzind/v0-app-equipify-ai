/** Growth Engine A1 — Video Recording Studio foundation audit (client-safe). */

import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_VIDEO_WORKSPACE_TABS,
  GROWTH_VIDEO_WORKSPACE_NAV_QA_MARKER,
} from "@/lib/growth/navigation/growth-video-workspace-navigation"
import { GROWTH_ROUTE_CATALOG_INPUTS } from "@/lib/growth/navigation/growth-route-catalog-data"
import { getGrowthRouteMetadataById } from "@/lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  validateGrowthWorkspaceShellNavRegistryParity,
} from "@/lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "@/lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  buildGrowthVideoWorkspaceReadinessPayload,
  isGrowthVideoWorkspaceEnabled,
} from "@/lib/growth/videos/growth-video-route-gates"
import {
  GROWTH_VIDEO_FOUNDATION_CONFIRM,
  GROWTH_VIDEO_FOUNDATION_MIGRATION,
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
  GROWTH_VIDEO_FEATURE_FLAG,
  GROWTH_VIDEO_WORKSPACE_ROUTE_IDS,
} from "@/lib/growth/videos/growth-video-types"
import { GROWTH_VIDEO_SCHEMA_OBJECTS } from "@/lib/growth/videos/growth-video-schema-health"

export const GROWTH_VIDEO_FOUNDATION_AUDIT_QA_MARKER = "growth-video-foundation-audit-a1-v1" as const

export const GROWTH_VIDEO_FOUNDATION_REQUIRED_FILES = [
  "supabase/migrations/20270828130000_growth_engine_video_recording_studio_foundation.sql",
  "lib/growth/videos/growth-video-types.ts",
  "lib/growth/videos/growth-video-route-gates.ts",
  "lib/growth/videos/growth-video-schema-health.ts",
  "lib/growth/videos/growth-video-service.ts",
  "lib/growth/videos/growth-video-storage-service.ts",
  "lib/growth/videos/growth-video-analytics-service.ts",
  "lib/growth/videos/growth-video-upload-service.ts",
  "lib/growth/videos/growth-video-validation.ts",
  "lib/growth/videos/providers/supabase-video-storage-provider.ts",
  "app/api/growth/videos/assets/route.ts",
  "components/growth/videos/growth-video-library-panel.tsx",
  "components/growth/videos/growth-video-upload-modal.tsx",
  "components/growth/videos/growth-video-asset-detail-panel.tsx",
  "app/(growth)/growth/videos/library/[id]/page.tsx",
  "lib/growth/videos/recording/webcam-recorder.ts",
  "lib/growth/videos/recording/screen-recorder.ts",
  "lib/growth/videos/recording/recording-session.ts",
  "lib/growth/navigation/growth-video-workspace-navigation.ts",
  "lib/growth/hubs/growth-videos-hub-manifest.ts",
  "components/growth/videos/growth-video-library-shell.tsx",
  "components/growth/videos/growth-video-record-shell.tsx",
  "components/growth/videos/growth-video-templates-shell.tsx",
  "components/growth/videos/growth-video-analytics-shell.tsx",
  "components/growth/videos/growth-video-settings-shell.tsx",
  "app/(growth)/growth/videos/page.tsx",
  "app/(growth)/growth/videos/library/page.tsx",
  "app/(growth)/growth/videos/record/page.tsx",
  "app/(growth)/growth/videos/templates/page.tsx",
  "app/(growth)/growth/videos/analytics/page.tsx",
  "app/(growth)/growth/videos/settings/page.tsx",
  "app/(admin)/admin/growth/videos/page.tsx",
  "app/(admin)/admin/growth/video-templates/page.tsx",
  "app/(admin)/admin/growth/video-analytics/page.tsx",
] as const

export const GROWTH_VIDEO_WORKSPACE_ROUTE_IDS_EXPECTED = [
  "workspace-videos",
  "workspace-videos-library",
  "workspace-videos-library-detail",
  "workspace-videos-pages",
  "workspace-videos-pages-new",
  "workspace-videos-pages-detail",
  "workspace-videos-record",
  "workspace-videos-templates",
  "workspace-videos-analytics",
  "workspace-videos-settings",
] as const

export type GrowthVideoFoundationAuditFinding = {
  id: string
  severity: "info" | "warning" | "critical"
  message: string
}

export function auditGrowthVideoFoundationFiles(cwd = process.cwd()): GrowthVideoFoundationAuditFinding[] {
  const findings: GrowthVideoFoundationAuditFinding[] = []

  for (const relativePath of GROWTH_VIDEO_FOUNDATION_REQUIRED_FILES) {
    if (!fs.existsSync(path.join(cwd, relativePath))) {
      findings.push({
        id: `missing_file_${relativePath.replace(/[/.]/g, "_")}`,
        severity: "critical",
        message: `Missing required file: ${relativePath}`,
      })
    }
  }

  const migrationPath = path.join(cwd, "supabase/migrations/20270828130000_growth_engine_video_recording_studio_foundation.sql")
  if (fs.existsSync(migrationPath)) {
    const migration = fs.readFileSync(migrationPath, "utf8")
    for (const table of ["video_assets", "video_templates", "video_views"]) {
      if (!migration.includes(`growth.${table}`)) {
        findings.push({
          id: `migration_missing_table_${table}`,
          severity: "critical",
          message: `Migration missing table growth.${table}`,
        })
      }
    }
  }

  return findings
}

export function auditGrowthVideoFoundationRoutes(): GrowthVideoFoundationAuditFinding[] {
  const findings: GrowthVideoFoundationAuditFinding[] = []

  for (const routeId of GROWTH_VIDEO_WORKSPACE_ROUTE_IDS_EXPECTED) {
    const route = getGrowthRouteMetadataById(routeId)
    if (!route) {
      findings.push({
        id: `missing_route_${routeId}`,
        severity: "critical",
        message: `Route not registered: ${routeId}`,
      })
      continue
    }
    if (route.migrationStatus !== "dual-route") {
      findings.push({
        id: `route_not_dual_${routeId}`,
        severity: "warning",
        message: `Route ${routeId} should be dual-route`,
      })
    }
  }

  const aliasRoutes = ["admin-video-templates", "admin-video-analytics"]
  for (const routeId of aliasRoutes) {
    if (!getGrowthRouteMetadataById(routeId)) {
      findings.push({
        id: `missing_admin_alias_${routeId}`,
        severity: "critical",
        message: `Admin alias route not registered: ${routeId}`,
      })
    }
  }

  if (GROWTH_ROUTE_CATALOG_INPUTS.filter((row) => row.path.includes("/videos")).length < 11) {
    findings.push({
      id: "videos_route_catalog_sparse",
      severity: "warning",
      message: "Expected at least eleven /videos catalog entries",
    })
  }

  return findings
}

export function auditGrowthVideoFoundationNavigation(): GrowthVideoFoundationAuditFinding[] {
  const findings: GrowthVideoFoundationAuditFinding[] = []

  const manifestVideos = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items).find(
    (item) => item.id === "videos",
  )
  if (!manifestVideos) {
    findings.push({
      id: "videos_nav_missing",
      severity: "critical",
      message: "Videos nav item missing from workspace shell manifest",
    })
  }

  if (!GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("videos")) {
    findings.push({
      id: "videos_operator_nav_missing",
      severity: "critical",
      message: "videos id missing from GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS",
    })
  }

  const parityIssues = validateGrowthWorkspaceShellNavRegistryParity()
  for (const issue of parityIssues) {
    findings.push({
      id: `nav_parity_${issue.navId}`,
      severity: "critical",
      message: issue.message,
    })
  }

  if (GROWTH_VIDEO_WORKSPACE_TABS.length !== GROWTH_VIDEO_WORKSPACE_ROUTE_IDS.length) {
    findings.push({
      id: "video_tab_manifest_mismatch",
      severity: "warning",
      message: "Video workspace tabs should match route id manifest length",
    })
  }

  if (GROWTH_VIDEO_WORKSPACE_NAV_QA_MARKER !== "growth-video-workspace-nav-a1-v1") {
    findings.push({
      id: "video_nav_qa_marker",
      severity: "warning",
      message: "Video workspace nav QA marker drift",
    })
  }

  return findings
}

export function auditGrowthVideoFoundationFeatureFlag(): GrowthVideoFoundationAuditFinding[] {
  const findings: GrowthVideoFoundationAuditFinding[] = []

  if (!isGrowthVideoWorkspaceEnabled({})) {
    findings.push({
      id: "video_workspace_flag_default_disabled",
      severity: "warning",
      message: "growth_video_workspace_enabled should default enabled internally",
    })
  }

  const readiness = buildGrowthVideoWorkspaceReadinessPayload()
  if (readiness.feature_flag !== GROWTH_VIDEO_FEATURE_FLAG) {
    findings.push({
      id: "video_feature_flag_name",
      severity: "critical",
      message: "Feature flag name mismatch in readiness payload",
    })
  }

  if (!readiness.requires_human_review || readiness.outreach_execution || readiness.enrollment_execution) {
    findings.push({
      id: "video_safety_invariants",
      severity: "critical",
      message: "Video readiness payload must preserve human-supervised execution gates",
    })
  }

  return findings
}

export function auditGrowthVideoFoundationServices(): GrowthVideoFoundationAuditFinding[] {
  const findings: GrowthVideoFoundationAuditFinding[] = []

  if (GROWTH_VIDEO_SCHEMA_OBJECTS.length !== 5) {
    findings.push({
      id: "video_schema_objects",
      severity: "critical",
      message: "Expected five video schema objects",
    })
  }

  if (GROWTH_VIDEO_FOUNDATION_QA_MARKER !== "growth-video-foundation-a1-v1") {
    findings.push({
      id: "video_qa_marker",
      severity: "critical",
      message: "Video foundation QA marker drift",
    })
  }

  if (GROWTH_VIDEO_FOUNDATION_CONFIRM !== "RUN_GROWTH_VIDEO_FOUNDATION_CERTIFICATION") {
    findings.push({
      id: "video_confirm_token",
      severity: "critical",
      message: "Video foundation confirm token drift",
    })
  }

  if (GROWTH_VIDEO_FOUNDATION_MIGRATION !== "20270828130000_growth_engine_video_recording_studio_foundation.sql") {
    findings.push({
      id: "video_migration_constant",
      severity: "critical",
      message: "Video migration constant drift",
    })
  }

  return findings
}

export function runGrowthVideoFoundationAudit(cwd = process.cwd()): {
  qa_marker: typeof GROWTH_VIDEO_FOUNDATION_AUDIT_QA_MARKER
  ok: boolean
  findings: GrowthVideoFoundationAuditFinding[]
} {
  const findings = [
    ...auditGrowthVideoFoundationFiles(cwd),
    ...auditGrowthVideoFoundationRoutes(),
    ...auditGrowthVideoFoundationNavigation(),
    ...auditGrowthVideoFoundationFeatureFlag(),
    ...auditGrowthVideoFoundationServices(),
  ]

  return {
    qa_marker: GROWTH_VIDEO_FOUNDATION_AUDIT_QA_MARKER,
    ok: findings.filter((f) => f.severity === "critical").length === 0,
    findings,
  }
}
