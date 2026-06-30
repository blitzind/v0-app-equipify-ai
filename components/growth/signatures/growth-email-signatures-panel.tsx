"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Eye, Loader2, Pencil, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GROWTH_SENDER_PROFILE_SIGNATURE_STATUS_LABELS,
  GROWTH_SIGNATURE_PRIVACY_NOTE,
  GROWTH_SIGNATURE_TEMPLATE_LABELS,
  type GrowthSenderProfileSignatureStatus,
  type GrowthSenderProfilesDashboardPayload,
  type GrowthSenderProfile,
  type GrowthSignatureTemplateId,
} from "@/lib/growth/signatures/signature-types"
import {
  GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
  GROWTH_SIGNATURE_TOGGLES_DEFAULT,
} from "@/lib/growth/signatures/signature-profile-defaults"
import { renderSignatureTemplate } from "@/lib/growth/signatures/signature-template-render"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import { GrowthSignatureBookingCtaFields } from "@/components/growth/signatures/growth-signature-booking-cta-fields"

type ProfileFormState = {
  senderAccountId: string
  mailboxConnectionId: string | null
  displayName: string
  title: string
  email: string
  phone: string
  companyName: string
  companyTagline: string
  website: string
  linkedinUrl: string
  avatarUrl: string
  logoUrl: string
  bookingUrl: string
  bookingLabel: string
  showEmailInSignature: boolean
  showPhoneInSignature: boolean
  showWebsiteInSignature: boolean
  showBookingCta: boolean
  active: boolean
  signatureTemplate: GrowthSignatureTemplateId
  notes: string
}

const EMPTY_FORM: ProfileFormState = {
  senderAccountId: "",
  mailboxConnectionId: null,
  displayName: "",
  title: "",
  email: "",
  phone: "",
  companyName: "",
  companyTagline: "",
  website: "",
  linkedinUrl: "",
  avatarUrl: "",
  logoUrl: "",
  bookingUrl: "",
  bookingLabel: GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
  showEmailInSignature: GROWTH_SIGNATURE_TOGGLES_DEFAULT.show_email_in_signature,
  showPhoneInSignature: GROWTH_SIGNATURE_TOGGLES_DEFAULT.show_phone_in_signature,
  showWebsiteInSignature: GROWTH_SIGNATURE_TOGGLES_DEFAULT.show_website_in_signature,
  showBookingCta: GROWTH_SIGNATURE_TOGGLES_DEFAULT.show_booking_cta,
  active: true,
  signatureTemplate: "simple",
  notes: "",
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  )
}

function signatureStatusTone(
  status: GrowthSenderProfileSignatureStatus,
): "healthy" | "attention" | "neutral" | "blocked" | "medium" {
  switch (status) {
    case "configured":
      return "healthy"
    case "inherited":
      return "medium"
    case "missing":
      return "attention"
    case "disabled":
      return "blocked"
    default:
      return "neutral"
  }
}

export function GrowthEmailSignaturesPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthSenderProfilesDashboardPayload | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewText, setPreviewText] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<GrowthSignatureTemplateId>("simple")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sender-profiles/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthSenderProfilesDashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load sender profiles.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const templateCards = dashboard?.templates ?? []

  function openCreate(senderId: string, email: string, displayName: string, mailboxId: string | null) {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      senderAccountId: senderId,
      mailboxConnectionId: mailboxId,
      displayName: displayName || email.split("@")[0],
      email,
    })
    setEditOpen(true)
  }

  function openEdit(profile: GrowthSenderProfile) {
    setEditingId(profile.id)
    setForm({
      senderAccountId: profile.sender_account_id,
      mailboxConnectionId: profile.mailbox_connection_id,
      displayName: profile.display_name,
      title: profile.title ?? "",
      email: profile.email,
      phone: profile.phone ?? "",
      companyName: profile.company_name ?? "",
      companyTagline: profile.company_tagline ?? "",
      website: profile.website ?? "",
      linkedinUrl: profile.linkedin_url ?? "",
      avatarUrl: profile.avatar_url ?? "",
      logoUrl: profile.logo_url ?? "",
      bookingUrl: profile.booking_url ?? "",
      bookingLabel: profile.booking_label ?? GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
      showEmailInSignature: profile.show_email_in_signature,
      showPhoneInSignature: profile.show_phone_in_signature,
      showWebsiteInSignature: profile.show_website_in_signature,
      showBookingCta: profile.show_booking_cta,
      active: profile.active,
      signatureTemplate: profile.signature_template,
      notes: profile.notes ?? "",
    })
    setEditOpen(true)
  }

  async function runPreview(profileId: string, templateOverride?: GrowthSignatureTemplateId) {
    setActionLoading(`preview-${profileId}`)
    try {
      const res = await fetch(`/api/platform/growth/sender-profiles/${profileId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          templateOverride ? { signatureTemplate: templateOverride } : {},
        ),
      })
      const data = (await res.json().catch(() => ({}))) as {
        signature?: { html: string; text: string }
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? "Preview failed.")
      setPreviewHtml(data.signature?.html ?? "")
      setPreviewText(data.signature?.text ?? "")
      setPreviewOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function saveProfile() {
    setActionLoading("save")
    setError(null)
    try {
      const payload = {
        senderAccountId: form.senderAccountId,
        mailboxConnectionId: form.mailboxConnectionId,
        displayName: form.displayName,
        title: form.title.trim() || null,
        email: form.email,
        phone: form.phone.trim() || null,
        companyName: form.companyName.trim() || null,
        companyTagline: form.companyTagline.trim() || null,
        website: form.website.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        bookingUrl: form.bookingUrl.trim() || null,
        bookingLabel: form.bookingLabel.trim() || null,
        showEmailInSignature: form.showEmailInSignature,
        showPhoneInSignature: form.showPhoneInSignature,
        showWebsiteInSignature: form.showWebsiteInSignature,
        showBookingCta: form.showBookingCta,
        active: form.active,
        signatureTemplate: form.signatureTemplate,
        notes: form.notes.trim() || null,
      }

      const res = editingId
        ? await fetch(`/api/platform/growth/sender-profiles/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mailboxConnectionId: payload.mailboxConnectionId,
              displayName: payload.displayName,
              title: payload.title,
              email: payload.email,
              phone: payload.phone,
              companyName: payload.companyName,
              companyTagline: payload.companyTagline,
              website: payload.website,
              linkedinUrl: payload.linkedinUrl,
              avatarUrl: payload.avatarUrl,
              logoUrl: payload.logoUrl,
              bookingUrl: payload.bookingUrl,
              bookingLabel: payload.bookingLabel,
              showEmailInSignature: payload.showEmailInSignature,
              showPhoneInSignature: payload.showPhoneInSignature,
              showWebsiteInSignature: payload.showWebsiteInSignature,
              showBookingCta: payload.showBookingCta,
              active: payload.active,
              signatureTemplate: payload.signatureTemplate,
              notes: payload.notes,
            }),
          })
        : await fetch("/api/platform/growth/sender-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Save failed.")
      setEditOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleActive(profile: GrowthSenderProfile) {
    setActionLoading(`active-${profile.id}`)
    try {
      const res = await fetch(`/api/platform/growth/sender-profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !profile.active }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Could not update status.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionLoading(null)
    }
  }

  const previewTemplateSample = useMemo(
    () => ({
      display_name: "Michael Short",
      title: "Founder",
      email: "mike@equipifyai.com",
      phone: "(562) 362-5489",
      company_name: "Equipify.ai",
      company_tagline: "Field Service Infrastructure for Biomedical Organizations",
      website: "https://equipify.ai",
      linkedin_url: "linkedin.com/in/michaelshort",
      logo_url: "",
      avatar_url: "",
      booking_url: "https://equipify.ai/demo",
      booking_label: GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
      show_email_in_signature: false,
      show_phone_in_signature: true,
      show_website_in_signature: true,
      show_booking_cta: true,
    }),
    [],
  )

  const templatePreviewHtml = useMemo(
    () => renderSignatureTemplate(selectedTemplate, previewTemplateSample).html,
    [selectedTemplate, previewTemplateSample],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sender profiles and signatures…
      </div>
    )
  }

  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-growth-settings-communications-refinement={GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{GROWTH_SIGNATURE_PRIVACY_NOTE}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Sender Profiles">
        {(dashboard?.profiles ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No sender profiles yet. Create one from an unassigned mailbox below.
            </p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Sender</th>
                <th className="px-2 py-2">Mailbox</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Signature</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.profiles.map((row) => (
                  <tr key={row.profile.id} className="border-b border-border/60">
                    <td className="px-2 py-3">
                      <div className="font-medium">{row.profile.display_name}</div>
                      <div className="text-xs text-muted-foreground">{row.senderEmail}</div>
                    </td>
                    <td className="px-2 py-3">{row.mailboxEmail ?? row.senderEmail}</td>
                    <td className="px-2 py-3">{row.profile.title ?? "—"}</td>
                    <td className="px-2 py-3">
                      {GROWTH_SIGNATURE_TEMPLATE_LABELS[row.profile.signature_template]}
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge
                        label={GROWTH_SENDER_PROFILE_SIGNATURE_STATUS_LABELS[row.signatureStatus]}
                        tone={signatureStatusTone(row.signatureStatus)}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row.profile)}>
                          <Pencil className="mr-1 size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === `preview-${row.profile.id}`}
                          onClick={() => void runPreview(row.profile.id)}
                        >
                          <Eye className="mr-1 size-3.5" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void toggleActive(row.profile)}
                        >
                          {row.profile.active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        )}
      </GrowthEngineCard>

      {(dashboard?.unassignedSenders ?? []).length > 0 ? (
        <GrowthEngineCard title="Assign Mailbox → Sender Profile">
          <div className="space-y-2">
            {dashboard?.unassignedSenders.map((sender) => (
              <div
                key={sender.senderId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{sender.email}</div>
                  <div className="text-xs text-muted-foreground">{sender.displayName}</div>
                  <GrowthBadge
                    label={GROWTH_SENDER_PROFILE_SIGNATURE_STATUS_LABELS[sender.signatureStatus]}
                    tone={signatureStatusTone(sender.signatureStatus)}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openCreate(sender.senderId, sender.email, sender.displayName, sender.mailboxId)
                  }
                >
                  <Plus className="mr-1 size-3.5" />
                  Create profile
                </Button>
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Signature Templates">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {templateCards.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={`rounded-xl border p-4 text-left transition-colors ${
                selectedTemplate === tpl.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}
              onClick={() => setSelectedTemplate(tpl.id)}
            >
              <div className="font-medium">{tpl.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Template preview</p>
          <div
            className="rounded-lg border border-border bg-white p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
          />
        </div>
      </GrowthEngineCard>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit sender profile" : "Create sender profile"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <FormSection title="Identity">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Display name</Label>
                  <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>LinkedIn URL</Label>
                  <Input value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <GrowthMediaPicker
                    label="Team photo"
                    value={form.avatarUrl}
                    acceptedTypes={["team"]}
                    allowManualUrl
                    onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Company">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Company name</Label>
                  <Input
                    value={form.companyName}
                    onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                    placeholder="Equipify.ai"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website URL</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://equipify.ai"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Company tagline</Label>
                  <Input
                    value={form.companyTagline}
                    onChange={(e) => setForm((f) => ({ ...f, companyTagline: e.target.value }))}
                    placeholder="Field Service Infrastructure for Biomedical Organizations"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <GrowthMediaPicker
                    label="Logo"
                    value={form.logoUrl}
                    acceptedTypes={["logo", "image"]}
                    allowManualUrl
                    onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Booking CTA">
              <GrowthSignatureBookingCtaFields
                bookingUrl={form.bookingUrl}
                bookingLabel={form.bookingLabel}
                showBookingCta={form.showBookingCta}
                onBookingUrlChange={(url) => setForm((f) => ({ ...f, bookingUrl: url }))}
                onBookingLabelChange={(label) => setForm((f) => ({ ...f, bookingLabel: label }))}
                onShowBookingCtaChange={(checked) => setForm((f) => ({ ...f, showBookingCta: checked }))}
              />
            </FormSection>

            <FormSection title="Signature options">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Signature template</Label>
                  <Select
                    value={form.signatureTemplate}
                    onValueChange={(v) => setForm((f) => ({ ...f, signatureTemplate: v as GrowthSignatureTemplateId }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templateCards.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>{tpl.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ToggleRow
                    id="show-email"
                    label="Show email"
                    checked={form.showEmailInSignature}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, showEmailInSignature: checked }))}
                  />
                  <ToggleRow
                    id="show-phone"
                    label="Show phone"
                    checked={form.showPhoneInSignature}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, showPhoneInSignature: checked }))}
                  />
                  <ToggleRow
                    id="show-website"
                    label="Show website / company link"
                    checked={form.showWebsiteInSignature}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, showWebsiteInSignature: checked }))}
                  />
                </div>
              </div>
            </FormSection>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="button" disabled={actionLoading === "save"} onClick={() => void saveProfile()}>
              Save profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signature preview</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-white p-4 text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <pre className="rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">{previewText}</pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
