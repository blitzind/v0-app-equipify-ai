import "server-only"

import type { GrowthSenderDomain } from "@/lib/growth/sender/sender-types"
import type { GrowthInfrastructureReadinessDescriptor } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { growthInfrastructureReadinessLabel } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { isLiveDnsVerificationEnabled } from "@/lib/growth/deliverability/live-dns-verifier"

export type GrowthDomainReadinessRow = {
  domainId: string
  domain: string
  readinessStatus: GrowthInfrastructureReadinessDescriptor["status"]
  readinessScore: number
  verificationSource: GrowthSenderDomain["verification_source"]
  verificationLabel: string
  lastVerifiedAt: string | null
  verificationError: string | null
  manualOverride: boolean
  spfStatus: "verified" | "missing" | "manual_required"
  dkimStatus: "verified" | "missing" | "manual_required"
  dmarcStatus: "verified" | "missing" | "manual_required"
  mxStatus: "verified" | "missing" | "manual_required"
  trackingDomainReady: boolean
  manualVerificationRequired: boolean
  reputationWarnings: string[]
  healthTier: string
  operationalStatus: string
  checklist: Array<{ id: string; label: string; complete: boolean; manual: boolean }>
}

function recordStatus(valid: boolean, liveVerified: boolean): "verified" | "missing" | "manual_required" {
  if (valid && liveVerified) return "verified"
  if (valid) return "manual_required"
  return "missing"
}

function verificationLabel(domain: GrowthSenderDomain, liveEnabled: boolean): string {
  if (domain.manual_override) return "MANUAL OVERRIDE"
  if (domain.verification_source === "live" && liveEnabled && !domain.verification_error) return "LIVE VERIFIED"
  if (domain.verification_error) return "LIVE VERIFICATION FAILED"
  if (liveEnabled) return "LIVE DNS ENABLED — AWAITING VERIFICATION"
  return "MANUAL VERIFICATION REQUIRED"
}

export function computeDomainReadiness(domain: GrowthSenderDomain): GrowthDomainReadinessRow {
  const liveEnabled = isLiveDnsVerificationEnabled()
  const liveVerified =
    domain.verification_source === "live" && !domain.verification_error && Boolean(domain.last_verified_at)
  const manualOverride = domain.manual_override

  const spfStatus = recordStatus(domain.spf_valid, liveVerified || manualOverride)
  const dkimStatus = recordStatus(domain.dkim_valid, liveVerified || manualOverride)
  const dmarcStatus = recordStatus(domain.dmarc_valid, liveVerified || manualOverride)
  const mxStatus = recordStatus(domain.mx_valid, liveVerified || manualOverride)

  const manualVerificationRequired = !liveVerified && !manualOverride
  const verifiedCount = [spfStatus, dkimStatus, dmarcStatus, mxStatus].filter((s) => s === "verified").length
  let readinessScore = Math.round((verifiedCount / 4) * 100)
  if (domain.verification_error) readinessScore = Math.min(readinessScore, 40)
  if (!liveVerified && !manualOverride && liveEnabled) readinessScore = Math.min(readinessScore, 60)

  const reputationWarnings: string[] = []
  if (domain.verification_error) reputationWarnings.push(`DNS verification error: ${domain.verification_error}`)
  if ((domain.bounce_rate ?? 0) >= 5) reputationWarnings.push("Elevated bounce rate on domain.")
  if ((domain.spam_risk ?? 0) >= 50) reputationWarnings.push("Spam risk flagged on domain record.")
  if (domain.deliverability_score < 50) reputationWarnings.push("Deliverability score below operational threshold.")
  if (domain.operational_status === "paused") reputationWarnings.push("Domain operationally paused.")

  let readinessStatus: GrowthInfrastructureReadinessDescriptor["status"] = "stub"
  if (domain.status === "disabled" || domain.operational_status === "paused") readinessStatus = "disabled"
  else if (domain.verification_error || reputationWarnings.length > 2 || domain.deliverability_score < 30) {
    readinessStatus = "error"
  } else if (manualOverride) readinessStatus = "degraded"
  else if (liveVerified) readinessStatus = "live"
  else if (readinessScore < 100 || domain.deliverability_score < 60) readinessStatus = "degraded"

  const checklist = [
    {
      id: "spf",
      label: "SPF record published and aligned",
      complete: spfStatus === "verified",
      manual: !liveVerified && !manualOverride,
    },
    {
      id: "dkim",
      label: "DKIM record published and aligned",
      complete: dkimStatus === "verified",
      manual: !liveVerified && !manualOverride,
    },
    {
      id: "dmarc",
      label: "DMARC policy published",
      complete: dmarcStatus === "verified",
      manual: !liveVerified && !manualOverride,
    },
    {
      id: "mx",
      label: "MX records valid for mailbox provider",
      complete: mxStatus === "verified",
      manual: !liveVerified && !manualOverride,
    },
    {
      id: "tracking",
      label: "Tracking domain configured (if used)",
      complete: Boolean(domain.tracking_domain),
      manual: true,
    },
  ]

  return {
    domainId: domain.id,
    domain: domain.domain,
    readinessStatus,
    readinessScore,
    verificationSource: domain.verification_source,
    verificationLabel: verificationLabel(domain, liveEnabled),
    lastVerifiedAt: domain.last_verified_at,
    verificationError: domain.verification_error,
    manualOverride,
    spfStatus,
    dkimStatus,
    dmarcStatus,
    mxStatus,
    trackingDomainReady: Boolean(domain.tracking_domain),
    manualVerificationRequired,
    reputationWarnings,
    healthTier:
      domain.domain_health_score >= 70
        ? "healthy"
        : domain.domain_health_score >= 40
          ? "degraded"
          : "critical",
    operationalStatus: domain.operational_status,
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

  const liveEnabled = isLiveDnsVerificationEnabled()
  const hasLiveVerified = domains.some((d) => d.verificationLabel === "LIVE VERIFIED")
  const hasManualOverride = domains.some((d) => d.manualOverride)
  const hasError = domains.some((d) => d.readinessStatus === "error")
  const hasDegraded = domains.some((d) => d.readinessStatus === "degraded")

  if (hasError) {
    return {
      status: "error",
      label: growthInfrastructureReadinessLabel("error"),
      detail: "One or more domains have DNS verification failures or critical deliverability risk.",
    }
  }

  if (hasLiveVerified && !hasDegraded) {
    return {
      status: "live",
      label: growthInfrastructureReadinessLabel("live"),
      detail: "LIVE VERIFIED — DNS records probed via resolver (GROWTH_LIVE_DNS_VERIFICATION=true).",
    }
  }

  if (hasManualOverride) {
    return {
      status: "degraded",
      label: growthInfrastructureReadinessLabel("degraded"),
      detail: "MANUAL OVERRIDE — operator attested DNS readiness; live probe skipped for flagged domains.",
    }
  }

  if (liveEnabled) {
    return {
      status: "degraded",
      label: growthInfrastructureReadinessLabel("degraded"),
      detail: "Live DNS enabled — domains awaiting successful verification run.",
    }
  }

  return {
    status: "stub",
    label: growthInfrastructureReadinessLabel("stub"),
    detail: "MANUAL VERIFICATION REQUIRED — set GROWTH_LIVE_DNS_VERIFICATION=true for live DNS probes.",
  }
}
