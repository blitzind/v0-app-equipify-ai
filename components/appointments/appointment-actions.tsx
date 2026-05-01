"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { MapPin, Mail, Apple, ChevronDown, Copy, Check, ExternalLink } from "lucide-react"

// ─── Map URL builders ─────────────────────────────────────────────────────────

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function buildAppleMapsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
}

// ─── Email builder ────────────────────────────────────────────────────────────

interface EmailParams {
  customerName: string
  customerEmail?: string
  equipmentName: string
  technicianName: string
  scheduledDate: string
  scheduledTime?: string
  address: string
  workOrderId?: string
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

function buildEmail(params: EmailParams): { subject: string; body: string; mailto: string } {
  const dateStr = fmtDateLong(params.scheduledDate)
  const timeStr = params.scheduledTime
    ? ` at ${params.scheduledTime}`
    : ""

  const subject = `Appointment Confirmation${params.workOrderId ? ` — ${params.workOrderId}` : ""} · ${params.customerName}`

  const body = `Dear ${params.customerName},

This is a confirmation of your upcoming service appointment with Equipify.ai.

APPOINTMENT DETAILS
-------------------
Equipment:    ${params.equipmentName}
Date:         ${dateStr}${timeStr}
Address:      ${params.address}
Technician:   ${params.technicianName}${params.workOrderId ? `\nWork Order:   ${params.workOrderId}` : ""}

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

// ─── Map dropdown ─────────────────────────────────────────────────────────────

function MapDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors cursor-pointer",
          "bg-background border-border text-foreground hover:bg-muted",
        )}
        aria-label="Navigate to location"
        aria-expanded={open}
      >
        <MapPin className="w-3.5 h-3.5 text-primary" />
        Navigate
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <a
            href={buildGoogleMapsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#4285F4]" />
            Open in Google Maps
          </a>
          <a
            href={buildAppleMapsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors border-t border-border"
            onClick={() => setOpen(false)}
          >
            <Apple className="w-3.5 h-3.5 text-foreground" />
            Open in Apple Maps
          </a>
        </div>
      )}
    </div>
  )
}

// ─── Email dropdown ───────────────────────────────────────────────────────────

function EmailDropdown({ params }: { params: EmailParams }) {
  const [open, setOpen]       = useState(false)
  const [copied, setCopied]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const email = buildEmail(params)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function handleCopy() {
    navigator.clipboard.writeText(email.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors cursor-pointer",
          "bg-background border-border text-foreground hover:bg-muted",
        )}
        aria-label="Send appointment email"
        aria-expanded={open}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[color:var(--status-success)]" />
        ) : (
          <Mail className="w-3.5 h-3.5 text-primary" />
        )}
        Email
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <a
            href={email.mailto}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              Open in email client
              {params.ccEmails?.length ? (
                <span className="block text-[10px] text-muted-foreground mt-0.5">
                  CC: {params.ccEmails.join(", ")}
                </span>
              ) : null}
            </span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors border-t border-border cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            Copy email body
          </button>
        </div>
      )}
    </div>
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

export type { EmailParams }
