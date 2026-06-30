"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_OPPORTUNITIES_HUB_MANIFEST } from "@/lib/growth/hubs/growth-opportunities-hub-manifest"
import {
  buildGrowthOpportunityHref,
  resolveGrowthLeadIdFromSearchParams,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export default function GrowthOpportunitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadId = resolveGrowthLeadIdFromSearchParams(searchParams)
  const opportunityId = searchParams.get("opportunityId")

  useEffect(() => {
    if (leadId || opportunityId) {
      router.replace(buildGrowthOpportunityHref({ leadId, opportunityId }))
    }
  }, [leadId, opportunityId, router])

  if (leadId || opportunityId) {
    return null
  }

  return <GrowthWorkspaceHubPage manifest={GROWTH_OPPORTUNITIES_HUB_MANIFEST} embedded actionFirst />
}
