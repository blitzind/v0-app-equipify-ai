"use client"

import { useState } from "react"
import { Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildProspectSearchContactProviderMissingMessage,
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  logProspectSearchContactDiscoveryIssue,
  resolveProspectSearchContactProviderState,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function ProspectSearchContactDiscoveryButton({
  company,
  compact = false,
  className,
  onComplete,
}: {
  company: GrowthProspectSearchCompanyResult
  compact?: boolean
  className?: string
  onComplete?: () => void | Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const providerState = resolveProspectSearchContactProviderState(company)
  const label =
    providerState === "no_provider_connected" ? "Research contacts" : "Find contacts"

  async function runDiscovery() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ company_candidate_id: company.id, run: "1" })
      const res = await fetch(`/api/platform/growth/contact-discovery?${params}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || json.ok === false) {
        logProspectSearchContactDiscoveryIssue("contact_discovery_failed", {
          company_id: company.id,
          message: json.message ?? "request_failed",
        })
      }
      await onComplete?.()
    } catch (error) {
      logProspectSearchContactDiscoveryIssue("contact_discovery_failed", {
        company_id: company.id,
        message: error instanceof Error ? error.message : "unknown",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("space-y-1", className)} data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}>
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant={compact ? "outline" : "secondary"}
        disabled={loading || company.is_suppressed}
        onClick={(event) => {
          event.stopPropagation()
          void runDiscovery()
        }}
        aria-label={`${label} for ${company.company_name}`}
      >
        {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Users className="mr-1 size-3.5" />}
        {loading ? "Researching…" : label}
      </Button>
      {providerState === "no_provider_connected" && company.source_type === "external_discovered" ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          {buildProspectSearchContactProviderMissingMessage(company)}
        </p>
      ) : null}
    </div>
  )
}
