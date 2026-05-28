"use client"

import { AlertTriangle, ArrowRight, Mail, Phone, Search, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import {
  GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER,
  GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

function readinessBadgeVariant(
  tier: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (tier === "ready") return "default"
  if (tier === "blocked") return "destructive"
  if (tier === "research_needed" || tier === "verification_needed") return "secondary"
  return "outline"
}

function channelIcon(channel: string) {
  if (channel === "email") return <Mail className="size-3" />
  if (channel === "call") return <Phone className="size-3" />
  return null
}

export function ProspectSearchAccountStrategyPanel({
  strategy,
  compact = false,
  onResearchAction,
}: {
  strategy: ProspectSearchAccountContactStrategy | null | undefined
  compact?: boolean
  onResearchAction?: (actionId: string) => void
}) {
  if (!strategy) return null

  return (
    <section
      className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4"
      data-account-strategy-marker={GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER}
      data-multi-contact-orchestration-marker={GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={readinessBadgeVariant(strategy.account_outreach_readiness)}>
          {strategy.account_outreach_readiness.replace(/_/g, " ")}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {channelIcon(strategy.recommended_channel)}
          {strategy.recommended_channel.replace(/_/g, " ")}
        </Badge>
      </div>

      {strategy.strategy_summary ? (
        <p className="mt-2 text-sm font-medium text-cyan-950">{strategy.strategy_summary}</p>
      ) : null}

      <p className="mt-1 text-xs text-muted-foreground">{strategy.safest_next_action}</p>

      {strategy.primary_contact ? (
        <div className="mt-3 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs">
          <p className="font-medium text-cyan-900">Recommended first contact</p>
          <p className="mt-1 font-semibold">
            {strategy.primary_contact.full_name ?? "Contact"} · {strategy.primary_contact.persona_label}
          </p>
          <p className="mt-0.5 text-muted-foreground">{strategy.primary_contact.channel_reason}</p>
        </div>
      ) : null}

      {!compact && strategy.secondary_contacts.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Backup contacts
          </p>
          <ul className="mt-1.5 space-y-1">
            {strategy.secondary_contacts.map((contact) => (
              <li
                key={contact.contact_id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
              >
                <ArrowRight className="size-3 text-muted-foreground" />
                <span>
                  {contact.full_name ?? contact.persona_label} · {contact.recommended_channel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && strategy.fallback_contacts.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fallback contacts
          </p>
          <ul className="mt-1.5 space-y-1">
            {strategy.fallback_contacts.slice(0, 2).map((contact) => (
              <li key={contact.contact_id} className="text-xs text-muted-foreground">
                {contact.full_name ?? contact.persona_label} · {contact.channel_reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && strategy.blocked_contacts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-red-900">
            <ShieldAlert className="size-3.5" />
            Avoid — blocked contacts
          </div>
          <ul className="mt-1.5 space-y-0.5 text-red-900/90">
            {strategy.blocked_contacts.map((contact) => (
              <li key={contact.contact_id}>
                {contact.full_name ?? "Contact"}: {contact.block_reason ?? "compliance blocked"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {strategy.missing_personas.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Missing personas: {strategy.missing_personas.map((p) => p.replace(/_/g, " ")).join(", ")}
        </p>
      ) : null}

      {strategy.risks.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
          {strategy.risks.map((risk) => (
            <li key={risk} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {risk}
            </li>
          ))}
        </ul>
      ) : null}

      {strategy.queue_prioritization_reason ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Queue priority: {strategy.queue_prioritization_reason}
        </p>
      ) : null}

      {!compact && strategy.research_actions.length > 0 && onResearchAction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {strategy.research_actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => onResearchAction(action.id)}
            >
              <Search className="mr-1 size-3" />
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
