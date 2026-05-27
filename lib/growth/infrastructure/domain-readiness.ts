import "server-only"

import type { GrowthSenderDomain } from "@/lib/growth/sender/sender-types"
import type { GrowthInfrastructureReadinessDescriptor } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { growthInfrastructureReadinessLabel } from "@/lib/growth/infrastructure/infrastructure-readiness-types"

export type GrowthDomainReadinessRow = {
  domainId: string
  domain: string
  readinessStatus: GrowthInfrastructureReadinessDescriptor["status"]
  readinessScore: number
  spfStatus: "verified" | "missing" | "manual_required"
  dkimStatus: "verified" | "missing" | "manual_required"
  dmarcStatus: "verified" | "missing" | "manual_required"
  mxStatus: "verified" | "missing" | "manual_required"
  trackingDomainReady: boolean
  manualVerificationRequired: boolean
  reputationWarnings: string[]
  healthTier: string
  checklist: Array<{ id: string; label: string; complete: boolean; manual: boolean }>
}

function recordStatus(present: boolean, valid: boolean): "verified" | "missing" | "manual_required" {
  if (present && valid) return "verified"
  if (present && !valid) return "manual_required"
  return "missing"
}

export function computeDomainReadiness(domain: GrowthSenderDomain): GrowthDomainReadinessRow {
  const spfStatus = recordStatus(domain.spf_valid, domain.spf_valid)
  const dkimStatus = recordStatus(domain.dkim_valid, domain.dkim_valid)
  const dmarcStatus = recordStatus(domain.dmarc_valid, domain.dmarc_valid)
  const mxStatus = recordStatus(domain.mx_valid, domain.mx_valid)

  const manualVerificationRequired = true
  const verifiedCount = [spfStatus, dkimStatus, dmarcStatus, mxStatus].filter((s) => s === "verified").length
  const readinessScore = Math.round((verifiedCount / 4) * 100)

  const reputationWarnings: string[] = []
  if ((domain.bounce_rate ?? 0) >= 5) reputationWarnings.push("Elevated bounce rate on domain.")
  if ((domain.spam_risk ?? 0) >= 50) reputationWarnings.push("Spam risk flagged on domain record.")
  if (domain.deliverability_score < 50) reputationWarnings.push("Deliverability score below operational threshold.")

  let readinessStatus: GrowthInfrastructureReadinessDescriptor["status"] = "stub"
  if (domain.status === "disabled") readinessStatus = "disabled"
  else if (reputationWarnings.length > 0 || domain.deliverability_score < 30) readinessStatus = "error"
  else if (readinessScore < 100 || domain.deliverability_score < 60) readinessStatus = "degraded"
  else if (readinessScore === 100) readinessStatus = "live"

  const checklist = [
    { id: "spf", label: "SPF record published and aligned", complete: spfStatus === "verified", manual: true },
    { id: "dkim", label: "DKIM record published and aligned", complete: dkimStatus === "verified", manual: true },
    { id: "dmarc", label: "DMARC policy published", complete: dmarcStatus === "verified", manual: true },
    { id: "mx", label: "MX records valid for mailbox provider", complete: mxStatus === "verified", manual: true },
    {
      id: "tracking",
      label: "Tracking domain configured (if used)",
      complete: false,
      manual: true,
    },
  ]

  return {
    domainId: domain.id,
    domain: domain.domain,
    readinessStatus,
    readinessScore,
    spfStatus,
    dkimStatus,
    dmarcStatus,
    mxStatus,
    trackingDomainReady: false,
    manualVerificationRequired,
    reputationWarnings,
    healthTier: domain.deliverability_score >= 70 ? "healthy" : domain.deliverability_score >= 40 ? "degraded" : "critical",
    checklist,
  }
}

export function resolveDnsValidationReadinessFromDomains(
  domains: GrowthDomainReadinessRow[],
): GrowthInfrastructureReadinessDescriptor {
  if (domains.length === 0) {
    return {
      status: "stub",
      label: growthInfrastructureReadinessLabel("stub"),
      detail: "No sender domains registered — DNS validation is stub-only until domains are added.",
    }
  }

  const hasError = domains.some((d) => d.readinessStatus === "error")
  const hasDegraded = domains.some((d) => d.readinessStatus === "degraded")

  if (hasError) {
    return {
      status: "error",
      label: growthInfrastructureReadinessLabel("error"),
      detail: "One or more domains have critical deliverability risk — manual verification required.",
    }
  }

  if (hasDegraded) {
    return {
      status: "degraded",
      label: growthInfrastructureReadinessLabel("degraded"),
      detail: "MANUAL VERIFICATION REQUIRED — DNS checks use stored flags only; no live DNS probes.",
    }
  }

  return {
    status: "stub",
    label: growthInfrastructureReadinessLabel("stub"),
    detail: "MANUAL VERIFICATION REQUIRED — live DNS probe not enabled; operator must verify SPF/DKIM/DMARC/MX externally.",
  }
}
