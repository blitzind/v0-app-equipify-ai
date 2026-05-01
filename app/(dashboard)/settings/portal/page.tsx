"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Globe, Paintbrush, LayoutGrid, LogIn, Mail, Link2,
  Save, Eye, Upload, Check,
} from "lucide-react"

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, description, icon: Icon, children }: {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/8 border border-primary/15 shrink-0">
          <Icon size={17} className="text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function FieldRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0 w-64">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/25"
      )}
    >
      <span className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5"
      )} />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MODULE_OPTIONS = [
  { key: "workOrders",  label: "Work Orders",   description: "Customers can view open and past work orders" },
  { key: "invoices",    label: "Invoices",       description: "Customers can view and download invoices" },
  { key: "equipment",   label: "Equipment",      description: "Customers can view their registered equipment" },
  { key: "quotes",      label: "Quotes",         description: "Customers can view and accept quotes" },
  { key: "documents",   label: "Documents",      description: "Customers can access shared files" },
  { key: "scheduling",  label: "Self-Schedule",  description: "Customers can request and schedule service visits" },
  { key: "payments",    label: "Online Payments",description: "Customers can pay invoices directly from the portal" },
]

const LOGIN_OPTIONS = [
  { value: "magic-link", label: "Magic Link (passwordless email)" },
  { value: "password",   label: "Email + Password" },
  { value: "both",       label: "Both" },
]

const EMAIL_TEMPLATES = [
  { key: "invite",    label: "Portal Invite",       description: "Sent when a customer is first invited to the portal" },
  { key: "magic",     label: "Magic Login Link",     description: "Sent each time a customer requests a login link" },
  { key: "workorder", label: "Work Order Update",    description: "Sent when a work order status changes" },
  { key: "invoice",   label: "Invoice Ready",        description: "Sent when a new invoice is available" },
  { key: "quote",     label: "Quote Approval",       description: "Sent when a quote is waiting for customer approval" },
]

export default function PortalSettingsPage() {
  const [saved, setSaved] = useState(false)

  // Branding
  const [portalName, setPortalName] = useState("Equipify Customer Portal")
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [logoUploaded, setLogoUploaded] = useState(false)
  const [faviconUploaded, setFaviconUploaded] = useState(false)

  // Modules
  const [modules, setModules] = useState<Record<string, boolean>>({
    workOrders: true, invoices: true, equipment: true,
    quotes: false, documents: false, scheduling: false, payments: false,
  })

  // Login
  const [loginMethod, setLoginMethod] = useState("magic-link")
  const [sessionDays, setSessionDays] = useState("30")

  // Login page
  const [welcomeTitle, setWelcomeTitle] = useState("Welcome back")
  const [welcomeBody, setWelcomeBody] = useState("Sign in to view your equipment, work orders, and invoices.")
  const [supportEmail, setSupportEmail] = useState("support@example.com")

  // Custom domain
  const [customDomain, setCustomDomain] = useState("")
  const [domainVerified] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Customer Portal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure the global defaults for your customer-facing portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Eye size={13} /> Preview Portal
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave}>
            {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save Changes</>}
          </Button>
        </div>
      </div>

      {/* Branding */}
      <SectionCard
        title="Branding"
        description="Customize how the portal looks for your customers."
        icon={Paintbrush}
      >
        <FieldRow label="Portal Name" description="Shown in the browser tab and email subject lines.">
          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} className="text-xs h-8" />
        </FieldRow>
        <FieldRow label="Brand Color" description="Primary color used for buttons and accents.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="text-xs h-8 font-mono"
              maxLength={7}
            />
          </div>
        </FieldRow>
        <FieldRow label="Logo" description="Displayed at the top of the portal. PNG or SVG, max 2 MB.">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs w-full"
            onClick={() => setLogoUploaded(true)}
          >
            {logoUploaded ? <><Check size={12} className="text-[color:var(--status-success)]" /> Logo uploaded</> : <><Upload size={12} /> Upload Logo</>}
          </Button>
        </FieldRow>
        <FieldRow label="Favicon" description="Small icon shown in browser tabs.">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs w-full"
            onClick={() => setFaviconUploaded(true)}
          >
            {faviconUploaded ? <><Check size={12} className="text-[color:var(--status-success)]" /> Favicon uploaded</> : <><Upload size={12} /> Upload Favicon</>}
          </Button>
        </FieldRow>
      </SectionCard>

      {/* Portal Modules */}
      <SectionCard
        title="Portal Modules"
        description="Control which features are available to customers by default. These can be overridden per customer."
        icon={LayoutGrid}
      >
        <div className="space-y-0">
          {MODULE_OPTIONS.map(({ key, label, description }) => (
            <FieldRow key={key} label={label} description={description}>
              <div className="flex justify-end">
                <Toggle
                  checked={modules[key]}
                  onChange={(v) => setModules((m) => ({ ...m, [key]: v }))}
                />
              </div>
            </FieldRow>
          ))}
        </div>
      </SectionCard>

      {/* Login Page Settings */}
      <SectionCard
        title="Login Page"
        description="Customize the text customers see when they log in."
        icon={LogIn}
      >
        <FieldRow label="Welcome Title" description="Headline shown above the login form.">
          <Input value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} className="text-xs h-8" />
        </FieldRow>
        <FieldRow label="Welcome Message" description="Short description shown below the title.">
          <textarea
            value={welcomeBody}
            onChange={(e) => setWelcomeBody(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
          />
        </FieldRow>
        <FieldRow label="Support Email" description="Shown as a help link on the login page.">
          <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="text-xs h-8" type="email" />
        </FieldRow>
        <FieldRow label="Login Method" description="How customers authenticate into the portal.">
          <div className="space-y-1.5">
            {LOGIN_OPTIONS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="loginMethod"
                  value={value}
                  checked={loginMethod === value}
                  onChange={() => setLoginMethod(value)}
                  className="accent-primary"
                />
                <span className="text-xs text-foreground">{label}</span>
              </label>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Session Duration" description="How many days before customers must re-authenticate.">
          <div className="flex items-center gap-2">
            <Input
              value={sessionDays}
              onChange={(e) => setSessionDays(e.target.value)}
              className="text-xs h-8 w-20"
              type="number"
              min="1"
              max="365"
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </FieldRow>
      </SectionCard>

      {/* Email Templates */}
      <SectionCard
        title="Email Templates"
        description="Customize the automated emails sent to customers via the portal."
        icon={Mail}
      >
        <div className="space-y-0">
          {EMAIL_TEMPLATES.map(({ key, label, description }) => (
            <FieldRow key={key} label={label} description={description}>
              <Button variant="outline" size="sm" className="text-xs w-full gap-1.5">
                Edit Template
              </Button>
            </FieldRow>
          ))}
        </div>
      </SectionCard>

      {/* Custom Domain */}
      <SectionCard
        title="Custom Domain"
        description="Serve the portal from your own domain (e.g. portal.yourcompany.com)."
        icon={Link2}
      >
        <FieldRow label="Domain" description="Add a CNAME record pointing to portal.equipify.ai to verify.">
          <div className="flex items-center gap-2">
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="portal.yourcompany.com"
              className="text-xs h-8"
            />
          </div>
        </FieldRow>
        <FieldRow label="Status" description="DNS propagation can take up to 48 hours.">
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              domainVerified ? "bg-[color:var(--status-success)]" : "bg-muted-foreground/40"
            )} />
            <span className="text-xs text-muted-foreground">
              {customDomain
                ? domainVerified ? "Verified" : "Pending verification"
                : "No domain configured"}
            </span>
            {customDomain && !domainVerified && (
              <Button variant="outline" size="sm" className="text-xs h-6 px-2 ml-auto">
                Verify
              </Button>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Default URL" description="Used when no custom domain is set.">
          <div className="flex items-center gap-2">
            <Globe size={12} className="text-muted-foreground shrink-0" />
            <code className="text-xs text-muted-foreground font-mono">portal.equipify.ai/acme-corp</code>
          </div>
        </FieldRow>
      </SectionCard>
    </div>
  )
}
