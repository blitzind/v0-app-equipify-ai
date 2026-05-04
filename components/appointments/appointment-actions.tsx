"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { MapPin, Mail, Apple, ChevronDown, Copy, Check, ExternalLink } from "lucide-react"
import { formatWorkOrderDisplay, getWorkOrderDisplay } from "@/lib/work-orders/display"

// ─── Map URL builders ─────────────────────────────────────────────────────────

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function buildAppleMapsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
}

// ─── Email builder ────────────────────────────────────────────────────────────

export interface EmailParams {
  customerName: string
  customerEmail?: string
  equipmentName: string
  technicianName: string
  scheduledDate: string
  scheduledTime?: string
  address: string
  /** DB id — used only after number/title; may appear as last-resort display (e.g. WO- in id). */
  workOrderId?: string
  /** When set, formatted as WO-####### in email copy. */
  workOrderNumber?: number | null
  /** Prefer over raw id when no numeric WO label (e.g. work order title / plan name). */
  workOrderTitle?: string
  ccEmails?: string[]
}

function fmtDateLong(dateStr: string): string {
  if (!dateStr) return ""
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/** Human-facing work order / reference line for email — never prefers raw UUID over title or WO number. */
function resolveAppointmentWoLabel(p: EmailParams): string {
  const n = p.workOrderNumber
  if (n != null && Number.isFinite(n)) {
    return formatWorkOrderDisplay(n)
  }
  const title = p.workOrderTitle?.trim()
  if (title) return title
  const id = p.workOrderId?.trim()
  if (!id) return ""
  return getWorkOrderDisplay({ id, workOrderNumber: p.workOrderNumber ?? undefined })
}

function buildEmail(params: EmailParams): { subject: string; body: string; mailto: string } {
  const dateStr = fmtDateLong(params.scheduledDate)
  const timeStr = params.scheduledTime ? ` at ${params.scheduledTime}` : ""
  const woLabel = resolveAppointmentWoLabel(params)

  const subject = `Appointment Confirmation${woLabel ? ` — ${woLabel}` : ""} · ${params.customerName}`

  const body = `Dear ${params.customerName},

This is a confirmation of your upcoming service appointment with Equipify.ai.

APPOINTMENT DETAILS
-------------------
Equipment:    ${params.equipmentName}
Date:         ${dateStr}${timeStr}
Address:      ${params.address}
Technician:   ${params.technicianName}${woLabel ? `\nWork Order:   ${woLabel}` : ""}

Please ensure the equipment is accessible at the time of service. If you need to reschedule, contact us at least 24 hours in advance.

We look forward to seeing you.

Best regards,
Equipify Service Team`

  const to = params.customerEmail ?? ""
  const cc = params.ccEmails?.join(",") ?? ""
  const mailtoParams = new URLSearchParams()
  if (cc) mailtoParams.set("cc", cc)
  mailtoParams.set("subject", subject)
  mailtoParams.set("body", body)

  const mailto = `mailto:${to}?${mailtoParams.toString()}`
  return { subject, body, mailto }
}

// ─── Trigger button shared style ──────────────────────────────────────────────

function TriggerButton({
  children,
  open,
}: {
  children: React.ReactNode
  open: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors cursor-pointer select-none",
        "bg-background border-border text-foreground hover:bg-muted",
        open && "bg-muted",
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          "w-3 h-3 text-muted-foreground transition-transform duration-150",
          open && "rotate-180",
        )}
      />
    </span>
  )
}

// ─── Map dropdown ─────────────────────────────────────────────────────────────

function MapDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Navigate to location">
          <TriggerButton open={open}>
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Navigate
          </TriggerButton>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-48">
        <DropdownMenuItem asChild>
          <a
            href={buildGoogleMapsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#4285F4]" />
            Open in Google Maps
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={buildAppleMapsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <Apple className="w-3.5 h-3.5" />
            Open in Apple Maps
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Email dropdown ───────────────────────────────────────────────────────────

function EmailDropdown({ params }: { params: EmailParams }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const email = buildEmail(params)

  function handleCopy() {
    navigator.clipboard.writeText(email.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Send appointment email">
          <TriggerButton open={open}>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[color:var(--status-success)]" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-primary" />
            )}
            Email
          </TriggerButton>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-52">
        <DropdownMenuItem asChild>
          <a
            href={email.mailto}
            className="flex items-start gap-2.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span>
              Open in email client
              {params.ccEmails?.length ? (
                <span className="block text-[10px] text-muted-foreground mt-0.5">
                  CC: {params.ccEmails.join(", ")}
                </span>
              ) : null}
            </span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          Copy email body
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface AppointmentActionsProps {
  address: string
  emailParams: EmailParams
  className?: string
}

export function AppointmentActions({ address, emailParams, className }: AppointmentActionsProps) {
  if (!address) return null
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <MapDropdown address={address} />
      <EmailDropdown params={emailParams} />
    </div>
  )
}
