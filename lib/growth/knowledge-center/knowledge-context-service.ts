/** Phase GS-3C — Knowledge context injection server + audit — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  injectPlatformKnowledgeContext,
  persistPlatformKnowledgeContextRetrievalAudit as persistPlatformKnowledgeContextRetrievalAuditImpl,
  type PlatformKnowledgeContextInjectionRequest,
} from "@fuzor/knowledge"

import { resolveKnowledgeOrganizationId } from "@/lib/growth/knowledge-center/knowledge-org-bootstrap"

export const persistKnowledgeContextRetrievalAudit = persistPlatformKnowledgeContextRetrievalAuditImpl

export async function injectKnowledgeContext(
  admin: SupabaseClient,
  request: PlatformKnowledgeContextInjectionRequest,
) {
  return injectPlatformKnowledgeContext(admin, {
    ...request,
    organization_id: resolveKnowledgeOrganizationId(request.organization_id),
  })
}
