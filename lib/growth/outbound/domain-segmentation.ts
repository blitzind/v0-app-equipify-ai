import "server-only"

import type { GrowthDomainSegment } from "@/lib/growth/outbound/reputation-safe-scaling-types"

export type DomainSegmentPolicy = {
  segment: GrowthDomainSegment
  allowOutbound: boolean
  throttleMultiplier: number
  riskIsolation: boolean
  label: string
}

const POLICIES: Record<GrowthDomainSegment, DomainSegmentPolicy> = {
  primary: {
    segment: "primary",
    allowOutbound: true,
    throttleMultiplier: 1,
    riskIsolation: false,
    label: "Primary production domain",
  },
  secondary: {
    segment: "secondary",
    allowOutbound: true,
    throttleMultiplier: 0.75,
    riskIsolation: true,
    label: "Secondary outbound domain",
  },
  experimental: {
    segment: "experimental",
    allowOutbound: true,
    throttleMultiplier: 0.4,
    riskIsolation: true,
    label: "Experimental — low volume only",
  },
  warming: {
    segment: "warming",
    allowOutbound: true,
    throttleMultiplier: 0.3,
    riskIsolation: true,
    label: "Warming domain — capped throughput",
  },
  paused: {
    segment: "paused",
    allowOutbound: false,
    throttleMultiplier: 0,
    riskIsolation: true,
    label: "Paused — no outbound",
  },
  high_trust: {
    segment: "high_trust",
    allowOutbound: true,
    throttleMultiplier: 1,
    riskIsolation: false,
    label: "High-trust domain",
  },
}

export function resolveDomainSegmentPolicy(segment: string | null | undefined): DomainSegmentPolicy {
  const key = (segment ?? "primary") as GrowthDomainSegment
  return POLICIES[key] ?? POLICIES.primary
}

export function isDomainSegmentCompatible(
  campaignSegment: GrowthDomainSegment | null | undefined,
  domainSegment: GrowthDomainSegment | null | undefined,
): boolean {
  const domain = resolveDomainSegmentPolicy(domainSegment)
  if (!domain.allowOutbound) return false
  if (!campaignSegment || campaignSegment === "primary") return domainSegment !== "paused"
  if (campaignSegment === "experimental") return ["experimental", "warming", "secondary"].includes(domain.segment)
  if (campaignSegment === "warming") return domain.segment === "warming"
  return true
}

export function domainSegmentLabel(segment: GrowthDomainSegment): string {
  return resolveDomainSegmentPolicy(segment).label
}
