"use client"

import Link from "next/link"
import { ExternalLink, Truck } from "lucide-react"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthProviderSetupDashboard } from "@/components/growth/growth-provider-setup-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { Button } from "@/components/ui/button"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_DELIVERY_SETTINGS_QA_MARKER,
  GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
  GROWTH_WORKSPACE_REPUTATION_PATH,
  GROWTH_WORKSPACE_SENDER_POOLS_PATH,
  GROWTH_WORKSPACE_SENDER_SETUP_PATH,
  GROWTH_WORKSPACE_WARMUP_PATH,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"

export function GrowthDeliverySetupPanel() {
  return (
    <div className="flex flex-col gap-8" data-qa-marker={GROWTH_DELIVERY_SETTINGS_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Communications"
        description="Connect mailboxes, validate DNS, configure warmup, and monitor reputation before outbound execution."
        icon={Truck}
        iconClassName="bg-emerald-50 text-emerald-700"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={GROWTH_COMMUNICATIONS_SETTINGS_PATH}>All communications settings</Link>
          </Button>
        }
      />

      <GrowthInfrastructureReadinessStrip
        surfaceId="mailbox_provider"
        title="Mailbox & delivery readiness"
        matchTitle="Google mailbox (primary)"
      />

      <section id="mailbox-oauth" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Mailbox OAuth</h2>
          <p className="text-sm text-muted-foreground">
            Connect or reconnect Gmail and Microsoft mailboxes. Tokens are encrypted server-side.
          </p>
        </div>
        <GrowthProviderSetupDashboard variant="operator" oauthReturnTo={GROWTH_COMMUNICATIONS_MAILBOXES_PATH} />
      </section>

      <section id={GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR.slice(1)} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Connected Mailboxes</h2>
          <p className="text-sm text-muted-foreground">
            Operational view of sender mailboxes, warmup status, pool membership, and human-approved test sends.
          </p>
        </div>
        <GrowthConnectedMailboxesDashboard oauthReturnTo={GROWTH_COMMUNICATIONS_MAILBOXES_PATH} />
      </section>

      <GrowthEngineCard title="More communications settings">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button type="button" variant="outline" asChild className="justify-start">
            <Link href={GROWTH_WORKSPACE_SENDER_SETUP_PATH}>
              Sending Domains
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild className="justify-start">
            <Link href={GROWTH_WORKSPACE_DNS_VERIFICATION_PATH}>
              Deliverability &amp; DNS
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild className="justify-start">
            <Link href={GROWTH_WORKSPACE_WARMUP_PATH}>
              Warmup
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild className="justify-start">
            <Link href={GROWTH_WORKSPACE_SENDER_POOLS_PATH}>
              Sender Pools
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild className="justify-start">
            <Link href={GROWTH_WORKSPACE_REPUTATION_PATH}>
              Reputation
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Link>
          </Button>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
