"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  Info,
  Mail,
  Plug,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DRAWER_NESTED_CARD } from "@/components/detail-drawer"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  OutboundProviderCapabilities,
  OutboundProviderCapabilityKey,
  OutboundProviderCapabilityStatus,
} from "@/lib/growth/outbound/provider-capabilities"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"
import { cn } from "@/lib/utils"

export const GROWTH_SETTINGS_UI_QA_MARKER = "growth-settings-ui-v2"

export const GROWTH_SETTINGS_SECTION_GAP = "space-y-4"
export const GROWTH_SETTINGS_INNER_GAP = "space-y-3"
export const GROWTH_SETTINGS_FORM_GAP = "space-y-1.5"

export function GrowthSettingsCard({
  title,
  icon,
  children,
  className,
  id,
  headerAside,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  headerAside?: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        DRAWER_NESTED_CARD,
        "p-4 shadow-sm ring-1 ring-border/40 dark:ring-[#25324C]/80",
        className,
      )}
    >
      <div className="mb-3 flex min-h-8 items-center gap-2 border-b border-border/60 pb-2 dark:border-[#25324C]">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h3 className="flex-1 text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {headerAside}
      </div>
      {children}
    </section>
  )
}

export function GrowthSettingsBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string
  tone?: React.ComponentProps<typeof GrowthBadge>["tone"]
  className?: string
}) {
  return (
    <GrowthBadge
      label={label}
      tone={tone}
      className={cn("px-1.5 py-0 text-[9px] font-medium normal-case tracking-normal", className)}
    />
  )
}

export function GrowthSettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 dark:border-[#25324C]">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium leading-tight", disabled && "text-muted-foreground")}>{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

const COMPACT_CAPABILITY_KEYS: Array<{
  key: OutboundProviderCapabilityKey
  label: string
  icon: LucideIcon
}> = [
  { key: "webhook_events", label: "Webhooks", icon: Webhook },
  { key: "sequences", label: "Sequences", icon: Workflow },
  { key: "reply_detection", label: "Replies", icon: Mail },
  { key: "open_click_tracking", label: "Tracking", icon: Activity },
  { key: "send_api", label: "API", icon: Plug },
]

function capabilityTone(status: OutboundProviderCapabilityStatus): string {
  if (status === "supported") return "text-foreground"
  if (status === "partial") return "text-amber-700 dark:text-amber-300"
  if (status === "planned") return "text-muted-foreground"
  return "text-muted-foreground/50 line-through"
}

function providerAction(
  provider: OutboundProviderCapabilities,
  connections: GrowthEmailProviderConnection[],
  activeConnectionId: string,
): { label: string; tone: "healthy" | "neutral" | "attention"; href?: string } {
  const familyConnections = connections.filter(
    (entry) => entry.providerFamily === provider.providerFamily && entry.status === "active",
  )
  const active = familyConnections.find((entry) => entry.id === activeConnectionId)
  if (active) return { label: "Active", tone: "attention" }
  if (familyConnections.length > 0) return { label: "Connected", tone: "healthy" }
  return { label: "Configure", tone: "neutral", href: "/admin/growth/outreach" }
}

export function GrowthEmailProviderComparisonList({
  providers,
  connections,
  activeConnectionId,
}: {
  providers: OutboundProviderCapabilities[]
  connections: GrowthEmailProviderConnection[]
  activeConnectionId: string
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border dark:divide-[#25324C] dark:border-[#25324C]">
      {providers.map((provider) => {
        const action = providerAction(provider, connections, activeConnectionId)
        return (
          <div
            key={provider.providerFamily}
            className="flex min-h-[4.5rem] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">{provider.displayName}</p>
                {provider.fixtureOnly ? (
                  <GrowthSettingsBadge label="Sample data" tone="attention" />
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      aria-label={`About ${provider.displayName}`}
                    >
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {provider.summary}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                <span className="text-muted-foreground">Capabilities:</span>
                {COMPACT_CAPABILITY_KEYS.map(({ key, label, icon: Icon }, index) => {
                  const status = provider.capabilities[key]
                  return (
                    <span key={key} className="inline-flex items-center gap-1">
                      {index > 0 ? <span className="text-muted-foreground/40">•</span> : null}
                      <span className={cn("inline-flex items-center gap-0.5", capabilityTone(status))}>
                        <Icon className="size-3 shrink-0 opacity-70" />
                        {label}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:pl-3">
              {action.href ? (
                <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <GrowthSettingsBadge label={action.label} tone={action.tone} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
