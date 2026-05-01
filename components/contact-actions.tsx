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
import {
  MapPin, Mail, Phone, MessageSquare, MoreHorizontal,
  ExternalLink, Copy, Check, ChevronDown,
} from "lucide-react"

// ─── URL builders ──────────────────────────────────────────────────────────────

function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}
function appleMapsUrl(address: string) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
}

// ─── Email builder ─────────────────────────────────────────────────────────────

export interface ContactEmailParams {
  customerName: string
  customerEmail?: string
  subject?: string
  body?: string
  ccEmails?: string[]
}

function buildMailto(params: ContactEmailParams, type: "appointment" | "reminder" | "followup" | "custom" = "appointment"): string {
  const to = params.customerEmail ?? ""
  const cc = params.ccEmails?.join(",") ?? ""

  const subjectMap = {
    appointment: `Appointment Confirmation · ${params.customerName}`,
    reminder:    `Service Reminder · ${params.customerName}`,
    followup:    `Follow-Up · ${params.customerName}`,
    custom:      params.subject ?? `Message · ${params.customerName}`,
  }
  const bodyMap = {
    appointment: `Dear ${params.customerName},\n\nThis is a confirmation of your upcoming service appointment with Equipify.ai.\n\nPlease ensure the equipment is accessible at the time of service. If you need to reschedule, contact us at least 24 hours in advance.\n\nBest regards,\nEquipify Service Team`,
    reminder:    `Dear ${params.customerName},\n\nThis is a friendly reminder that you have a scheduled service appointment coming up with Equipify.ai.\n\nPlease don't hesitate to contact us if you have any questions.\n\nBest regards,\nEquipify Service Team`,
    followup:    `Dear ${params.customerName},\n\nThank you for your recent service with Equipify.ai. We wanted to follow up and make sure everything is working as expected.\n\nPlease let us know if you need any additional assistance.\n\nBest regards,\nEquipify Service Team`,
    custom:      params.body ?? "",
  }

  const p = new URLSearchParams()
  if (cc) p.set("cc", cc)
  p.set("subject", subjectMap[type])
  p.set("body", bodyMap[type])
  return `mailto:${to}?${p.toString()}`
}

// ─── Shared trigger button ─────────────────────────────────────────────────────

interface TriggerBtnProps {
  label: string
  icon: React.ReactNode
  open?: boolean
  variant?: "primary" | "ghost"
  className?: string
}

function TriggerBtn({ label, icon, open, variant = "ghost", className }: TriggerBtnProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none whitespace-nowrap",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary"
          : "bg-background border border-border text-foreground hover:bg-muted",
        open && variant !== "primary" && "bg-muted",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
      {open !== undefined && (
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform duration-150", open && "rotate-180")} />
      )}
    </span>
  )
}

// ─── Navigate dropdown ─────────────────────────────────────────────────────────

function NavigateDropdown({ address }: { address: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopyAddress() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Navigate to location">
          <TriggerBtn
            label="Navigate"
            icon={<MapPin className="w-3.5 h-3.5 text-primary" />}
            open={open}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-52 z-[200]">
        <DropdownMenuItem asChild>
          <a href={googleMapsUrl(address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 cursor-pointer">
            {/* Google Maps pin icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
              <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" fill="#EA4335"/>
              <path d="M8 1C5.24 1 3 3.24 3 6c0 1.38.5 2.64 1.32 3.61L8 1z" fill="#FBBC04"/>
              <path d="M8 1c2.76 0 5 2.24 5 5 0 1.38-.5 2.64-1.32 3.61L8 1z" fill="#4285F4"/>
              <circle cx="8" cy="6" r="2" fill="white"/>
            </svg>
            Open in Google Maps
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={appleMapsUrl(address)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 cursor-pointer">
            {/* Apple logo icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
              <path d="M11.18 8.5c-.02-1.7 1.38-2.52 1.44-2.56-0.78-1.15-2-1.3-2.44-1.32-1.04-.1-2.02.6-2.55.6-.52 0-1.34-.58-2.2-.57-1.13.02-2.17.66-2.75 1.67-1.17 2.04-.3 5.06.84 6.72.56.81 1.22 1.72 2.1 1.69.84-.03 1.16-.54 2.18-.54 1.01 0 1.3.54 2.19.53.91-.02 1.48-.82 2.04-1.63.64-.93.9-1.84.92-1.88-.02-.01-1.76-.68-1.77-2.71z" fill="currentColor"/>
              <path d="M9.6 3.2c.46-.56.77-1.35.69-2.13-.66.03-1.47.44-1.94 1-.43.49-.8 1.29-.7 2.05.73.06 1.48-.37 1.95-.92z" fill="currentColor"/>
            </svg>
            Open in Apple Maps
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer">
          {copied
            ? <Check className="w-3.5 h-3.5 text-[color:var(--status-success)] shrink-0" />
            : <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Email dropdown ────────────────────────────────────────────────────────────

function EmailDropdown({ params }: { params: ContactEmailParams }) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Email customer">
          <TriggerBtn
            label="Email"
            icon={<Mail className="w-3.5 h-3.5 text-primary" />}
            open={open}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-52 z-[200]">
        <DropdownMenuItem asChild>
          <a href={buildMailto(params, "appointment")} className="flex items-center gap-2.5 cursor-pointer">
            <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
            Appointment Email
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildMailto(params, "reminder")} className="flex items-center gap-2.5 cursor-pointer">
            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            Reminder Email
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildMailto(params, "followup")} className="flex items-center gap-2.5 cursor-pointer">
            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            Follow-Up Email
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={buildMailto(params, "custom")} className="flex items-center gap-2.5 cursor-pointer">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            Custom Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── More dropdown (Call + Message) ───────────────────────────────────────────

function MoreDropdown({ phone, email }: { phone?: string; email?: string }) {
  const [open, setOpen] = useState(false)

  if (!phone && !email) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More contact options">
          <TriggerBtn
            label=""
            icon={<MoreHorizontal className="w-3.5 h-3.5" />}
            open={undefined}
            className="px-2"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-44 z-[200]">
        {phone && (
          <>
            <DropdownMenuItem asChild>
              <a href={`tel:${phone}`} className="flex items-center gap-2.5 cursor-pointer">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                Call {phone}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`sms:${phone}`} className="flex items-center gap-2.5 cursor-pointer">
                <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                Message {phone}
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ContactActionsProps {
  /** Street address / location string for map navigation */
  address?: string
  /** Contact email params for email composer */
  email?: ContactEmailParams
  /** Phone number for call + SMS */
  phone?: string
  className?: string
}

/**
 * Compact row of quick-contact action buttons.
 * Shows Navigate (if address), Email (if email params), and More... (call/SMS if phone).
 * All dropdowns use Radix portals so they escape any overflow:hidden ancestor.
 */
export function ContactActions({ address, email, phone, className }: ContactActionsProps) {
  if (!address && !email && !phone) return null

  return (
    <div
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {address && <NavigateDropdown address={address} />}
      {email   && <EmailDropdown params={email} />}
      {phone   && <MoreDropdown phone={phone} />}
    </div>
  )
}
