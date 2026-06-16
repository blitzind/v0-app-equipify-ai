import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireSharePagePlatformAccess, type SharePagePlatformAccess } from "@/lib/growth/share-pages/share-page-platform-access"
import { isGrowthSharePageTemplatesSchemaReady } from "@/lib/growth/share-pages/share-page-template-schema-health"
import { validateSharePageOrganizationScope } from "@/lib/growth/share-pages/share-page-org-scope"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"

export type SharePageTemplatePlatformAccess = SharePagePlatformAccess

export async function requireSharePageTemplatePlatformAccess(): Promise<SharePageTemplatePlatformAccess> {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access

  if (!(await isGrowthSharePageTemplatesSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "schema_not_ready",
          message: "Share page templates schema is not ready.",
        },
        { status: 503 },
      ),
    }
  }

  return access
}

export function assertSharePageTemplateOrgScope(
  template: GrowthSharePageTemplate,
  organizationId: string,
): NextResponse | null {
  const scope = validateSharePageOrganizationScope({
    organizationId: template.organizationId,
    expectedOrganizationId: organizationId,
  })
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: scope.error ?? "organization_scope_mismatch" }, { status: 403 })
  }
  return null
}

export type { SupabaseClient }
