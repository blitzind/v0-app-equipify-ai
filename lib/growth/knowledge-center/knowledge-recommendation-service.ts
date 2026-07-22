/** Phase GS-3D — Knowledge recommendation server + audit — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  generatePlatformKnowledgeRecommendationsForRequest as generatePlatformKnowledgeRecommendationsForRequestImpl,
  persistPlatformKnowledgeRecommendationAudit as persistPlatformKnowledgeRecommendationAuditImpl,
  type PlatformKnowledgeRecommendationGenerateRequest,
} from "@fuzor/knowledge"

import { resolveKnowledgeOrganizationId } from "@/lib/growth/knowledge-center/knowledge-org-bootstrap"

export const persistKnowledgeRecommendationAudit = persistPlatformKnowledgeRecommendationAuditImpl

export async function generateKnowledgeRecommendationsForRequest(
  admin: SupabaseClient,
  request: PlatformKnowledgeRecommendationGenerateRequest,
) {
  return generatePlatformKnowledgeRecommendationsForRequestImpl(admin, {
    ...request,
    organization_id: resolveKnowledgeOrganizationId(request.organization_id),
  })
}
