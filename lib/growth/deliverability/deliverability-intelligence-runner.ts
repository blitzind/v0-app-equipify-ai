import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDomainOperationalHealth, persistDomainHealthSnapshot } from "@/lib/growth/deliverability/domain-health-engine"
import {
  computeMailboxOperationalHealth,
  persistMailboxHealthSnapshot,
} from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { evaluateDeliverabilityProtections } from "@/lib/growth/deliverability/protection-rules"
import { runLiveDnsVerificationForAllDomains } from "@/lib/growth/deliverability/live-dns-service"
import { isLiveDnsVerificationEnabled } from "@/lib/growth/deliverability/live-dns-verifier"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"

export type DeliverabilityIntelligenceRunSummary = {
  dnsVerified: number
  dnsFailed: number
  dnsSkipped: number
  domainSnapshots: number
  mailboxSnapshots: number
  protectionsApplied: number
}

export async function runDeliverabilityIntelligenceScan(
  admin: SupabaseClient,
  input?: { dnsLimit?: number; senderLimit?: number },
): Promise<DeliverabilityIntelligenceRunSummary> {
  let dnsVerified = 0
  let dnsFailed = 0
  let dnsSkipped = 0

  if (isLiveDnsVerificationEnabled()) {
    const dns = await runLiveDnsVerificationForAllDomains(admin, input?.dnsLimit ?? 25)
    dnsVerified = dns.verified
    dnsFailed = dns.failed
    dnsSkipped = dns.skipped
  }

  const domains = await listSenderDomains(admin)
  let domainSnapshots = 0
  for (const domain of domains) {
    const health = await computeDomainOperationalHealth(admin, domain.id)
    await persistDomainHealthSnapshot(admin, health)
    domainSnapshots += 1
    const protections = await evaluateDeliverabilityProtections(admin, {
      domainId: domain.id,
      trigger: "scheduled_health_scan",
    })
    if (protections.length > 0) {
      // counted below
    }
  }

  const senders = (await listSenderAccounts(admin)).slice(0, input?.senderLimit ?? 50)
  let mailboxSnapshots = 0
  let protectionsApplied = 0
  for (const sender of senders) {
    const health = await computeMailboxOperationalHealth(admin, sender.id)
    if (health) {
      await persistMailboxHealthSnapshot(admin, health)
      mailboxSnapshots += 1
      const protections = await evaluateDeliverabilityProtections(admin, {
        senderAccountId: sender.id,
        trigger: "scheduled_health_scan",
      })
      protectionsApplied += protections.length
    }
  }

  return {
    dnsVerified,
    dnsFailed,
    dnsSkipped,
    domainSnapshots,
    mailboxSnapshots,
    protectionsApplied,
  }
}
