"use client"

import Link from "next/link"
import { ArrowRight, Mail, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_CARDS,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
  type GrowthCommunicationsSettingsCard,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_PAGE_HEADER_ICON,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { cn } from "@/lib/utils"

const SIGNATURES_HUB_CARD: GrowthCommunicationsSettingsCard = {
  id: "signatures",
  title: "Email Signatures",
  description: "Sender profiles, signature templates, and mailbox assignments for outreach.",
  href: growthEngineCustomerSettingsHref("email-signatures"),
  icon: Mail,
}

type HubGroup = {
  id: string
  title: string
  description: string
  cardIds: string[]
}

const COMMUNICATIONS_HUB_GROUPS: HubGroup[] = [
  {
    id: "accounts",
    title: "Accounts & identity",
    description: "Connect mailboxes and configure how senders appear in outbound email.",
    cardIds: ["mailboxes", "signatures"],
  },
  {
    id: "infrastructure",
    title: "Sending infrastructure",
    description: "Register domains and verify DNS before scaling outbound volume.",
    cardIds: ["sending-domains", "deliverability"],
  },
  {
    id: "health",
    title: "Volume & reputation",
    description: "Warm up senders, organize pools, and monitor deliverability health.",
    cardIds: ["warmup", "sender-pools", "reputation"],
  },
]

function resolveHubCard(cardId: string): GrowthCommunicationsSettingsCard | null {
  if (cardId === "signatures") return SIGNATURES_HUB_CARD
  return GROWTH_COMMUNICATIONS_SETTINGS_CARDS.find((card) => card.id === cardId) ?? null
}

function CommunicationsHubCard({ card }: { card: GrowthCommunicationsSettingsCard }) {
  return (
    <Link
      href={card.href}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              GROWTH_SETTINGS_PAGE_HEADER_ICON,
            )}
          >
            <card.icon size={17} aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </div>
        </div>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  )
}

export function GrowthCommunicationsSettingsHub() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER}
      data-growth-settings-communications-refinement={GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Communications"
        description="Mailboxes, DNS, warmup, sender pools, and reputation — configure outbound email readiness here."
        icon={Truck}
        actions={
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/settings`}>All settings</Link>
          </Button>
        }
      />

      {COMMUNICATIONS_HUB_GROUPS.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{group.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.cardIds.map((cardId) => {
              const card = resolveHubCard(cardId)
              if (!card) return null
              return <CommunicationsHubCard key={card.id} card={card} />
            })}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Start by connecting a mailbox, then verify DNS and warmup before scaling sends.{" "}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" asChild>
          <Link href={GROWTH_COMMUNICATIONS_SETTINGS_CARDS[0].href}>Connect a mailbox</Link>
        </Button>
      </div>
    </div>
  )
}
