import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { buildDomainSenderMappings } from "@/lib/growth/deliverability/domain-sender-mapping"
import { createMaintenanceTask } from "@/lib/growth/outbound/sender-maintenance-engine"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"

export type DomainRotationRecommendation = {
  domain: string
  domainId: string
  recommendationType: "rotation" | "cooldown" | "risk_isolation"
  severity: "medium" | "high" | "critical"
  title: string
  detail: string
  evidence: string[]
}

export async function computeDomainRotationRecommendations(
  admin: SupabaseClient,
): Promise<DomainRotationRecommendation[]> {
  const recommendations: DomainRotationRecommendation[] = []
  const domains = await listSenderDomains(admin)
  const mappings = await buildDomainSenderMappings(admin)

  for (const domain of domains) {
    const health = await computeDomainOperationalHealth(admin, domain.id)
    const mapping = mappings.find((m) => m.domainId === domain.id)
    const evidence: string[] = []

    if (health.signals.bounceRate >= 3) evidence.push(`Bounce rate ${health.signals.bounceRate}%`)
    if (health.signals.complaintRate >= 0.2) evidence.push(`Complaint rate ${health.signals.complaintRate}%`)
    if (mapping?.concentrationRisk === "high") evidence.push(`${mapping.senderCount} senders concentrated`)

    if (health.signals.bounceRate >= 8 || health.signals.complaintRate >= 0.5) {
      recommendations.push({
        domain: domain.domain,
        domainId: domain.id,
        recommendationType: "cooldown",
        severity: "critical",
        title: `Cooldown domain ${domain.domain}`,
        detail: "Complaint/bounce acceleration — pause volume and rotate to secondary segment.",
        evidence,
      })
      await createMaintenanceTask(admin, {
        taskType: "domain_cooldown",
        severity: "critical",
        title: `Domain cooldown: ${domain.domain}`,
        summary: evidence.join("; "),
        senderDomainId: domain.id,
      }).catch(() => undefined)
    } else if (mapping?.concentrationRisk === "high" || health.signals.sendFailureRate >= 10) {
      recommendations.push({
        domain: domain.domain,
        domainId: domain.id,
        recommendationType: "rotation",
        severity: "high",
        title: `Rotate away from ${domain.domain}`,
        detail: "Send concentration or failure drift — redistribute to secondary/high-trust domains.",
        evidence,
      })
      await createMaintenanceTask(admin, {
        taskType: "domain_rotation",
        severity: "high",
        title: `Domain rotation: ${domain.domain}`,
        summary: evidence.join("; ") || "Concentration risk detected.",
        senderDomainId: domain.id,
      }).catch(() => undefined)
    } else if (domain.domain_segment === "primary" && (mapping?.senderCount ?? 0) >= 6) {
      recommendations.push({
        domain: domain.domain,
        domainId: domain.id,
        recommendationType: "risk_isolation",
        severity: "medium",
        title: `Segment imbalance on ${domain.domain}`,
        detail: "Consider moving experimental/warming senders to secondary domain segment.",
        evidence: [`${mapping?.senderCount} senders on primary segment`],
      })
    }
  }

  return recommendations
}
